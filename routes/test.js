function registerTestRoutes(app, { pool, argon2 }) {
  app.get("/test-db", async (_req, res) => {
    try {
      const [rows] = await pool.query("SELECT 1+1 AS result");
      res.send(`✅ เชื่อมต่อ Database สำเร็จ! result = ${rows[0].result}`);
    } catch (err) {
      console.error("❌ DB Test Error:", err);
      res.status(500).send(`❌ เชื่อมต่อไม่ได้: ${err.message}`);
    }
  });

  app.get("/password/:raw", (req, res) => {
    try {
      const hash = argon2.hashSync(req.params.raw);
      res.send(hash);
    } catch (err) {
      res.status(500).send(`❌ Hash error: ${err.message}`);
    }
  });
}

module.exports = registerTestRoutes;
