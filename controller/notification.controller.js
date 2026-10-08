import notificationModel from "../model/notification.model.js";
import {
  sendSuccessResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";
import mongoose from "mongoose";


export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await notificationModel
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return sendSuccessResponse(res, "Notifications retrieved successfully", {
      total: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve notifications", error);
  }
};


export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid notification ID");
    }

    const notification = await notificationModel.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return sendNotFoundResponse(res, "Notification not found");
    }

    return sendSuccessResponse(res, "Notification marked as read", notification);
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to mark notification as read", error);
  }
};


export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await notificationModel.updateMany({ userId, isRead: false }, { isRead: true });

    return sendSuccessResponse(res, "All notifications marked as read", null);
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to mark all as read", error);
  }
};


export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid notification ID");
    }

    const notification = await notificationModel.findOneAndUpdate(
      { _id: id, userId },
      { isActive: false },
      { new: true }
    );

    if (!notification) {
      return sendNotFoundResponse(res, "Notification not found");
    }

    return sendSuccessResponse(res, "Notification deleted successfully", null);
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to delete notification", error);
  }
};


export const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const activeCount = await notificationModel.countDocuments({
      userId,
      isActive: true,
    });

    if (activeCount === 0) {
      return sendNotFoundResponse(res, "No notifications found");
    }

    await notificationModel.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    return sendSuccessResponse(res, "All notifications cleared successfully", null);
  } catch (error) {
    console.error("Clear all notifications error:", error);
    return sendErrorResponse(res, 500, "Failed to clear all notifications", error);
  }
};