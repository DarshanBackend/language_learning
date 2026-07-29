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
  pronunciationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ChatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
  },
  topicName: {
    type: String,
    required: [true, "Topic name is required"],
    trim: true,
  },
  messages: [MessageSchema],
}, { timestamps: true });

const ChatSessionModel = mongoose.model("ChatSession", ChatSessionSchema);
export default ChatSessionModel;
