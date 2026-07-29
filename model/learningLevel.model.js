import mongoose from "mongoose";

const LearningLevelSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Level title is required"],
      unique: true,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      required: [true, "Level description is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

const LearningLevelModel = mongoose.model("LearningLevel", LearningLevelSchema);
export default LearningLevelModel;
