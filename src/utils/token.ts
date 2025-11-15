import jwt from "jsonwebtoken";
import environments from "../env-config";

const { tokenSecretKey } = environments;

if (!tokenSecretKey) {
  throw new Error("Missing token secret key in env configuration");
}

const generateToken = (
  email: string,
  uuid: string,
  firstName: string,
  lastName: string
): string => {
  return jwt.sign(
    { firstName: firstName, lastName: lastName, email: email, uuid: uuid },
    tokenSecretKey,
    { expiresIn: "1h" }
  );
};

export default generateToken;
