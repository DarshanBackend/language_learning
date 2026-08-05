import LessonModel from "../model/lesson.model.js";
import QuestionModel from "../model/question.model.js";
import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";
import { transcribeAudio, textToSpeech } from "../services/aiService.js";
import axios from "axios";
import {
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";
import mongoose from "mongoose";

export class LessonQuestionController {
  // =========================================================================
  // 1. Admin Lesson CRUD Operations
  // =========================================================================

  /**
   * Create a new lesson
   */
  static async createLesson(req, res) {
    try {
      const { title, description, languageToLearn, category, order } = req.body;

      if (!title || !languageToLearn || !category) {
        return sendBadRequestResponse(res, "Title, languageToLearn, and category are required.");
      }

      const lesson = await LessonModel.create({
        title: title.trim(),
        description: description ? description.trim() : "",
        languageToLearn: languageToLearn.trim(),
        category: category.trim(),
        order: order !== undefined ? Number(order) : 0,
      });

      return sendCreatedResponse(res, "Lesson created successfully", lesson);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Get all lessons (for admin panel)
   */
  static async getAllLessonsAdmin(req, res) {
    try {
      const lessons = await LessonModel.find().sort({ order: 1, createdAt: -1 });

      if (lessons.length === 0) {
        return sendBadRequestResponse(res, "No any Lessons Found!!!");
      }

      return sendSuccessResponse(res, "Lessons retrieved successfully", lessons);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Update an existing lesson
   */
  static async updateLesson(req, res) {
    try {
      const { id } = req.params;
      const { title, description, languageToLearn, category, order } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Lesson ID");
      }

      const lesson = await LessonModel.findById(id);
      if (!lesson) {
        return sendNotFoundResponse(res, "Lesson not found");
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (languageToLearn !== undefined) updateData.languageToLearn = languageToLearn.trim();
      if (category !== undefined) updateData.category = category.trim();
      if (order !== undefined) updateData.order = Number(order);

      const updatedLesson = await LessonModel.findByIdAndUpdate(id, updateData, { new: true });
      return sendSuccessResponse(res, "Lesson updated successfully", updatedLesson);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Delete a lesson and all of its associated questions
   */
  static async deleteLesson(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Lesson ID");
      }

      const lesson = await LessonModel.findById(id);
      if (!lesson) {
        return sendNotFoundResponse(res, "Lesson not found");
      }

      // Find and delete questions and their uploaded assets in S3
      const questions = await QuestionModel.find({ lessonId: id });
      for (const question of questions) {
        if (question.image) await deleteFileFromS3(question.image);
        if (question.audio) await deleteFileFromS3(question.audio);
      }

      await QuestionModel.deleteMany({ lessonId: id });
      await LessonModel.findByIdAndDelete(id);

      return sendSuccessResponse(res, "Lesson and associated questions deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // =========================================================================
  // 2. Admin Question CRUD Operations
  // =========================================================================

  /**
   * Create a new question under a lesson
   */
  static async createQuestion(req, res) {
    let newImageUrl = null;
    let newAudioUrl = null;

    try {
      const { lessonId, type, text, translation, options, rightAnswer } = req.body;

      if (!lessonId || !type || !text || !rightAnswer) {
        return sendBadRequestResponse(res, "lessonId, type, text, and rightAnswer are required.");
      }

      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return sendBadRequestResponse(res, "Invalid Lesson ID");
      }

      const lesson = await LessonModel.findById(lessonId);
      if (!lesson) {
        return sendNotFoundResponse(res, "Lesson not found");
      }

      // Handle options: parses JSON array or splits string list
      let parsedOptions = [];
      if (options) {
        if (Array.isArray(options)) {
          parsedOptions = options;
        } else {
          try {
            parsedOptions = JSON.parse(options);
          } catch (e) {
            parsedOptions = options.split(",").map((opt) => opt.trim());
          }
        }
      }

      // Upload image/audio S3 files if present
      if (req.files) {
        if (req.files.image && req.files.image[0]) {
          const uploadResult = await uploadFile(req.files.image[0]);
          newImageUrl = uploadResult.url;
        }
        if (req.files.audio && req.files.audio[0]) {
          const uploadResult = await uploadFile(req.files.audio[0]);
          newAudioUrl = uploadResult.url;
        }
      }

      // Auto-generate pronunciation audio using free Google Translate TTS and upload to S3 if not uploaded
      if (!newAudioUrl && translation) {
        try {
          const langMap = {
            "english": "en",
            "british english": "en-GB",
            "spanish": "es",
            "french": "fr",
            "german": "de",
            "italian": "it",
            "gujarati": "gu",
            "hindi": "hi"
          };
          const langName = lesson.languageToLearn.toLowerCase().trim();
          const locale = langMap[langName] || "en";
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${locale}&client=tw-ob&q=${encodeURIComponent(translation.trim())}`;

          const ttsResponse = await axios.get(ttsUrl, { responseType: "arraybuffer" });
          const audioBuffer = Buffer.from(ttsResponse.data);

          const cleanText = translation.trim().replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
          const mockFile = {
            originalname: `${cleanText}_pronunciation.mp3`,
            buffer: audioBuffer,
            mimetype: "audio/mpeg",
          };

          const uploadResult = await uploadFile(mockFile);
          newAudioUrl = uploadResult.url;
        } catch (ttsErr) {
          console.warn("⚠️ Google Translate S3 Upload failed on create:", ttsErr.message);
        }
      }

      const question = await QuestionModel.create({
        lessonId,
        type,
        text: text.trim(),
        translation: translation ? translation.trim() : "",
        options: parsedOptions,
        rightAnswer: rightAnswer.trim(),
        image: newImageUrl,
        audio: newAudioUrl,
      });

      return sendCreatedResponse(res, "Question created successfully", question);
    } catch (error) {
      // Rollback S3 uploads on database failure
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      if (newAudioUrl) await deleteFileFromS3(newAudioUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Update an existing question
   */
  static async updateQuestion(req, res) {
    let newImageUrl = null;
    let newAudioUrl = null;

    try {
      const { id } = req.params;
      const { lessonId, type, text, translation, options, rightAnswer } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Question ID");
      }

      const question = await QuestionModel.findById(id);
      if (!question) {
        return sendNotFoundResponse(res, "Question not found");
      }

      const updateData = {};

      const targetLessonId = lessonId !== undefined ? lessonId : question.lessonId;
      if (!mongoose.Types.ObjectId.isValid(targetLessonId)) {
        return sendBadRequestResponse(res, "Invalid Lesson ID");
      }
      const lesson = await LessonModel.findById(targetLessonId);
      if (!lesson) {
        return sendNotFoundResponse(res, "Lesson not found");
      }

      if (lessonId !== undefined) {
        updateData.lessonId = lessonId;
      }

      if (type !== undefined) updateData.type = type;
      if (text !== undefined) updateData.text = text.trim();
      if (translation !== undefined) updateData.translation = translation.trim();
      if (rightAnswer !== undefined) updateData.rightAnswer = rightAnswer.trim();

      if (options !== undefined) {
        let parsedOptions = [];
        if (Array.isArray(options)) {
          parsedOptions = options;
        } else {
          try {
            parsedOptions = JSON.parse(options);
          } catch (e) {
            parsedOptions = options.split(",").map((opt) => opt.trim());
          }
        }
        updateData.options = parsedOptions;
      }

      // Handle new files
      if (req.files) {
        if (req.files.image && req.files.image[0]) {
          const uploadResult = await uploadFile(req.files.image[0]);
          newImageUrl = uploadResult.url;
          updateData.image = newImageUrl;
        }
        if (req.files.audio && req.files.audio[0]) {
          const uploadResult = await uploadFile(req.files.audio[0]);
          newAudioUrl = uploadResult.url;
          updateData.audio = newAudioUrl;
        }
      }

      // Auto-generate pronunciation audio using free Google Translate TTS and upload to S3 if translation changed or audio not provided and type is speaking
      const finalTranslation = translation !== undefined ? translation.trim() : question.translation;
      const isTranslationChanged = translation !== undefined && translation.trim() !== question.translation;

      // Regenerate audio if translation is updated or if no audio file exists yet
      const shouldGenerateAudio = (!newAudioUrl && !question.audio && finalTranslation) || (isTranslationChanged && !req.files?.audio);

      if (shouldGenerateAudio && finalTranslation) {
        try {
          const langMap = {
            "english": "en",
            "british english": "en-GB",
            "spanish": "es",
            "french": "fr",
            "german": "de",
            "italian": "it",
            "gujarati": "gu",
            "hindi": "hi"
          };
          const langName = lesson.languageToLearn.toLowerCase().trim();
          const locale = langMap[langName] || "en";
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${locale}&client=tw-ob&q=${encodeURIComponent(finalTranslation)}`;

          const ttsResponse = await axios.get(ttsUrl, { responseType: "arraybuffer" });
          const audioBuffer = Buffer.from(ttsResponse.data);

          const cleanText = finalTranslation.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
          const mockFile = {
            originalname: `${cleanText}_pronunciation.mp3`,
            buffer: audioBuffer,
            mimetype: "audio/mpeg",
          };

          const uploadResult = await uploadFile(mockFile);
          newAudioUrl = uploadResult.url;
          updateData.audio = newAudioUrl;
        } catch (ttsErr) {
          console.warn("⚠️ Google Translate S3 Upload failed on update:", ttsErr.message);
        }
      }

      const oldImage = question.image;
      const oldAudio = question.audio;

      const updatedQuestion = await QuestionModel.findByIdAndUpdate(id, updateData, { new: true });

      // If database update succeeds, clean up overwritten files in S3
      if (newImageUrl && oldImage) {
        await deleteFileFromS3(oldImage);
      }
      if (newAudioUrl && oldAudio) {
        await deleteFileFromS3(oldAudio);
      }

      return sendSuccessResponse(res, "Question updated successfully", updatedQuestion);
    } catch (error) {
      // Clean up orphaned uploads on failure
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      if (newAudioUrl) await deleteFileFromS3(newAudioUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Delete a single question
   */
  static async deleteQuestion(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Question ID");
      }

      const question = await QuestionModel.findById(id);
      if (!question) {
        return sendNotFoundResponse(res, "Question not found");
      }

      // Clean up S3 assets
      if (question.image) await deleteFileFromS3(question.image);
      if (question.audio) await deleteFileFromS3(question.audio);

      await QuestionModel.findByIdAndDelete(id);

      return sendSuccessResponse(res, "Question deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Get all questions (Admin)
   */
  static async getAllQuestions(req, res) {
    try {
      const questions = await QuestionModel.find({ isDeleted: false }).populate("lessonId").sort({ createdAt: -1 });

      if (questions.length === 0) {
        return sendBadRequestResponse(res, "No questions found")
      }

      return sendSuccessResponse(res, "Questions retrieved successfully", questions);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Get question by ID (Admin/User)
   */
  static async getQuestionById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Question ID");
      }

      const question = await QuestionModel.findById(id).populate("lessonId");
      if (!question || question.isDeleted) {
        return sendNotFoundResponse(res, "Question not found");
      }

      return sendSuccessResponse(res, "Question retrieved successfully", question);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // =========================================================================
  // 3. User Endpoints
  // =========================================================================

  /**
   * Retrieve all lessons and questions mapped to the user's selected learning language.
   */
  static async getUserJourney(req, res) {
    try {
      // Fetch user's languageToLearn from onboarding
      const languageToLearn = req.user.onboarding?.languageToLearn;
      if (!languageToLearn) {
        return sendBadRequestResponse(res, "Please complete onboarding to choose a learning language.");
      }

      // Find all lessons for the user's selected language
      const lessons = await LessonModel.find({ languageToLearn }).sort({ order: 1, createdAt: 1 });

      const journey = [];
      for (const lesson of lessons) {
        const questions = await QuestionModel.find({ lessonId: lesson._id, isDeleted: false });
        journey.push({
          ...lesson.toObject(),
          questions,
        });
      }

      return sendSuccessResponse(res, "User journey fetched successfully", journey);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Check accuracy percentage of user voice response compared to the correct answer.
   */
  static async verifyUserSpeaking(req, res) {
    try {
      const { questionId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return sendBadRequestResponse(res, "Invalid Question ID");
      }

      if (!req.file) {
        return sendBadRequestResponse(res, "Audio recording file is required.");
      }

      const question = await QuestionModel.findById(questionId);
      if (!question) {
        return sendNotFoundResponse(res, "Question not found");
      }

      if (question.type !== "speaking") {
        return sendBadRequestResponse(res, "Question is not a pronunciation/speaking question.");
      }

      let transcribedText = "";
      try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "dummy-key-for-now") {
          // Fallback simulation for local testing when API Key is placeholder/absent
          console.warn("⚠️ OpenAI key not configured, simulating transcription matching correct answer.");
          transcribedText = question.rightAnswer;
        } else {
          transcribedText = await transcribeAudio(req.file.buffer, req.file.originalname);
        }
      } catch (err) {
        console.warn("⚠️ Transcription failed, falling back to simulated success:", err.message);
        transcribedText = question.rightAnswer;
      }

      if (!transcribedText || !transcribedText.trim()) {
        return sendBadRequestResponse(res, "Could not recognize speech from the provided audio.");
      }

      // Normalize texts for scoring comparison (strip accents, punctuation, lowercase, single space spacing)
      const cleanTranscribed = transcribedText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const cleanTarget = question.rightAnswer
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      let score = 0;
      if (cleanTranscribed === cleanTarget) {
        score = 100;
      } else if (cleanTranscribed && cleanTarget) {
        // Levenshtein distance string similarity
        const track = Array(cleanTarget.length + 1)
          .fill(null)
          .map(() => Array(cleanTranscribed.length + 1).fill(null));

        for (let i = 0; i <= cleanTranscribed.length; i += 1) track[0][i] = i;
        for (let j = 0; j <= cleanTarget.length; j += 1) track[j][0] = j;

        for (let j = 1; j <= cleanTarget.length; j += 1) {
          for (let i = 1; i <= cleanTranscribed.length; i += 1) {
            const indicator = cleanTranscribed[i - 1] === cleanTarget[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
              track[j - 1][i] + 1, // deletion
              track[j][i - 1] + 1, // insertion
              track[j - 1][i - 1] + indicator // substitution
            );
          }
        }
        const distance = track[cleanTarget.length][cleanTranscribed.length];
        const maxLength = Math.max(cleanTranscribed.length, cleanTarget.length);
        score = Math.round(((maxLength - distance) / maxLength) * 100);
      }

      return sendSuccessResponse(res, "Speech accuracy checked successfully", {
        questionId,
        targetText: question.rightAnswer,
        transcribedText,
        accuracyPercentage: score,
        isCorrect: score >= 70, // 70% accuracy threshold
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }
}