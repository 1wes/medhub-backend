import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import environments from "../env-config";

const { tokenSecretKey } = environments;

let verifyToken = (req: Request, res: Response, next: NextFunction): any => {
  let authCookie: string | undefined = req.cookies.authorizationToken;

  if (!authCookie) {
    return res.status(403).json({ message: "You cannot access this resource" });
  }

  try {
    const decoded = jwt.verify(
      authCookie as string,
      tokenSecretKey as string | Buffer
    );

    req.statusCode = 200;

    req.tokenInfo = decoded;

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Provide valid authentication credentials." });
  }
};
export default verifyToken;
