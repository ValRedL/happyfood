function registerChefRoutes(app, { pool, fetchOrdersWithItems }) {
  app.get("/chef/orders", async (_req, res) => {
    try {
      const result = await fetchOrdersWithItems(pool);
      res.json(result);
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  app.get("/chef/orders/active", async (_req, res) => {
    try {
      const result = await fetchOrdersWithItems(
        pool,
        "WHERE o.is_paid = FALSE AND o.status NOT IN ('paid','cancelled')"
      );
      res.json(result);
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  app.patch("/chef/orders/:id/status", async (req, res) => {
    const { status } = req.body;
    try {
      const [result] = await pool.query(
        "UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?",
        [status, req.params.id]
      );
      if (result.affectedRows !== 1) return res.status(404).send("Order not found");
      res.send("Status updated");
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });
}

module.exports = registerChefRoutes;
