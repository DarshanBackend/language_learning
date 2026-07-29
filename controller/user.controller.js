import UserModel from "../model/user.model.js";
import UserSettingsModel from "../model/userSettings.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import ChatSessionModel from "../model/chatSession.model.js";
import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";

/**
 * Get logged-in user profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let settings = await UserSettingsModel.findOne({ userId: req.user._id });
    if (!settings) {
      settings = await UserSettingsModel.create({ userId: req.user._id });
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      result: {
        ...user.toObject(),
        settings,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Update user profile (name, phone, language level, avatar)
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email, phone } = req.body;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) {
      user.name = name.trim();
    }

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = await UserModel.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: "Email is already registered by another account" });
      }
      user.email = email.toLowerCase().trim();
    }

    if (phone !== undefined) {
      user.phone = phone ? phone.trim() : null;
    }

    // Handle avatar upload if file provided
    if (req.file) {
      try {
        const uploadResult = await uploadFile(req.file);
        const oldAvatar = user.avatarUrl;
        user.avatarUrl = uploadResult.url;

        // Clean up old avatar from S3
        if (oldAvatar) {
          await deleteFileFromS3(oldAvatar);
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Failed to upload avatar",
          error: err.message,
        });
      }
    }

    await user.save();

    let settings = await UserSettingsModel.findOne({ userId });
    if (!settings) {
      settings = await UserSettingsModel.create({ userId });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      result: {
        ...user.toObject(),
        settings,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get user settings & preferences
 */
export const getSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    let settings = await UserSettingsModel.findOne({ userId });

    if (!settings) {
      settings = await UserSettingsModel.create({ userId });
    }

    return res.status(200).json({
      success: true,
      message: "UserSettings retrieved successfully",
      result: settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Update user settings & preferences
 */
export const updateSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notifications, preferences } = req.body;

    let settings = await UserSettingsModel.findOne({ userId });
    if (!settings) {
      settings = new UserSettingsModel({ userId });
    }

    if (notifications) {
      if (notifications.dailyReminderTime !== undefined) {
        settings.notifications.dailyReminderTime = notifications.dailyReminderTime;
      }
      if (notifications.status !== undefined) {
        settings.notifications.status = notifications.status;
      }
      if (notifications.streakReminder !== undefined) {
        settings.notifications.streakReminder = notifications.streakReminder;
      }
      if (notifications.challenge !== undefined) {
        settings.notifications.challenge = notifications.challenge;
      }
      if (notifications.reviewReminder !== undefined) {
        settings.notifications.reviewReminder = notifications.reviewReminder;
      }
      if (notifications.newFeatureUpdates !== undefined) {
        settings.notifications.newFeatureUpdates = notifications.newFeatureUpdates;
      }
    }

    if (preferences) {
      if (preferences.soundEffects !== undefined) {
        settings.preferences.soundEffects = preferences.soundEffects;
      }
      if (preferences.hapticFeedback !== undefined) {
        settings.preferences.hapticFeedback = preferences.hapticFeedback;
      }
      if (preferences.listeningExercises !== undefined) {
        settings.preferences.listeningExercises = preferences.listeningExercises;
      }
      if (preferences.friendStreaks !== undefined) {
        settings.preferences.friendStreaks = preferences.friendStreaks;
      }
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "UserSettings updated successfully",
      result: settings,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Get user analytics
 */
export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    let analytics = await AnalyticsModel.findOne({ userId });

    if (!analytics) {
      analytics = await AnalyticsModel.create({ userId });
    }

    return res.status(200).json({
      success: true,
      message: "Analytics retrieved successfully",
      result: analytics,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Record a completed lesson in analytics
 */
export const recordCompletedLesson = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lessonId, status = "completed", score = 0 } = req.body;

    if (!lessonId) {
      return res.status(400).json({ success: false, message: "Lesson ID is required" });
    }

    let analytics = await AnalyticsModel.findOne({ userId });
    if (!analytics) {
      analytics = new AnalyticsModel({ userId });
    }

    // Add completed lesson
    analytics.completedLessons.push({ lessonId, status, score });

    // Smoothly adjust trend scores
    analytics.listeningTrendScore = Math.min(
      100,
      Math.round(analytics.listeningTrendScore * 0.9 + score * 0.1)
    );
    analytics.vocabularyTrendScore = Math.min(
      100,
      Math.round(analytics.vocabularyTrendScore * 0.92 + 8)
    );

    await analytics.save();

    return res.status(200).json({
      success: true,
      message: "Lesson result recorded successfully",
      result: analytics,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

/**
 * Delete account and clean up database
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Remove user profile
    await UserModel.findByIdAndDelete(userId);

    // Remove secondary information
    await UserSettingsModel.findOneAndDelete({ userId });
    await AnalyticsModel.findOneAndDelete({ userId });
    await ChatSessionModel.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      message: "User account and all related learning history deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};