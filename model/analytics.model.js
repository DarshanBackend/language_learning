import mongoose from "mongoose";

const CompletedLessonSchema = new mongoose.Schema({
  lessonId: {
    type: String,
    required: [true, "Lesson ID is required"],
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
}, { timestamps: true });

const AnalyticsModel = mongoose.model("Analytics", AnalyticsSchema);
export default AnalyticsModel;
