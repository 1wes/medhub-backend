import express, { Request, Response, NextFunction } from "express";
import { hashPassword, comparePassword } from "../utils/password";
import uuid from "../utils/uuid";
import generateToken from "../utils/token";
import verifyToken from "../middleware/cookie-validation";
import bcrypt from "bcrypt";
import { pool as db } from "../utils/database-config";

const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  next();
});

router.post("/register", async (req: Request, res: Response) => {
  const { firstName, lastName, email, dialCode, phoneNumber, repeatPassword } =
    req.body;

  try {
    const sql = `
      INSERT INTO users (uuid, first_name, last_name, email, password_hash, salt)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    let userId = uuid();
    let salt = await bcrypt.genSalt(10);
    const hashedPassword = await hashPassword(repeatPassword, salt);
    await db.execute(sql, [
      userId,
      firstName,
      lastName,
      email,
      hashedPassword,
      salt,
    ]);

    return res.status(201).json({ message: "User Registered" });
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message:
          "User with this email already exists. Retry using a different one",
      });
    }
    console.error("Registration error:", err);
    return res
      .status(500)
      .json({ message: "We encountered a problem. Retry in a few" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const sql = `SELECT first_name, last_name, email, uuid, password_hash FROM users WHERE email=? LIMIT 1`;

    const [rows] = await db.execute(sql, [email]);

    const users = rows as any;

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(403).json({ message: "Invalid credentials." });
    }

    const token = generateToken(
      user.first_name,
      user.last_name,
      user.email,
      user.uuid
    );

    res.cookie("authorizationToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "We encountered a problem. Retry in a few" });
  }
});

router.get("/logout", (req: Request, res: Response) => {
  res.clearCookie("authorizationToken", { domain: "localhost", path: "/" });

  res.sendStatus(200);
});

router.get("/check-token", verifyToken, (req: Request, res: Response) => {
  const { tokenInfo } = req;

  res.status(200).json({ message: "Logout successful" });
});
export default router;
