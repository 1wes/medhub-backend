import dotenv from "dotenv";

dotenv.config();

const {
  PORT,
  ORIGIN,
  TOKEN_SECRET_KEY,
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_USER,
} = process.env;

const environments = {
  port: PORT,
  origin: ORIGIN,
  tokenSecretKey: TOKEN_SECRET_KEY,
  dbHost: DB_HOST,
  dbName: DB_NAME,
  dbPassword: DB_PASSWORD,
  dbUser: DB_USER,
};
export default environments;
