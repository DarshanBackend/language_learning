import mongoose from "mongoose";

const privacyPolicySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    points: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const privacyPolicyModel = mongoose.model("privacyPolicy", privacyPolicySchema);
export default privacyPolicyModel;
