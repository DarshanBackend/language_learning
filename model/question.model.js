import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: [true, "Lesson ID is required"],
    },
    type: {
      type: String,
      required: [true, "Question type is required"],
      enum: ["mcq", "speaking", "response"],
    },
    text: {
      type: String,
      required: [true, "Question text or prompt is required"],
      trim: true,
    },
    translation: {
      type: String,
      trim: true,
      default: "",
    },
    options: {
      type: [String],
      default: [],
    },
    rightAnswer: {
      type: String,
      required: [true, "Right answer is required"],
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    audio: {
      type: String,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const QuestionModel = mongoose.model("Question", QuestionSchema);
export default QuestionModel;