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
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", UserSchema);
export default UserModel;