import jwt from "jsonwebtoken";
import environments from "../env-config";

const { tokenSecretKey } = environments;

if (!tokenSecretKey) {
  throw new Error("Missing token secret key in env configuration");
}

const generateToken = (
  firstName: string,
  lastName: string,
  email: string,
  uuid: string
): string => {
  return jwt.sign(
    { firstName: firstName, lastName: lastName, email: email, uuid: uuid },
    tokenSecretKey,
    { expiresIn: "1h" }
  );
};

export default generateToken;
