import mongoose from "mongoose";

const LessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    languageToLearn: {
      type: String,
      required: [true, "Target language to learn is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category/Topic is required"],
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const LessonModel = mongoose.model("Lesson", LessonSchema);
export default LessonModel;