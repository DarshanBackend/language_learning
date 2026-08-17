import { uploadFile } from "../middleware/imageupload.js";
import { transcribeAudio, generateTutorResponse, textToSpeech } from "../services/aiService.js";
import ChatSessionModel from "../model/chatSession.model.js";
import UserModel from "../model/user.model.js";
import AnalyticsModel from "../model/analytics.model.js";

/**
 * Update user study streak based on last practice date
 * @param {object} user - User document
 * @returns {Promise<number>} - Updated streak days
 */
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
    // If diffDays === 0, user already practiced today; streak is unchanged.
  }

  user.lastPracticedDate = now;
  await user.save();
  return user.streakDays;
};

/**
 * Update speaking and vocabulary analytics based on chat scores
 * @param {string} userId
 * @param {number} grammarScore
 */
const updateAnalytics = async (userId, grammarScore) => {
  try {
    let analytics = await AnalyticsModel.findOne({ userId });
    if (!analytics) {
      analytics = new AnalyticsModel({ userId });
    }

    // Adjust trend scores smoothly
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
    console.error("⚠️ Failed to update analytics:", error.message);
  }
};

export const handleVoiceMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { topicName = "General Conversation", targetLanguage = "English" } = req.body;

    let userText = req.body.text || "";
    let userAudioUrl = null;

    // 1. Transcribe audio if file is uploaded
    if (req.file) {
      try {
        // Upload user audio to S3 first
        const userAudioUpload = await uploadFile(req.file);
        userAudioUrl = userAudioUpload.url;

        // Transcribe voice to text
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

    // 2. Send transcription/text to GPT-4o for tutoring response
    const tutorResponse = await generateTutorResponse(userText, targetLanguage);
    const { aiReply, translation, grammarScore, feedbackText } = tutorResponse;

    // 3. Generate voice audio for the tutor response via TTS
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
      console.error("⚠️ TTS Generation failed, continuing with text only:", err.message);
    }

    // 4. Update user study streak and analytics
    const user = await UserModel.findById(userId);
    const updatedStreak = await updateStreak(user);
    await updateAnalytics(userId, grammarScore);

    // 5. Save discussion details to MongoDB
    let chatSession = await ChatSessionModel.findOne({ userId, topicName });
    if (!chatSession) {
      chatSession = new ChatSessionModel({ userId, topicName, messages: [] });
    }

    // Add user message
    chatSession.messages.push({
      sender: "user",
      text: userText,
      audioUrl: userAudioUrl,
    });

    // Add tutor message
    chatSession.messages.push({
      sender: "tutor",
      text: aiReply,
      audioUrl: tutorAudioUrl,
      translation,
      grammarScore,
      pronunciationScore: req.file ? Math.round(grammarScore * 0.95) : null, // estimated voice score
    });

    await chatSession.save();

    // 6. Return response
    return res.status(200).json({
      success: true,
      message: "Tutor responded successfully",
      result: {
        userText,
        userAudioUrl,
        aiReply,
        tutorAudioUrl,
        translation,
        grammarScore,
        feedbackText,
        streakDays: updatedStreak,
        chatSession,
      },
    });
  } catch (error) {
    console.error("❌ Voice message handling error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during voice message processing",
      error: error.message,
    });
  }
};

/**
 * Retrieve chat sessions of the logged-in user
 */
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const history = await ChatSessionModel.find({ userId }).sort({ updatedAt: -1 });

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
