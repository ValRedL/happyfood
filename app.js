const express = require("express");
const argon2 = require("@node-rs/argon2");
const path = require("path");
const crypto = require("crypto");
const pool = require("./db");

const { MENU_SELECT, MENU_GROUP, formatMenuItem, parseToppings } = require("./services/menu");
const { fetchOrdersWithItems } = require("./services/orders");
const { startAutoMaintenance } = require("./services/maintenance");
const { setupSwagger } = require("./services/swagger");

const registerTestRoutes = require("./routes/test");
const registerAuthRoutes = require("./routes/auth");
const registerAdminRoutes = require("./routes/admin");
const registerChefRoutes = require("./routes/chef");
const registerCustomerRoutes = require("./routes/customer");
const registerAliasRoutes = require("./routes/aliases");
const registerPageRoutes = require("./routes/pages");

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
setupSwagger(app);

const sharedDeps = {
  pool,
  argon2,
  crypto,
  path,
  rootDir: __dirname,
  MENU_SELECT,
  MENU_GROUP,
  formatMenuItem,
  parseToppings,
  fetchOrdersWithItems,
};

registerTestRoutes(app, sharedDeps);
registerAuthRoutes(app, sharedDeps);
registerAdminRoutes(app, sharedDeps);
registerChefRoutes(app, sharedDeps);
registerCustomerRoutes(app, sharedDeps);
registerAliasRoutes(app, sharedDeps);
registerPageRoutes(app, sharedDeps);

startAutoMaintenance(pool);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 HappyFood Server Running
║  🌐 http://localhost:${PORT}

  `);
});
