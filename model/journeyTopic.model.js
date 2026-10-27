import mongoose from "mongoose";

const JourneyTopicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Journey topic title is required"],
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
      required: [true, "Category is required"],
      trim: true,
    },
    topicNumber: {
      type: Number,
      default: 0,
    },
    points: {
      type: [String],
      default: [],
    },
    translations: {
      type: Map,
      of: new mongoose.Schema({
        title: String,
        description: String,
        category: String,
        points: [String],
      }, { _id: false }),
      default: {},
    },
  },
  { timestamps: true }
);

const JourneyTopicModel = mongoose.model("JourneyTopic", JourneyTopicSchema);
export default JourneyTopicModel;