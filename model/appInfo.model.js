import mongoose from "mongoose";

const AboutUsSchema = new mongoose.Schema({
  developer: {
    type: String,
    trim: true,
  },
  headquarters: {
    type: String,
    trim: true,
  },
  supportEmail: {
    type: String,
    trim: true,
  },
  website: {
    type: String,
    trim: true,
  },
  businessInquiries: {
    type: String,
    trim: true,
  },
});

const AppInfoSchema = new mongoose.Schema(
  {
    currentVersion: {
      type: String,
      required: [true, "Current version is required"],
      trim: true,
    },
    lastUpdated: {
      type: String,
      required: [true, "Last updated date is required"],
      trim: true,
    },
    releaseNotes: {
      type: [String],
      default: [],
    },
    aboutUs: {
      type: AboutUsSchema,
      required: [true, "About Us details are required"],
    },
    securityPrivacy: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const AppInfoModel = mongoose.model("AppInfo", AppInfoSchema);
export default AppInfoModel;
