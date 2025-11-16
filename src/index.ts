import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import environments from "./env-config";
import users from "./routes/users";
import patients from "./routes/patients";
import visits from "./routes/visits";
import dashboards from "./routes/dashboard";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

const app = express();

const { port, origin } = environments;

const swaggerConfig = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "MedHub APIs",
      version: "1.0.0",
      description: "REST APIs documentation to consume from Medhub",
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "authorizationToken",
        },
      },
    },
  },

  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJSDoc(swaggerConfig);

app.use(express.json());
app.use(express.urlencoded({ extended: true as boolean }));
app.use(
  cors({
    credentials: true,
    origin: origin,
  })
);
app.use(cookieParser());

// routes
app.use("/api/user", users);
app.use("/api/patients", patients);
app.use("/api/visits", visits);
app.use("/api/dashboards", dashboards);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(port, () => {
  console.log(`[server]: running at  http://localhost:${port}`);
  console.log(`[swagger]: running at http://localhost:${port}/docs`);
});
