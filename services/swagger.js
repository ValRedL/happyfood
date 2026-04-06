const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

function setupSwagger(app) {
  const swaggerOptions = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "HappyFood API",
        version: "1.0.0",
        description: "Restaurant ordering API for HappyFood",
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT || 3000}`,
          description: "Development Server",
        },
      ],
      tags: [
        { name: "Admin", description: "Admin APIs" },
        { name: "Customer", description: "Customer APIs" },
        { name: "Cook", description: "Cook APIs" },
      ],
      components: {
        schemas: {
          User: {
            type: "object",
            properties: {
              id: { type: "string" },
              username: { type: "string" },
              name: { type: "string" },
              role: { type: "string", enum: ["admin", "chef", "customer"] },
            },
          },
        },
      },
    },
    apis: ["./routes/*.js", "./app.js"],
  };

  const swaggerSpec = swaggerJSDoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = {
  setupSwagger,
};
