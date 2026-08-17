import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema({
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
});

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
      required: [true, "Category/Topic is required"],
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
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
    journeyLessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JourneyLesson",
      default: null,
    },
    tasks: {
      type: [TaskSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// A topic must use exactly one mode - either a linked journey lesson, or its own tasks.
TopicSchema.pre("validate", function (next) {
  const hasLesson = !!this.journeyLessonId;
  const hasTasks = this.tasks && this.tasks.length > 0;

  if (hasLesson && hasTasks) {
    return next(new Error("A Topic can use either journeyLessonId OR tasks, not both."));
  }
  if (!hasLesson && !hasTasks) {
    return next(new Error("A Topic needs either a journeyLessonId (MCQ/speaking flow) or tasks (AI chat flow)."));
  }
  next();
});

TopicSchema.virtual("contentType").get(function () {
  return this.journeyLessonId ? "lesson" : "ai_chat";
});
TopicSchema.set("toObject", { virtuals: true });
TopicSchema.set("toJSON", { virtuals: true });

const TopicModel = mongoose.model("Topic", TopicSchema);
export default TopicModel;