import mongoose from "mongoose";

const JourneyQuestionSchema = new mongoose.Schema(
  {
    journeyLessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JourneyLesson",
      required: [true, "Journey Lesson ID is required"],
    },
    type: {
      type: String,
      required: [true, "Question type is required"],
      enum: ["mcq", "speaking", "response"],
    },
    text: {
      type: String,
      trim: true,
      default: "",
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
      trim: true,
      default: "",
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
    translations: {
      type: Map,
      of: new mongoose.Schema({
        text: String,
        rightAnswer: String,
        options: [String],
        audio: String,
      }, { _id: false }),
      default: {},
    },
  },
  { timestamps: true }
);

const JourneyQuestionModel = mongoose.model("JourneyQuestion", JourneyQuestionSchema);
export default JourneyQuestionModel;
