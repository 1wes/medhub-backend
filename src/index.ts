import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import environments from "./env-config";
import users from "./routes/users";
import patients from "./routes/patients";
import visits from "./routes/visits";

const app = express();

const { port, origin } = environments;

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

app.listen(port, () => {
  console.log(`[server]: running at port ${port}`);
});
