import mongoose from "mongoose";

const LearningGoalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Goal title is required"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const LearningGoalModel = mongoose.model("LearningGoal", LearningGoalSchema);
export default LearningGoalModel;
