function registerChefRoutes(app, { pool, fetchOrdersWithItems }) {
  /**
   * @swagger
   * /chef/orders:
   *   get:
   *     summary: List all orders for chef panel
   *     tags: [Cook]
   *     responses:
   *       200:
   *         description: Orders loaded
   */
  app.get("/chef/orders", async (_req, res) => {
    try {
      const result = await fetchOrdersWithItems(pool);
      res.json(result);
    } catch (err) {
      res.status(500).send("Database server error");
    }
  });

  /**
   * @swagger
   * /chef/orders/active:
   *   get:
   *     summary: List active orders for chef panel
   *     tags: [Cook]
   *     responses:
   *       200:
   *         description: Active orders loaded
   */
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

  /**
   * @swagger
   * /chef/orders/{id}/status:
   *   patch:
   *     summary: Update chef order status
   *     tags: [Cook]
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
