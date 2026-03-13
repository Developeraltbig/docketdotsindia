import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { configDotenv } from "dotenv";
import BlacklistedToken from "../models/BlacklistedToken.js";
import { generateToken } from "../utils/generateToken.js";

configDotenv({ quiet: true });
const environment = process.env.NODE_ENV;
const jwtSecretKey = process.env.JWT_SECRET;
const cookieExpireTime = process.env.JWT_COOKIE_EXPIRES_IN;

const auth = async (req, res, next) => {
  try {
    const token = req?.cookies?.jwt;
    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: No token found",
      });
    }

    const blacklistItem = await BlacklistedToken.findOne({ token });
    if (blacklistItem) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: Invalid token found",
      });
    }

    const decoded = jwt.verify(token, jwtSecretKey);
    if (!decoded) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: Invalid token found",
      });
    }

    const user = await User.findById(decoded.id)
      .select("-password")
      .populate("role_id");
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No user found",
      });
    }

    if (user.role_id.status !== "active") {
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: environment !== "development",
        sameSite: "strict",
      });

      return res.status(403).json({
        status: "error",
        message: "Your role is inactive. Please contact support.",
      });
    }

    if (user.status !== "active") {
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: environment !== "development",
        sameSite: "strict",
      });

      return res.status(403).json({
        status: "error",
        message: "Your account is inactive. Please contact support.",
      });
    }

    req.user = user;
    req.tokenDetails = {
      token,
      expiryAt: decoded.exp,
    };

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    const renewalThreshold = 30 * 60; // 30 minutes in seconds

    if (
      timeUntilExpiry < renewalThreshold &&
      req.originalUrl !== "/api/auth/logout"
    ) {
      try {
        await BlacklistedToken.create({ token, expiryAt: decoded.exp });
      } catch (error) {
        throw new Error("A database error occurred while trying to save data.");
      }

      const newToken = generateToken(user._id);

      const cookieOptions = {
        expires: new Date(Date.now() + cookieExpireTime * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: environment !== "development",
        sameSite: "strict",
      };

      res.cookie("jwt", newToken, cookieOptions);
    }

    next();
  } catch (error) {
    if (
      error.message === "A database error occurred while trying to save data."
    ) {
      next(error);
    } else {
      console.error(error);
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: JWT expired",
      });
    }
  }
};

export default auth;
