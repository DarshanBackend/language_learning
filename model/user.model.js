import mongoose from "mongoose";

const OnboardingSchema = new mongoose.Schema({
  languageToLearn: {
    type: String,
    required: [true, "Language to learn is required"],
    trim: true,
  },
  learningLevel: {
    type: String,
    required: [true, "Current learning level is required"],
    trim: true,
  },
  nativeLanguage: {
    type: String,
    required: [true, "Native language is required"],
    trim: true,
  },
  learningGoals: {
    type: [String],
    default: [],
  },
  dailyTimeCommitment: {
    type: String,
    required: [true, "Daily time commitment is required"],
    trim: true,
  },
  bestTimeToStudy: {
    type: String,
    required: [true, "Best time to study is required"],
    trim: true,
  },
  interests: {
    type: [String],
    default: [],
  },
});

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    streakDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPracticedDate: {
      type: Date,
      default: null,
    },
    practiceHistory: {
      type: [String],
      default: [],
    },
    onboarding: {
      type: OnboardingSchema,
      default: null,
    },
    isUserDeleted: {
      type: Boolean,
      default: false,
    },
    reasonForDeletion: {
      type: String,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLogoutAt: {
      type: Date,
      default: null,
    },
    trialStartDate: {
      type: Date,
      default: Date.now,
    },
    trialEndDate: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    isTrialReminderSent: {
      type: Boolean,
      default: false,
    },
    lastDailyReminderSentDate: {
      type: String,
      default: null,
    },
    lastStreakReminderSentDate: {
      type: String,
      default: null,
    },
    subscription: {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subcriptionPlan",
        default: null,
      },
      planTitle: {
        type: String,
        default: null,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: ["inactive", "trial", "active", "expired"],
        default: "trial",
      },
      maxMembers: {
        type: Number,
        default: 1,
      },
      isFamilyMember: {
        type: Boolean,
        default: false,
      },
      familyOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      familyMembers: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          email: {
            type: String,
            lowercase: true,
            trim: true,
          },
          name: {
            type: String,
            default: "",
          },
          addedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", UserSchema);
export default UserModel;