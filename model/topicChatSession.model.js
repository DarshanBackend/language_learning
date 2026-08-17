import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["ai", "user"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    translation: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      default: null,
    },
    relatedTaskIndex: {
      type: Number,
      default: null, // which task (by index in Topic.tasks) this message belongs to
    },
  },
  { timestamps: true }
);

const TaskProgressSchema = new mongoose.Schema({
  taskIndex: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

const TopicChatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },
    messages: {
      type: [ChatMessageSchema],
      default: [],
    },
    taskProgress: {
      type: [TaskProgressSchema],
      default: [],
    },
    currentTaskIndex: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
  },
  { timestamps: true }
);

TopicChatSessionSchema.index({ userId: 1, topicId: 1 }, { unique: true });

const TopicChatSessionModel = mongoose.model("TopicChatSession", TopicChatSessionSchema);
export default TopicChatSessionModel;