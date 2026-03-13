import jwt from "jsonwebtoken";
import { configDotenv } from "dotenv";

configDotenv({quiet: true});
const jwtSecretKey = process.env.JWT_SECRET;
const tokenExpireTime = process.env.JWT_EXPIRES_IN;

export const generateToken = (userId, roleId) => {
  const token = jwt.sign(
    { id: userId, role_id: roleId },
    jwtSecretKey,
    { expiresIn: tokenExpireTime }
  );

  return token;
};
