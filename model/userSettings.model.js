import mongoose from "mongoose";

const UserSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
    unique: true,
  },
  notifications: {
    dailyReminderTime: {
      type: String,
      default: "07:30",
    },
    status: {
      type: Boolean,
      default: true,
    },
    streakReminder: {
      type: Boolean,
      default: true,
    },
    challenge: {
      type: Boolean,
      default: true,
    },
    reviewReminder: {
      type: String,
      enum: ["None", "Weekly", "Every 2 weeks", "Monthly", "Every 3 months"],
      default: "None",
    },
    newFeatureUpdates: {
      type: Boolean,
      default: true,
    },
  },
  preferences: {
    soundEffects: {
      type: Boolean,
      default: true,
    },
    hapticFeedback: {
      type: Boolean,
      default: true,
    },
    listeningExercises: {
      type: Boolean,
      default: true,
    },
    friendStreaks: {
      type: Boolean,
      default: false,
    },
  },
}, { timestamps: true });

const UserSettingsModel = mongoose.model("UserSettings", UserSettingsSchema);
export default UserSettingsModel;
