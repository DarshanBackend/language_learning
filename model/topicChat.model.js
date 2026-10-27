import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: {
      values: ["user", "tutor"],
      message: "{VALUE} is not a valid sender",
    },
    required: [true, "Sender is required"],
  },
  text: {
    type: String,
    required: [true, "Message text is required"],
    trim: true,
  },
  audioUrl: {
    type: String,
    default: null,
  },
  translation: {
    type: String,
    default: null,
  },
  grammarScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  feedbackText: {
    type: String,
    default: null,
  },
  pronunciationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  pronunciationFeedback: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const TopicChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: [true, "Topic ID is required"],
    },
    topicName: {
      type: String,
      trim: true,
    },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

const TopicChatModel = mongoose.model("TopicChat", TopicChatSchema);
export default TopicChatModel;
