import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    points: {
      type: [String],
      default: [],
    },
  },
  { id: false }
);

const TopicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Topic title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Business", "Pick for You", "Travel"],
      trim: true,
    },
    categorySubtitle: {
      type: String,
      trim: true,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
    },
    termsCount: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      required: [true, "Topic image is required"],
      trim: true,
    },
    languageToLearn: {
      type: String,
      required: [true, "Target language to learn is required"],
      trim: true,
    },
    whatYouWillLearn: {
      type: [String],
      default: [],
    },
    tasks: {
      type: [TaskSchema],
      default: [],
    },
  },
  { timestamps: true }
);

TopicSchema.set("toJSON", {
  virtuals: false,
  id: false,
  transform: (doc, ret) => {
    delete ret.id;
    return ret;
  },
});
TopicSchema.set("toObject", {
  virtuals: false,
  id: false,
  transform: (doc, ret) => {
    delete ret.id;
    return ret;
  },
});

const TopicModel = mongoose.model("Topic", TopicSchema);
export default TopicModel;