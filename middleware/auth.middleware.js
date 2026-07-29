import jwt from "jsonwebtoken";
import UserModel from "../model/user.model.js";
import { sendErrorResponse, sendUnauthorizedResponse, sendNotFoundResponse } from "../utils/Response.utils.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Middleware to authenticate requests via JWT tokens
 */
export const UserAuth = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is not configured in environment variables.");
      return sendErrorResponse(res, 500, "Server configuration error");
    }

    const token =
      req.header("Authorization")?.replace("Bearer ", "") ||
      req.query.token;

    if (!token) {
      return sendUnauthorizedResponse(res, "Access denied. No token provided.");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded._id;

      const user = await UserModel.findById(userId);
      if (!user) {
        return sendNotFoundResponse(res, "User profile not found");
      }

      req.user = user;
      next();
    } catch (err) {
      console.error("⚠️ Token verification failed:", err.message);
      return sendUnauthorizedResponse(res, "Access denied. Invalid token.");
    }
  } catch (error) {
    return sendErrorResponse(res, 500, error.message);
  }
};

/**
 * Middleware to restrict route to admin role
 */
export const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return sendUnauthorizedResponse(res, "Access Denied. Admins only.");
  }
  next();
};