function registerPageRoutes(app, { path, rootDir }) {
  app.get("/", (_req, res) => res.sendFile(path.join(rootDir, "views/table.html")));
  app.get("/table", (_req, res) => res.sendFile(path.join(rootDir, "views/table.html")));
  app.get("/menu-page", (_req, res) => res.sendFile(path.join(rootDir, "views/menu.html")));
  app.get("/checkout", (_req, res) => res.sendFile(path.join(rootDir, "views/checkout.html")));
  app.get("/login", (_req, res) => res.sendFile(path.join(rootDir, "views/login.html")));
  app.get("/kitchen", (_req, res) => res.sendFile(path.join(rootDir, "views/kitchen.html")));
  app.get("/admin", (_req, res) => res.sendFile(path.join(rootDir, "views/admin.html")));
  app.get("/admin-tables", (_req, res) => res.sendFile(path.join(rootDir, "views/admin-tables.html")));
  app.get("/order-history", (_req, res) => res.sendFile(path.join(rootDir, "views/order-history.html")));
}

module.exports = registerPageRoutes;
