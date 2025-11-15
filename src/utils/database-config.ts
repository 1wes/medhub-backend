import mysql from "mysql2/promise";
import environments from "../env-config";

const { dbHost, dbName, dbPassword, dbUser } = environments;

export const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
