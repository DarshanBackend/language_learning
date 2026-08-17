import mongoose from "mongoose";

const CompletedLessonSchema = new mongoose.Schema({
  journeyLessonId: {
    type: String,
    required: [true, "Journey Lesson ID is required"],
  },
  status: {
    type: String,
    enum: ["started", "completed"],
    default: "completed",
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
});

const CompletedTopicSchema = new mongoose.Schema({
  topicId: {
    type: String,
    required: [true, "Topic ID is required"],
  },
  completedTasksCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["started", "completed"],
    default: "started",
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
});

const AnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
    unique: true,
  },
  speakingTrendScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  listeningTrendScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  vocabularyTrendScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  completedLessons: [CompletedLessonSchema],
  completedTopics: [CompletedTopicSchema],
}, { timestamps: true });

const AnalyticsModel = mongoose.model("Analytics", AnalyticsSchema);
export default AnalyticsModel;
