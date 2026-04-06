function registerAdminRoutes(app, { pool, argon2 }) {
  /**
   * @swagger
   * /admin/users:
   *   get:
   *     summary: List all users
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Users loaded
   */
  app.get("/admin/users", async (_req, res) => {
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
   * /admin/users:
   *   post:
   *     summary: Create user
   *     tags: [Admin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password, full_name, role]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *               full_name:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [admin, chef, customer]
   *     responses:
   *       201:
   *         description: User created
   */
  app.post("/admin/users", async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).send("กรุณากรอกข้อมูลให้ครบ");
    }
    if (!["admin", "customer", "chef"].includes(role)) {
      return res.status(400).send("Role ต้องเป็น admin, customer หรือ chef เท่านั้น");
    }

    try {
      const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
      if (rows.length > 0) return res.status(409).send("Username นี้มีผู้ใช้งานแล้ว");

      const hashed = argon2.hashSync(password);
      const userId = `${role.toUpperCase()}-${Date.now()}`;
      await pool.query(
        "INSERT INTO users (id, username, password, full_name, role, is_active) VALUES (?,?,?,?,?,TRUE)",
        [userId, username, hashed, full_name, role]
      );

      res.status(201).json({
        id: userId,
        username,
        full_name,
        role,
        message: "สร้างผู้ใช้งานสำเร็จ",
      });
    } catch (err) {
      console.error("❌ Create User Error:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /admin/users/{id}:
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
  app.delete("/admin/users/:id", async (req, res) => {
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
   * /admin/users/{id}/change-password:
   *   patch:
   *     summary: Change user password
   *     tags: [Admin]
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
   *               new_password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Password changed
   */
  app.patch("/admin/users/:id/change-password", async (req, res) => {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).send("กรุณาระบุ password ใหม่");

    try {
      const hashed = argon2.hashSync(new_password);
      await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, req.params.id]);
      res.send("เปลี่ยน Password สำเร็จ");
    } catch (err) {
      res.status(500).send("Database error");
    }
  });

  /**
   * @swagger
   * /admin/tables:
   *   get:
   *     summary: List admin table overview
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Tables loaded
   */
  app.get("/admin/tables", async (_req, res) => {
    try {
      const [results] = await pool.query(
        "SELECT table_id AS id, status, current_order_id AS order_id, capacity, updated_at FROM restaurant_tables ORDER BY table_id"
      );
      const tables = {};
      results.forEach((t) => {
        tables[t.id] = {
          status: t.status || "vacant",
          order_id: t.order_id || null,
          capacity: t.capacity || 4,
          updated_at: t.updated_at,
        };
      });
      res.json(tables);
    } catch (err) {
      res.status(500).json({ error: "Database server error" });
    }
  });

  /**
   * @swagger
   * /admin/tables:
   *   post:
   *     summary: Create table
   *     tags: [Admin]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               table_id:
   *                 type: string
   *               table_name:
   *                 type: string
   *               capacity:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Table created
   */
  app.post("/admin/tables", async (req, res) => {
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
      res.status(500).send("Server error");
    }
  });

  /**
   * @swagger
   * /admin/sales:
   *   get:
   *     summary: List all sales
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Sales loaded
   */
  app.get("/admin/sales", async (_req, res) => {
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
   * /admin/sales/today:
   *   get:
   *     summary: List today's sales
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Today's sales loaded
   */
  app.get("/admin/sales/today", async (_req, res) => {
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
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /admin/analytics/payment-methods:
   *   get:
   *     summary: Payment analytics for admin dashboard
   *     tags: [Admin]
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *     responses:
   *       200:
   *         description: Analytics loaded
   */
  app.get("/admin/analytics/payment-methods", async (req, res) => {
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
      res.status(500).json({ error: "Server Error" });
    }
  });

  /**
   * @swagger
   * /admin/sessions/count:
   *   get:
   *     summary: Session count summary
   *     tags: [Admin]
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [day, week, month]
   *     responses:
   *       200:
   *         description: Session count loaded
   */
  app.get("/admin/sessions/count", async (req, res) => {
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
      res.status(500).send("Server Error");
    }
  });
}

module.exports = registerAdminRoutes;
