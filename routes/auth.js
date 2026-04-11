function registerAuthRoutes(app, { pool, argon2 }) {
  /**
   * @swagger
   * /login:
   *   post:
   *     summary: Login user
   *     tags: [Cook]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   */
  app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const [results] = await pool.query(
        "SELECT id, password, full_name AS name, role FROM users WHERE username = ? AND is_active = TRUE",
        [username]
      );
      if (results.length !== 1) return res.status(401).send("Wrong username or password");
      const same = argon2.verifySync(results[0].password, password);
      if (!same) return res.status(401).send("Wrong username or password");
      const { id, name, role } = results[0];
      res.json({ id, name, role });
    } catch (err) {
      console.error("❌ Login Error:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /register:
   *   post:
   *     summary: Register chef account
   *     tags: [Cook]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [username, password]
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *               full_name:
   *                 type: string
   *               cook_id:
   *                 type: string
   *                 description: Optional invite code for chef registration
   *     responses:
   *       200:
   *         description: Registration successful
   *       400:
   *         description: Invalid payload or cook ID
   *       409:
   *         description: Username already exists
   */
  app.post("/register", async (req, res) => {
    const { username, password, full_name, cook_id } = req.body;
    const resolvedName = full_name || cook_id || username;
    if (!username || !password || !resolvedName) {
      return res.status(400).send("กรุณากรอกข้อมูลให้ครบ");
    }

    try {
      if (cook_id) {
        const [inviteRows] = await pool.query(
          "SELECT id FROM cook_ids WHERE id = ? AND enabled = 1",
          [cook_id]
        );
        if (!inviteRows.length) {
          return res.status(400).send("Cook ID ไม่ถูกต้องหรือถูกใช้งานแล้ว");
        }
      }

      const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
      if (rows.length > 0) return res.status(409).send("Username นี้มีผู้ใช้งานแล้ว");

      const hashed = argon2.hashSync(password);
      const chefId = `CHF-${Date.now()}`;

      await pool.query(
        "INSERT INTO users (id, username, password, full_name, role, is_active) VALUES (?,?,?,?,'chef',TRUE)",
        [chefId, username, hashed, resolvedName]
      );

      if (cook_id) {
        await pool.query("UPDATE cook_ids SET enabled = 0 WHERE id = ?", [cook_id]);
      }

      res.json({
        id: chefId,
        username,
        full_name: resolvedName,
        role: "chef",
        message: "ลงทะเบียนสำเร็จ",
      });
    } catch (err) {
      console.error("❌ Register Error:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /invite:
   *   get:
   *     summary: List cook invite codes
   *     tags: [Cook]
   *     responses:
   *       200:
   *         description: Invite list
   */
  app.get("/invite", async (_req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id AS cook_id, id AS name, enabled, created_at FROM cook_ids ORDER BY created_at DESC, id DESC"
      );
      res.json(rows);
    } catch (err) {
      console.error("❌ Invite List Error:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /invite:
   *   post:
   *     summary: Create or enable cook invite code
   *     tags: [Cook]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cook_id]
   *             properties:
   *               cook_id:
   *                 type: string
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Invite created
   */
  app.post("/invite", async (req, res) => {
    const { cook_id, name } = req.body;
    const inviteId = String(cook_id || "").trim();
    if (!inviteId) return res.status(400).send("Cook ID is required");

    try {
      await pool.query(
        "INSERT INTO cook_ids (id, enabled) VALUES (?, 1) ON DUPLICATE KEY UPDATE enabled = 1",
        [inviteId]
      );
      res.status(201).json({ cook_id: inviteId, name: name || inviteId, enabled: 1 });
    } catch (err) {
      console.error("❌ Invite Create Error:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /invite/{cook_id}:
   *   delete:
   *     summary: Disable cook invite code
   *     tags: [Cook]
   *     parameters:
   *       - in: path
   *         name: cook_id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Invite cancelled
   *       404:
   *         description: Invite not found
   */
  app.delete("/invite/:cook_id", async (req, res) => {
    try {
      const [result] = await pool.query(
        "UPDATE cook_ids SET enabled = 0 WHERE id = ?",
        [req.params.cook_id]
      );
      if (result.affectedRows !== 1) return res.status(404).send("Cook ID not found");
      res.send("Invite cancelled");
    } catch (err) {
      console.error("❌ Invite Delete Error:", err);
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /invite/verify/{cook_id}:
   *   get:
   *     summary: Verify cook invite code
   *     tags: [Cook]
   *     parameters:
   *       - in: path
   *         name: cook_id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Invite is valid
   *       404:
   *         description: Invite is invalid
   */
  app.get("/invite/verify/:cook_id", async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id AS cook_id FROM cook_ids WHERE id = ? AND enabled = 1",
        [req.params.cook_id]
      );
      if (!rows.length) return res.status(404).send("Cook ID ไม่ถูกต้อง");
      res.json({ cook_id: rows[0].cook_id, name: rows[0].cook_id });
    } catch (err) {
      console.error("❌ Invite Verify Error:", err);
      res.status(500).send("Database server error");
    }
  });
}

module.exports = registerAuthRoutes;
