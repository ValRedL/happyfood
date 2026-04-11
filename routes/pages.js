function registerPageRoutes(app, { path, rootDir }) {
  /**
   * @swagger
   * /:
   *   get:
   *     summary: Open root page
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Returns table page HTML
   */
  app.get("/", (_req, res) => res.sendFile(path.join(rootDir, "views/table.html")));
  /**
   * @swagger
   * /table:
   *   get:
   *     summary: Open table page
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Returns table page HTML
   */
  app.get("/table", (_req, res) => res.sendFile(path.join(rootDir, "views/table.html")));
  /**
   * @swagger
   * /menu-page:
   *   get:
   *     summary: Open menu page
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Returns menu page HTML
   */
  app.get("/menu-page", (_req, res) => res.sendFile(path.join(rootDir, "views/menu.html")));
  /**
   * @swagger
   * /checkout:
   *   get:
   *     summary: Open checkout page
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Returns checkout page HTML
   */
  app.get("/checkout", (_req, res) => res.sendFile(path.join(rootDir, "views/checkout.html")));
  /**
   * @swagger
   * /login:
   *   get:
   *     summary: Open login page
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Returns login page HTML
   */
  app.get("/login", (_req, res) => res.sendFile(path.join(rootDir, "views/login.html")));
  /**
   * @swagger
   * /kitchen:
   *   get:
   *     summary: Open kitchen page
   *     tags: [Cook]
   *     responses:
   *       200:
   *         description: Returns kitchen page HTML
   */
  app.get("/kitchen", (_req, res) => res.sendFile(path.join(rootDir, "views/kitchen.html")));
  /**
   * @swagger
   * /admin:
   *   get:
   *     summary: Open admin page
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Returns admin page HTML
   */
  app.get("/admin", (_req, res) => res.sendFile(path.join(rootDir, "views/admin.html")));
  /**
   * @swagger
   * /admin-tables:
   *   get:
   *     summary: Open admin tables page
   *     tags: [Admin]
   *     responses:
   *       200:
   *         description: Returns admin tables page HTML
   */
  app.get("/admin-tables", (_req, res) => res.sendFile(path.join(rootDir, "views/admin-tables.html")));
  /**
   * @swagger
   * /order-history:
   *   get:
   *     summary: Open order history page
   *     tags: [Customer]
   *     responses:
   *       200:
   *         description: Returns order history page HTML
   */
  app.get("/order-history", (_req, res) => res.sendFile(path.join(rootDir, "views/order-history.html")));
}

module.exports = registerPageRoutes;
