function parseExtra(top) {
  const match = String(top).match(/\(\s*\+\s*([\d.]+)\s*\)/);
  return match ? parseFloat(match[1]) : 0;
}

function stripTop(top) {
  return String(top).replace(/\s*\(\s*\+\s*[\d.]+\s*\)/, "").trim();
}

function registerAliasRoutes(app, deps) {
  const { pool, crypto, MENU_SELECT, MENU_GROUP, formatMenuItem, parseToppings, fetchOrdersWithItems } = deps;

  /**
   * @swagger
   * /menu/all:
   *   get:
   *     summary: List all menu items
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Menu loaded
   */
  app.get("/menu/all", async (_req, res) => {
    try {
      const [results] = await pool.query(MENU_SELECT + MENU_GROUP);
      res.json(results.map((m) => formatMenuItem({ ...m, toppings: parseToppings(m.toppings_raw) })));
    } catch (err) {
      console.error("❌ Error loading menu:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /tables:
   *   get:
   *     summary: List restaurant tables
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Tables loaded
   */
  app.get("/tables", async (_req, res) => {
    try {
      const [results] = await pool.query(
        "SELECT table_id AS id, status, current_order_id AS order_id, capacity, updated_at FROM restaurant_tables ORDER BY table_id"
      );
      const tables = {};
      results.forEach((t) => {
        tables[t.id] = { status: t.status || "vacant", order_id: t.order_id || null, capacity: t.capacity || 4, updated_at: t.updated_at };
      });
      res.json(tables);
    } catch (err) {
      console.error("❌ Error loading tables:", err);
      res.status(500).json({ error: "Database server error" });
    }
  });

  /**
   * @swagger
   * /tables/{id}:
   *   patch:
   *     summary: Update table status
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *               order_id:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Table updated
   */
  app.patch("/tables/:id", async (req, res) => {
    const { status, order_id } = req.body;
    try {
      const [result] = await pool.query(
        "UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = NOW() WHERE table_id = ?",
        [status, order_id || null, req.params.id]
      );
      if (result.affectedRows !== 1) return res.status(404).send("Table not found");
      res.send("Table updated");
    } catch (err) {
      console.error("❌ Error updating table:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /tables:
   *   post:
   *     summary: Create table
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Table created
   */
  app.post("/tables", async (req, res) => {
    const { table_id, table_name, capacity } = req.body;
    if (!table_id) return res.status(400).send("Table ID required");
    try {
      await pool.query(
        "INSERT INTO restaurant_tables (table_id, table_name, capacity) VALUES (?, ?, ?)",
        [table_id, table_name || `Table ${table_id}`, capacity || 4]
      );
      res.json({ success: true, table_id });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") return res.status(409).send("Table already exists");
      console.error("❌ Error creating table:", err);
      res.status(500).send("Server error");
    }
  });

  /**
   * @swagger
   * /menu:
   *   post:
   *     summary: Create menu item
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Menu item created
   */
  app.post("/menu", async (req, res) => {
    const { name, name_th, category, price, toppings, img } = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [catRow] = await conn.query("SELECT id FROM menu_categories WHERE code = ?", [category]);
      if (!catRow.length) {
        await conn.rollback();
        return res.status(400).send("Invalid category");
      }

      const newId = `MN-${Date.now()}`;
      await conn.query(
        "INSERT INTO menu_items (id, category_id, name_th, name_en, price, emoji) VALUES (?,?,?,?,?,?)",
        [newId, catRow[0].id, name_th || name, name || name_th, parseFloat(price) || 0, img || "🍽️"]
      );
      const tops = Array.isArray(toppings) ? toppings : [];
      for (let i = 0; i < tops.length; i++) {
        await conn.query(
          "INSERT INTO menu_toppings (menu_id, name_th, extra_price, sort_order) VALUES (?,?,?,?)",
          [newId, stripTop(tops[i]), parseExtra(tops[i]), i]
        );
      }
      await conn.commit();
      res.json({ id: newId, name_th: name_th || name, category, price: parseFloat(price) || 0, toppings: tops, img: img || "🍽️", available: 1 });
    } catch (err) {
      await conn.rollback();
      console.error("❌ Error creating menu item:", err);
      res.status(500).send("Database server error");
    } finally {
      conn.release();
    }
  });

  /**
   * @swagger
   * /menu/{id}:
   *   put:
   *     summary: Update menu item
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Menu updated
   */
  app.put("/menu/:id", async (req, res) => {
    const { id } = req.params;
    const { name_th, nameTh, name, category, price, toppings, img, available } = req.body;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const fields = [];
      const vals = [];
      const thName = name_th || nameTh;
      if (thName) { fields.push("name_th = ?"); vals.push(thName); }
      if (name) { fields.push("name_en = ?"); vals.push(name); }
      if (price !== undefined) { fields.push("price = ?"); vals.push(parseFloat(price)); }
      if (img) { fields.push("emoji = ?"); vals.push(img); }
      if (available !== undefined) { fields.push("is_available = ?"); vals.push(available ? 1 : 0); }

      if (category) {
        const [catRow] = await conn.query("SELECT id FROM menu_categories WHERE code = ?", [category]);
        if (catRow.length) { fields.push("category_id = ?"); vals.push(catRow[0].id); }
      }

      if (fields.length) {
        vals.push(id);
        await conn.query(`UPDATE menu_items SET ${fields.join(", ")} WHERE id = ?`, vals);
      }

      if (Array.isArray(toppings)) {
        await conn.query("DELETE FROM menu_toppings WHERE menu_id = ?", [id]);
        for (let i = 0; i < toppings.length; i++) {
          await conn.query(
            "INSERT INTO menu_toppings (menu_id, name_th, extra_price, sort_order) VALUES (?,?,?,?)",
            [id, stripTop(toppings[i]), parseExtra(toppings[i]), i]
          );
        }
      }

      await conn.commit();
      res.send("Update successfully");
    } catch (err) {
      await conn.rollback();
      console.error("❌ Error updating menu item:", err);
      res.status(500).send("Database server error");
    } finally {
      conn.release();
    }
  });

  /**
   * @swagger
   * /menu/{id}:
   *   delete:
   *     summary: Soft delete menu item
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Menu deleted
   */
  app.delete("/menu/:id", async (req, res) => {
    try {
      const [result] = await pool.query("UPDATE menu_items SET is_deleted = TRUE WHERE id = ?", [req.params.id]);
      if (result.affectedRows !== 1) return res.status(404).send("Menu not found");
      res.send("Delete successfully");
    } catch (err) {
      console.error("❌ Error deleting menu item:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /orders:
   *   post:
   *     summary: Create order
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Order created
   */
  app.post("/orders", async (req, res) => {
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
      console.error("❌ Error creating order:", err);
      res.status(500).json({ error: "Database server error" });
    } finally {
      conn.release();
    }
  });

  /**
   * @swagger
   * /orders:
   *   get:
   *     summary: List all orders
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Orders loaded
   */
  app.get("/orders", async (_req, res) => {
    try {
      const result = await fetchOrdersWithItems(pool);
      res.json(result);
    } catch (err) {
      console.error("❌ Error fetching orders:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /orders/active:
   *   get:
   *     summary: Get active orders
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Active orders
   */
  app.get("/orders/active", async (_req, res) => {
    try {
      const result = await fetchOrdersWithItems(pool, "WHERE o.is_paid = FALSE AND o.status NOT IN ('paid','cancelled')");
      res.json(result);
    } catch (err) {
      console.error("❌ Error fetching active orders:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /orders/{id}/status:
   *   patch:
   *     summary: Update order status
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *     responses:
   *       200:
   *         description: Status updated
   */
  app.patch("/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    try {
      const [result] = await pool.query("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [status, req.params.id]);
      if (result.affectedRows !== 1) return res.status(404).send("Order not found");
      res.send("Status updated");
    } catch (err) {
      console.error("❌ Error updating order status:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /orders/{id}/pay:
   *   patch:
   *     summary: Pay order
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Payment complete
   */
  app.patch("/orders/:id/pay", async (req, res) => {
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
      console.error("❌ Error processing payment:", err);
      res.status(500).send("Database server error");
    } finally {
      conn.release();
    }
  });

  /**
   * @swagger
   * /orders/{id}/cancel:
   *   post:
   *     summary: Cancel order
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order cancelled
   */
  app.post("/orders/:id/cancel", async (req, res) => {
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
      console.error("❌ Error cancelling order:", err);
      res.status(500).json({ error: "Database server error" });
    } finally {
      conn.release();
    }
  });

  /**
   * @swagger
   * /start-session:
   *   post:
   *     summary: Start session
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Session started
   */
  app.post("/start-session", async (req, res) => {
    const { table_id } = req.body;
    if (!table_id) return res.status(400).send("Table ID is required");
    const sessionId = crypto.randomUUID();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("UPDATE customer_sessions SET is_active = 0, ended_at = NOW() WHERE table_id = ? AND is_active = 1", [table_id]);
      await conn.query("INSERT INTO customer_sessions (session_id, table_id, is_active) VALUES (?, ?, 1)", [sessionId, table_id]);
      await conn.commit();
      res.json({ sessionId });
    } catch (err) {
      await conn.rollback();
      console.error("❌ Error starting session:", err);
      res.status(500).send("Server Error");
    } finally {
      conn.release();
    }
  });

  /**
   * @swagger
   * /end-session:
   *   post:
   *     summary: End session
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Session ended
   */
  app.post("/end-session", async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).send("Session ID required");
    try {
      await pool.query("UPDATE customer_sessions SET is_active = 0, ended_at = NOW() WHERE session_id = ?", [sessionId]);
      res.send("Session ended");
    } catch (err) {
      console.error("❌ Error ending session:", err);
      res.status(500).send("Server Error");
    }
  });

  /**
   * @swagger
   * /reviews:
   *   post:
   *     summary: Create review
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Review created
   */
  app.post("/reviews", async (req, res) => {
    const { orderId, tableId, rating, comment, sessionId } = req.body;
    try {
      const [result] = await pool.query(
        "INSERT INTO reviews (order_id, table_id, session_id, rating, comment) VALUES (?,?,?,?,?)",
        [orderId || null, tableId, sessionId || null, parseInt(rating, 10), comment || ""]
      );
      res.json({ id: result.insertId });
    } catch (err) {
      console.error("❌ Error adding review:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /orders/{id}/receipt:
   *   get:
   *     summary: Get order receipt
   *     tags: [Customer]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Receipt loaded
   */
  app.get("/orders/:id/receipt", async (req, res) => {
    try {
      const [orders] = await pool.query(
        `SELECT id, table_id, subtotal, vat_amount, total, payment_method, paid_at, created_at, status
         FROM orders WHERE id = ?`,
        [req.params.id]
      );
      if (!orders.length) return res.status(404).json({ error: "Order not found" });

      const [items] = await pool.query(
        `
        SELECT oi.id, oi.menu_name_th, mi.emoji, oi.unit_price, oi.qty, oi.extra_price,
               oi.line_total, GROUP_CONCAT(oit.topping_name SEPARATOR ', ') AS toppings
        FROM order_items oi
        LEFT JOIN menu_items mi ON mi.id = oi.menu_id
        LEFT JOIN order_item_toppings oit ON oi.id = oit.order_item_id
        WHERE oi.order_id = ?
        GROUP BY oi.id
      `,
        [req.params.id]
      );

      const order = orders[0];
      res.json({
        order: {
          id: order.id,
          table_id: order.table_id,
          created_at: order.created_at,
          paid_at: order.paid_at,
          subtotal: parseFloat(order.subtotal),
          vat_amount: parseFloat(order.vat_amount),
          total: parseFloat(order.total),
          payment_method: order.payment_method,
          status: order.status,
        },
        items,
      });
    } catch (err) {
      console.error("❌ Error fetching receipt:", err);
      res.status(500).json({ error: "Server Error" });
    }
  });

  /**
   * @swagger
   * /users:
   *   get:
   *     summary: List users
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Users loaded
   */
  app.get("/users", async (_req, res) => {
    try {
      const [results] = await pool.query(
        "SELECT id, username, full_name AS name, role, is_active, created_at FROM users ORDER BY created_at"
      );
      res.json(results);
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /users/{id}:
   *   delete:
   *     summary: Disable user
   *     tags: [Admin]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User disabled
   */
  app.delete("/users/:id", async (req, res) => {
    try {
      const [result] = await pool.query(
        "UPDATE users SET is_active = FALSE WHERE id = ? AND role != 'admin'",
        [req.params.id]
      );
      if (result.affectedRows !== 1) return res.status(400).send("Cannot delete or not found");
      res.send("Delete successfully");
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /sales:
   *   get:
   *     summary: List sales
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Sales loaded
   */
  app.get("/sales", async (_req, res) => {
    try {
      const [results] = await pool.query("SELECT * FROM sales ORDER BY created_at DESC");
      results.forEach((s) => {
        s.tableId = s.table_id;
        s.orderId = s.order_id;
        s.createdAt = s.created_at;
      });
      res.json(results);
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /sales/today:
   *   get:
   *     summary: Get today's sales
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Today's sales
   */
  app.get("/sales/today", async (_req, res) => {
    try {
      const [results] = await pool.query(
        "SELECT * FROM sales WHERE DATE(created_at) = CURDATE() ORDER BY created_at DESC"
      );
      results.forEach((s) => {
        s.tableId = s.table_id;
        s.orderId = s.order_id;
        s.createdAt = s.created_at;
      });
      res.json(results);
    } catch (err) {
      console.error("❌ Error loading today's sales:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /analytics/payment-methods:
   *   get:
   *     summary: Get payment method analytics
   *     tags: [Admin]
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *     responses:
   *       200:
   *         description: Analytics result
   */
  app.get("/analytics/payment-methods", async (req, res) => {
    const period = req.query.period || "day";
    let daysAgo = 1;
    if (period === "week") daysAgo = 7;
    if (period === "month") daysAgo = 30;

    try {
      const [results] = await pool.query(
        `
        SELECT COALESCE(payment_method, 'unknown') AS payment_method,
               COUNT(*) AS count,
               SUM(total) AS total,
               AVG(total) AS avg
        FROM sales
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY payment_method
        ORDER BY total DESC
      `,
        [daysAgo]
      );
      res.json(results || []);
    } catch (err) {
      console.error("❌ Error loading payment analytics:", err);
      res.status(500).json({ error: "Server Error" });
    }
  });

  /**
   * @swagger
   * /sessions/count:
   *   get:
   *     summary: Get session count
   *     tags: [Admin]
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *     responses:
   *       200:
   *         description: Session count
   */
  app.get("/sessions/count", async (req, res) => {
    const period = req.query.period || "day";
    let daysAgo = 1;
    if (period === "week") daysAgo = 7;
    if (period === "month") daysAgo = 30;

    try {
      const [results] = await pool.query(
        `SELECT COUNT(DISTINCT session_id) AS count FROM customer_sessions
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [daysAgo]
      );
      res.json({ count: results[0]?.count || 0 });
    } catch (err) {
      console.error("❌ Error loading session count:", err);
      res.status(500).send("Server Error");
    }
  });

  /**
   * @swagger
   * /customer-history:
   *   get:
   *     summary: Get customer history by session IDs
   *     tags: [Customer]
   *     parameters:
   *       - in: query
   *         name: sessionIds
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Customer history
   */
  app.get("/customer-history", async (req, res) => {
    const sessionIds = req.query.sessionIds;
    if (!sessionIds) return res.json([]);

    const ids = String(sessionIds).split(",").filter(Boolean);
    if (!ids.length) return res.json([]);
    const placeholders = ids.map(() => "?").join(",");

    try {
      const [orders] = await pool.query(
        `
        SELECT o.id, o.session_id, o.table_id, o.status, o.subtotal, o.vat_amount, o.total,
               o.is_paid, o.payment_method, o.created_at, o.paid_at
        FROM orders o
        WHERE o.session_id IN (${placeholders})
        ORDER BY o.created_at DESC
      `,
        ids
      );
      if (!orders.length) return res.json([]);

      const orderIds = orders.map((o) => o.id);
      const oPlaceholders = orderIds.map(() => "?").join(",");
      const [items] = await pool.query(
        `
        SELECT oi.id, oi.order_id, oi.menu_id, oi.menu_name_th AS name, mi.emoji AS img,
               oi.qty, oi.unit_price AS price, oi.line_total AS totalPrice, oi.special_note AS note
        FROM order_items oi
        LEFT JOIN menu_items mi ON mi.id = oi.menu_id
        WHERE oi.order_id IN (${oPlaceholders})
      `,
        orderIds
      );

      const itemIds = items.map((i) => i.id);
      const toppingMap = {};
      if (itemIds.length) {
        const tPlaceholders = itemIds.map(() => "?").join(",");
        const [toppings] = await pool.query(
          `SELECT order_item_id, topping_name FROM order_item_toppings WHERE order_item_id IN (${tPlaceholders})`,
          itemIds
        );
        toppings.forEach((t) => {
          if (!toppingMap[t.order_item_id]) toppingMap[t.order_item_id] = [];
          toppingMap[t.order_item_id].push(t.topping_name);
        });
      }

      const itemsByOrder = {};
      items.forEach((i) => {
        if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
        itemsByOrder[i.order_id].push({
          name: i.name,
          img: i.img || "🍽️",
          qty: i.qty,
          price: parseFloat(i.price),
          totalPrice: parseFloat(i.totalPrice),
          note: i.note || null,
          toppings: toppingMap[i.id] || [],
        });
      });

      const [reviews] = await pool.query(
        `SELECT session_id, rating, comment FROM reviews WHERE session_id IN (${placeholders})`,
        ids
      );

      res.json(
        orders.map((o) => ({
          id: o.id,
          session_id: o.session_id,
          table_id: o.table_id,
          status: o.status,
          subtotal: parseFloat(o.subtotal),
          vat_amount: parseFloat(o.vat_amount),
          total: parseFloat(o.total),
          is_paid: o.is_paid,
          payment_method: o.payment_method,
          created_at: o.created_at,
          paid_at: o.paid_at,
          items: itemsByOrder[o.id] || [],
          review: reviews.find((r) => r.session_id === o.session_id) || null,
        }))
      );
    } catch (err) {
      console.error("❌ Error loading customer history:", err);
      res.status(500).send("Server Error");
    }
  });

  /**
   * @swagger
   * /customer-payments:
   *   get:
   *     summary: Get customer payments by session IDs
   *     tags: [Customer]
   *     parameters:
   *       - in: query
   *         name: sessions
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Customer payments
   */
  app.get("/customer-payments", async (req, res) => {
    const sessionIds = req.query.sessions?.split(",").filter(Boolean) || [];
    if (!sessionIds.length) return res.json([]);

    const placeholders = sessionIds.map(() => "?").join(",");
    try {
      const [payments] = await pool.query(
        `
        SELECT o.id, COUNT(DISTINCT oi.id) AS item_count, o.total, o.created_at,
               o.payment_method, rt.table_id
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN restaurant_tables rt ON o.table_id = rt.table_id
        WHERE o.session_id IN (${placeholders}) AND o.is_paid = TRUE
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 10
      `,
        sessionIds
      );
      res.json(payments || []);
    } catch (err) {
      console.error("❌ Error loading customer payments:", err);
      res.status(500).json({ error: "Server Error" });
    }
  });
}

module.exports = registerAliasRoutes;
