import mongoose from "mongoose";

const JourneyLessonSchema = new mongoose.Schema(
  {
    journeyTopicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JourneyTopic",
      default: null, // Null indicates a standalone lesson used in topics or elsewhere
    },
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
    lessonNumber: {
      type: Number,
      default: 0,
    },
    translations: {
      type: Map,
      of: new mongoose.Schema({
        title: String,
        description: String,
        category: String,
      }, { _id: false }),
      default: {},
    },
  },
  { timestamps: true }
);

const JourneyLessonModel = mongoose.model("JourneyLesson", JourneyLessonSchema);
export default JourneyLessonModel;