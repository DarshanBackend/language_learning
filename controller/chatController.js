import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";
import { transcribeAudio, generateTutorResponse, textToSpeech, translateText, generateConversationHint } from "../services/aiService.js";
import ChatSessionModel from "../model/chatSession.model.js";
import UserModel from "../model/user.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import { sendBadRequestResponse, sendNotFoundResponse } from "../utils/Response.utils.js";

const updateStreak = async (user) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!user.lastPracticedDate) {
    user.streakDays = 1;
  } else {
    const lastPracticed = new Date(user.lastPracticedDate);
    const lastPracticedDay = new Date(
      lastPracticed.getFullYear(),
      lastPracticed.getMonth(),
      lastPracticed.getDate()
    );

    const diffTime = today - lastPracticedDay;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      user.streakDays += 1;
    } else if (diffDays > 1) {
      user.streakDays = 1;
    }
  }

  user.lastPracticedDate = now;
  await user.save();
  return user.streakDays;
};

const updateAnalytics = async (userId, grammarScore) => {
  try {
    let analytics = await AnalyticsModel.findOne({ userId });
    if (!analytics) {
      analytics = new AnalyticsModel({ userId });
    }

    analytics.speakingTrendScore = Math.round(
      analytics.speakingTrendScore * 0.8 + grammarScore * 0.2
    );
    analytics.listeningTrendScore = Math.min(
      100,
      Math.round(analytics.listeningTrendScore * 0.95 + 5)
    );
    analytics.vocabularyTrendScore = Math.round(
      analytics.vocabularyTrendScore * 0.8 + grammarScore * 0.18 + 2
    );

    await analytics.save();
  } catch (error) {
    console.error("Failed to update analytics:", error.message);
  }
};

export const handleVoiceMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const topicName = "General Conversation";

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetLanguage = req.body.targetLanguage || user.onboarding?.languageToLearn || "English";
    const nativeLanguage = req.body.nativeLanguage || user.onboarding?.nativeLanguage || "Spanish";

    let userText = req.body.text || "";
    let userAudioUrl = null;

    if (req.file) {
      try {
        const userAudioUpload = await uploadFile(req.file);
        userAudioUrl = userAudioUpload.url;

        userText = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Failed to process audio file",
          error: err.message,
        });
      }
    }

    if (!userText.trim()) {
      return res.status(400).json({
        success: false,
        message: "No text content or audio voice detected.",
      });
    }

    let userTranslation = "";
    try {
      userTranslation = await translateText(userText, nativeLanguage);
    } catch (err) {
      console.warn("Failed to translate user text:", err.message);
    }

    let chatSession = await ChatSessionModel.findOne({ userId, topicName });
    if (!chatSession) {
      chatSession = new ChatSessionModel({ userId, topicName, messages: [] });
    }

    const conversationHistory = chatSession.messages.slice(-10).map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    const tutorResponse = await generateTutorResponse(
      userText,
      targetLanguage,
      nativeLanguage,
      conversationHistory,
      req.file ? req.file.buffer : null,
      req.file ? req.file.mimetype : null
    );
    const {
      aiReply,
      translation,
      grammarScore,
      feedbackText,
      pronunciationScore,
      pronunciationFeedback
    } = tutorResponse;

    let tutorAudioUrl = null;
    try {
      const tutorAudioBuffer = await textToSpeech(aiReply);
      const tutorFileMock = {
        originalname: `tutor_reply_${Date.now()}.mp3`,
        buffer: tutorAudioBuffer,
        mimetype: "audio/mpeg",
      };

      const tutorAudioUpload = await uploadFile(tutorFileMock);
      tutorAudioUrl = tutorAudioUpload.url;
    } catch (err) {
      console.error("TTS Generation failed, continuing with text only:", err.message);
    }

    const updatedStreak = await updateStreak(user);
    await updateAnalytics(userId, grammarScore);

    chatSession.messages.push({
      sender: "user",
      text: userText,
      audioUrl: userAudioUrl,
      translation: userTranslation,
    });

    chatSession.messages.push({
      sender: "tutor",
      text: aiReply,
      audioUrl: tutorAudioUrl,
      translation,
      grammarScore,
      feedbackText,
      pronunciationScore: req.file ? (pronunciationScore !== undefined ? pronunciationScore : Math.round(grammarScore * 0.95)) : null,
      pronunciationFeedback: req.file ? (pronunciationFeedback !== undefined ? pronunciationFeedback : "Good pronunciation!") : null,
    });

    await chatSession.save();

    return res.status(200).json({
      success: true,
      message: "Tutor responded successfully",
      result: {
        userText,
        userAudioUrl,
        userTranslation,
        aiReply,
        tutorAudioUrl,
        translation,
        grammarScore,
        feedbackText,
        pronunciationScore: req.file ? (pronunciationScore !== undefined ? pronunciationScore : Math.round(grammarScore * 0.95)) : null,
        pronunciationFeedback: req.file ? (pronunciationFeedback !== undefined ? pronunciationFeedback : "Good pronunciation!") : null,
        streakDays: updatedStreak,
        chatSession,
      },
    });
  } catch (error) {
    console.error("Voice message handling error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during voice message processing",
      error: error.message,
    });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const history = await ChatSessionModel.find({ userId }).sort({ updatedAt: -1 });

    if (history.length === 0) {
      return sendNotFoundResponse(res, "No any history found...");
    }

    return res.status(200).json({
      success: true,
      message: "Chat history retrieved successfully",
      result: history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch chat history",
      error: error.message,
    });
  }
};

export const getConversationHint = async (req, res) => {
  try {
    const userId = req.user._id;
    const topicName = "General Conversation";

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const targetLang = req.body.targetLanguage || user.onboarding?.languageToLearn || "English";
    const nativeLang = req.body.nativeLanguage || user.onboarding?.nativeLanguage || "Spanish";
    const learningLevel = user.onboarding?.learningLevel || "Beginner";

    const chatSession = await ChatSessionModel.findOne({ userId, topicName });
    const messages = chatSession ? chatSession.messages.slice(-10) : [];

    const conversationHistory = messages.map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    const hintResult = await generateConversationHint({
      conversationHistory,
      targetLanguage: targetLang,
      nativeLanguage: nativeLang,
      learningLevel,
    });

    return res.status(200).json({
      success: true,
      message: "Conversation hint generated successfully",
      result: {
        hintText: hintResult.hintText,
        hintTranslation: hintResult.hintTranslation,
      },
    });
  } catch (error) {
    console.error("Get Conversation Hint Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate conversation hint",
      error: error.message,
    });
  }
};

export const deleteChatHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, topicName } = req.query;

    let filter = { userId };
    if (sessionId) {
      filter._id = sessionId;
    } else if (topicName) {
      filter.topicName = topicName;
    }

    const sessions = await ChatSessionModel.find(filter);
    if (sessions.length === 0) {
      return sendNotFoundResponse(res, "No chat history found to delete.");
    }

    for (const session of sessions) {
      if (session.messages && session.messages.length > 0) {
        for (const msg of session.messages) {
          if (msg.audioUrl) {
            try {
              await deleteFileFromS3(msg.audioUrl);
            } catch (s3Err) {
              console.warn("S3 chat audio deletion failed:", s3Err.message);
            }
          }
        }
      }
    }

    await ChatSessionModel.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: "Chat history deleted successfully",
    });
  } catch (error) {
    console.error("Delete Chat History Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete chat history",
      error: error.message,
    });
  }
};