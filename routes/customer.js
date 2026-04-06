function parseExtra(top) {
  const match = String(top).match(/\(\s*\+\s*([\d.]+)\s*\)/);
  return match ? parseFloat(match[1]) : 0;
}

function stripTop(top) {
  return String(top).replace(/\s*\(\s*\+\s*[\d.]+\s*\)/, "").trim();
}

function registerCustomerRoutes(app, deps) {
  const { pool, crypto, MENU_SELECT, MENU_GROUP, formatMenuItem, parseToppings } = deps;

  app.get("/customer/menu", async (_req, res) => {
    try {
      const [results] = await pool.query(MENU_SELECT + " AND mi.is_available = TRUE" + MENU_GROUP);
      res.json(results.map((m) => formatMenuItem({ ...m, toppings: parseToppings(m.toppings_raw) })));
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  app.patch("/customer/tables/:id", async (req, res) => {
    const { status, order_id } = req.body;
    try {
      const [result] = await pool.query(
        "UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = NOW() WHERE table_id = ?",
        [status, order_id || null, req.params.id]
      );
      if (result.affectedRows !== 1) return res.status(404).send("Table not found");
      res.send("Table updated");
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  app.post("/customer/start-session", async (req, res) => {
    const { table_id } = req.body;
    if (!table_id) return res.status(400).send("Table ID is required");

    const sessionId = crypto.randomUUID();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "UPDATE customer_sessions SET is_active = 0, ended_at = NOW() WHERE table_id = ? AND is_active = 1",
        [table_id]
      );
      await conn.query(
        "INSERT INTO customer_sessions (session_id, table_id, is_active) VALUES (?, ?, 1)",
        [sessionId, table_id]
      );
      await conn.commit();
      res.json({ sessionId });
    } catch (err) {
      await conn.rollback();
      res.status(500).send("Server Error");
    } finally {
      conn.release();
    }
  });

  app.post("/customer/end-session", async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).send("Session ID required");
    try {
      await pool.query("UPDATE customer_sessions SET is_active = 0, ended_at = NOW() WHERE session_id = ?", [sessionId]);
      res.send("Session ended");
    } catch (err) {
      res.status(500).send("Server Error");
    }
  });

  app.post("/customer/orders", async (req, res) => {
    const { tableId, items, total, sessionId } = req.body;
    if (!tableId || !items || !Array.isArray(items) || items.length === 0 || !total) {
      return res.status(400).json({ error: "ข้อมูลไม่ครบ กรุณาเลือกอาหารอย่างน้อย 1 รายการ" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const subtotal = parseFloat(total);
      const vatRate = 0.07;
      const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
      const grandTotal = subtotal + vatAmount;
      const orderId = `ORD-${Date.now()}`;

      await conn.query(
        "INSERT INTO orders (id, table_id, session_id, subtotal, vat_rate, vat_amount, total) VALUES (?,?,?,?,?,?,?)",
        [orderId, tableId, sessionId || null, subtotal, vatRate * 100, vatAmount, grandTotal]
      );

      for (const item of items) {
        const itemToppings = Array.isArray(item.toppings) ? item.toppings : [];
        const extraPrice = itemToppings.reduce((sum, top) => sum + parseExtra(top), 0);
        const lineTotal = (item.price + extraPrice / item.qty) * item.qty;

        const [oi] = await conn.query(
          "INSERT INTO order_items (order_id, menu_id, menu_name_th, unit_price, qty, extra_price, line_total, special_note) VALUES (?,?,?,?,?,?,?,?)",
          [orderId, item.menuId, item.name, item.price, item.qty, extraPrice, lineTotal, item.note || null]
        );

        for (const top of itemToppings) {
          await conn.query(
            "INSERT INTO order_item_toppings (order_item_id, topping_name, extra_price) VALUES (?,?,?)",
            [oi.insertId, stripTop(top), parseExtra(top)]
          );
        }
      }

      await conn.query(
        "UPDATE restaurant_tables SET status = 'occupied', current_order_id = ?, updated_at = NOW() WHERE table_id = ?",
        [orderId, tableId]
      );

      await conn.commit();
      res.json({ id: orderId, tableId, items, subtotal, vat_amount: vatAmount, total: grandTotal, status: "pending", paid: 0 });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: "Database server error" });
    } finally {
      conn.release();
    }
  });

  app.patch("/customer/orders/:id/pay", async (req, res) => {
    const { payment_method = "cash" } = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("CALL sp_pay_order(?, ?)", [req.params.id, payment_method]);
      const [rows] = await conn.query("SELECT table_id FROM orders WHERE id = ?", [req.params.id]);
      if (rows.length > 0) {
        await conn.query(
          "UPDATE restaurant_tables SET status = 'cleaning', current_order_id = NULL, updated_at = NOW() WHERE table_id = ?",
          [rows[0].table_id]
        );
      }
      await conn.commit();
      res.send("Paid successfully");
    } catch (err) {
      await conn.rollback();
      res.status(500).send("Database server error");
    } finally {
      conn.release();
    }
  });

  app.post("/customer/orders/:id/cancel", async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const [orderRows] = await conn.query("SELECT id, status, table_id FROM orders WHERE id = ?", [req.params.id]);
      if (!orderRows.length) return res.status(404).json({ error: "Order not found" });

      const order = orderRows[0];
      if (["serving", "paid"].includes(order.status)) {
        return res.status(400).json({ error: `Cannot cancel ${order.status} orders` });
      }

      await conn.beginTransaction();
      await conn.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [req.params.id]);
      await conn.query(
        "UPDATE restaurant_tables SET status = 'vacant', current_order_id = NULL, updated_at = NOW() WHERE table_id = ?",
        [order.table_id]
      );
      await conn.commit();
      res.json({ success: true, message: "Order cancelled successfully" });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: "Database server error" });
    } finally {
      conn.release();
    }
  });
}

module.exports = registerCustomerRoutes;
