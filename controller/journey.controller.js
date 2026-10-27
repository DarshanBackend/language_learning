import JourneyTopicModel from "../model/journeyTopic.model.js";
import JourneyLessonModel from "../model/journeyLesson.model.js";
import JourneyQuestionModel from "../model/journeyQuestion.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import TopicModel from "../model/topic.model.js";
import LanguageToLearnModel from "../model/languageToLearn.model.js";
import UserModel from "../model/user.model.js";
import { recordUserPractice } from "./user.controller.js";
import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";
import { transcribeAudio, translateText, translateArray } from "../services/aiService.js";
import axios from "axios";
import {
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";
import mongoose from "mongoose";

export class JourneyController {




  static async createJourneyTopic(req, res) {
    try {
      const { title, description, category, topicNumber, points } = req.body;

      if (!title || !category) {
        return sendBadRequestResponse(res, "Title and category are required.");
      }


      const existing = await JourneyTopicModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
        languageToLearn: { $regex: new RegExp(`^english$`, "i") },
      });
      if (existing) {
        return sendBadRequestResponse(res, `A journey topic with the title "${title.trim()}" already exists.`);
      }

      const translations = {};


      const languages = await LanguageToLearnModel.find();
      for (const lang of languages) {
        const langName = lang.title.trim();
        if (langName.toLowerCase() === "english") {
          continue; 
        }


        const transTitle = await translateText(title, langName);
        const transDesc = description ? await translateText(description, langName) : "";
        const transCategory = await translateText(category, langName);
        const transPoints = Array.isArray(points) && points.length > 0
          ? await translateArray(points.map(p => p.trim()), langName)
          : [];

        translations[langName.toLowerCase()] = {
          title: transTitle,
          description: transDesc,
          category: transCategory,
          points: transPoints,
        };
      }

      const topic = await JourneyTopicModel.create({
        title: title.trim(),
        description: description ? description.trim() : "",
        languageToLearn: "english",
        category: category.trim(),
        topicNumber: topicNumber !== undefined ? Number(topicNumber) : 0,
        points: Array.isArray(points) ? points.map(p => p.trim()) : [],
        translations,
      });

      return sendCreatedResponse(res, "Journey topic created successfully with all translations", topic);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getAllJourneyTopicsAdmin(req, res) {
    try {
      const topics = await JourneyTopicModel.find().sort({ topicNumber: 1 });
      if (topics.length === 0) {
        return sendBadRequestResponse(res, "No journey topics found.");
      }
      return sendSuccessResponse(res, "Journey topics retrieved successfully", topics);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateJourneyTopic(req, res) {
    try {
      const { id } = req.params;
      const { title, description, languageToLearn, category, topicNumber, points } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Topic ID");
      }

      const topic = await JourneyTopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Journey topic not found");
      }

      const queryTitle = title !== undefined ? title.trim() : topic.title;
      const queryLang = languageToLearn !== undefined ? languageToLearn.trim() : topic.languageToLearn;

      if (title !== undefined || languageToLearn !== undefined) {
        const existing = await JourneyTopicModel.findOne({
          _id: { $ne: id },
          title: { $regex: new RegExp(`^${queryTitle}$`, "i") },
          languageToLearn: { $regex: new RegExp(`^${queryLang}$`, "i") },
        });
        if (existing) {
          return sendBadRequestResponse(res, `Another journey topic with the title "${queryTitle}" already exists for language "${queryLang}".`);
        }
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (languageToLearn !== undefined) updateData.languageToLearn = languageToLearn.trim();
      if (category !== undefined) updateData.category = category.trim();
      if (topicNumber !== undefined) updateData.topicNumber = Number(topicNumber);
      if (points !== undefined) {
        updateData.points = Array.isArray(points) ? points.map(p => p.trim()) : [];
      }

      const updated = await JourneyTopicModel.findByIdAndUpdate(id, updateData, { new: true });
      return sendSuccessResponse(res, "Journey topic updated successfully", updated);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteJourneyTopic(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Topic ID");
      }

      const topic = await JourneyTopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Journey topic not found");
      }


      const lessons = await JourneyLessonModel.find({ journeyTopicId: id });
      for (const lesson of lessons) {
        const questions = await JourneyQuestionModel.find({ journeyLessonId: lesson._id });
        for (const question of questions) {
          if (question.image) await deleteFileFromS3(question.image);
          if (question.audio) await deleteFileFromS3(question.audio);
        }
        await JourneyQuestionModel.deleteMany({ journeyLessonId: lesson._id });
      }

      await JourneyLessonModel.deleteMany({ journeyTopicId: id });
      await JourneyTopicModel.findByIdAndDelete(id);

      return sendSuccessResponse(res, "Journey topic and associated lessons/questions deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }





  static async createJourneyLesson(req, res) {
    try {
      const { journeyTopicId, title, description, category, lessonNumber } = req.body;

      if (!title || !category) {
        return sendBadRequestResponse(res, "Title and category are required.");
      }

      if (journeyTopicId && !mongoose.Types.ObjectId.isValid(journeyTopicId)) {
        return sendBadRequestResponse(res, "Invalid Journey Topic ID");
      }

      if (journeyTopicId) {
        const topic = await JourneyTopicModel.findById(journeyTopicId);
        if (!topic) {
          return sendNotFoundResponse(res, "Journey topic not found");
        }
      }


      const existing = await JourneyLessonModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
        languageToLearn: { $regex: new RegExp(`^english$`, "i") },
      });
      if (existing) {
        return sendBadRequestResponse(res, `A journey lesson with the title "${title.trim()}" already exists.`);
      }

      let imageUrl = "";
      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        imageUrl = uploadResult.url;
      }

      const translations = {};


      const languages = await LanguageToLearnModel.find();
      for (const lang of languages) {
        const langName = lang.title.trim();
        if (langName.toLowerCase() === "english") {
          continue; 
        }


        const transTitle = await translateText(title, langName);
        const transDesc = description ? await translateText(description, langName) : "";
        const transCategory = await translateText(category, langName);

        translations[langName.toLowerCase()] = {
          title: transTitle,
          description: transDesc,
          category: transCategory,
        };
      }

      const lesson = await JourneyLessonModel.create({
        journeyTopicId: journeyTopicId || null,
        title: title.trim(),
        description: description ? description.trim() : "",
        languageToLearn: "english",
        category: category.trim(),
        lessonNumber: lessonNumber !== undefined ? Number(lessonNumber) : 0,
        image: imageUrl,
        translations,
      });

      return sendCreatedResponse(res, "Journey lesson created successfully with all translations", lesson);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getAllJourneyLessonsAdmin(req, res) {
    try {
      const lessons = await JourneyLessonModel.find().populate("journeyTopicId");
      if (lessons.length === 0) {
        return sendBadRequestResponse(res, "No journey lessons found.");
      }

      const targetUserId = req.query.userId || req.user?._id;
      const analytics = await AnalyticsModel.findOne({ userId: targetUserId });

      const mappedLessons = [];
      for (const lesson of lessons) {
        const mapped = await JourneyController.mapAndHealLesson(lesson, null, null);

        const completedCount = analytics
          ? analytics.completedLessons.filter((cl) => {
            const targetId = cl.journeyLessonId || cl.lessonId;
            return targetId?.toString() === mapped._id.toString() && cl.status === "completed";
          }).length
          : 0;

        mappedLessons.push({
          ...mapped,
          isCompleted: completedCount > 0
        });
      }

      return sendSuccessResponse(res, "Journey lessons retrieved successfully", mappedLessons);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateJourneyLesson(req, res) {
    try {
      const { id } = req.params;
      const { journeyTopicId, title, description, languageToLearn, category, lessonNumber } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Lesson ID");
      }

      const lesson = await JourneyLessonModel.findById(id);
      if (!lesson) {
        return sendNotFoundResponse(res, "Journey lesson not found");
      }

      if (journeyTopicId !== undefined) {
        if (journeyTopicId) {
          if (!mongoose.Types.ObjectId.isValid(journeyTopicId)) {
            return sendBadRequestResponse(res, "Invalid Journey Topic ID");
          }
          const topic = await JourneyTopicModel.findById(journeyTopicId);
          if (!topic) {
            return sendNotFoundResponse(res, "Journey topic not found");
          }
        }
      }

      const queryTitle = title !== undefined ? title.trim() : lesson.title;
      const queryLang = languageToLearn !== undefined ? languageToLearn.trim() : lesson.languageToLearn;

      if (title !== undefined || languageToLearn !== undefined) {
        const existing = await JourneyLessonModel.findOne({
          _id: { $ne: id },
          title: { $regex: new RegExp(`^${queryTitle}$`, "i") },
          languageToLearn: { $regex: new RegExp(`^${queryLang}$`, "i") },
        });
        if (existing) {
          return sendBadRequestResponse(res, `Another journey lesson with the title "${queryTitle}" already exists for language "${queryLang}".`);
        }
      }

      let imageUrl = lesson.image;
      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        imageUrl = uploadResult.url;


        if (lesson.image) {
          try {
            await deleteFileFromS3(lesson.image);
          } catch (err) {
            console.warn("Failed to delete old lesson image:", err.message);
          }
        }
      } else if (req.body.image === "" || req.body.image === "null" || req.body.image === null) {
        imageUrl = "";
        if (lesson.image) {
          try {
            await deleteFileFromS3(lesson.image);
          } catch (err) {
            console.warn("Failed to delete old lesson image:", err.message);
          }
        }
      }

      const updateData = {};
      if (journeyTopicId !== undefined) updateData.journeyTopicId = journeyTopicId || null;
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (languageToLearn !== undefined) updateData.languageToLearn = languageToLearn.trim();
      if (category !== undefined) updateData.category = category.trim();
      if (lessonNumber !== undefined) updateData.lessonNumber = Number(lessonNumber);
      if (req.file || req.body.image !== undefined) updateData.image = imageUrl;

      const updated = await JourneyLessonModel.findByIdAndUpdate(id, updateData, { new: true });
      return sendSuccessResponse(res, "Journey lesson updated successfully", updated);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteJourneyLesson(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Lesson ID");
      }

      const lesson = await JourneyLessonModel.findById(id);
      if (!lesson) {
        return sendNotFoundResponse(res, "Journey lesson not found");
      }


      const questions = await JourneyQuestionModel.find({ journeyLessonId: id });
      for (const question of questions) {
        if (question.image) await deleteFileFromS3(question.image);
        if (question.audio) await deleteFileFromS3(question.audio);
      }

      await JourneyQuestionModel.deleteMany({ journeyLessonId: id });


      if (lesson.image) {
        try {
          await deleteFileFromS3(lesson.image);
        } catch (err) {
          console.warn("Failed to delete lesson image:", err.message);
        }
      }

      await JourneyLessonModel.findByIdAndDelete(id);

      return sendSuccessResponse(res, "Journey lesson and associated questions deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }





  static async createJourneyQuestion(req, res) {
    let newImageUrl = null;
    let newAudioUrl = null;

    try {
      const { journeyLessonId, type, text, translation, options, rightAnswer } = req.body;

      const hasImage = req.files && req.files.image && req.files.image[0];
      const isTextRequired = !(type === "mcq" && hasImage);

      if (!journeyLessonId || !type || (isTextRequired && !text)) {
        return sendBadRequestResponse(res, "journeyLessonId, type, and text are required.");
      }

      if (type !== "speaking" && !rightAnswer) {
        return sendBadRequestResponse(res, "rightAnswer is required for this question type.");
      }

      if (!mongoose.Types.ObjectId.isValid(journeyLessonId)) {
        return sendBadRequestResponse(res, "Invalid Journey Lesson ID");
      }

      const lesson = await JourneyLessonModel.findById(journeyLessonId);
      if (!lesson) {
        return sendNotFoundResponse(res, "Journey lesson not found");
      }

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

      if (req.files) {
        if (type === "mcq" && req.files.image && req.files.image[0]) {
          const uploadResult = await uploadFile(req.files.image[0]);
          newImageUrl = uploadResult.url;
        }
        if (type === "speaking" && req.files.audio && req.files.audio[0]) {
          const uploadResult = await uploadFile(req.files.audio[0]);
          newAudioUrl = uploadResult.url;
        }
      }


      if (type === "speaking" && !newAudioUrl && text) {
        try {
          const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text.trim())}`;
          const ttsResponse = await axios.get(ttsUrl, { responseType: "arraybuffer" });
          const audioBuffer = Buffer.from(ttsResponse.data);

          const cleanText = text.trim().replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
          const mockFile = {
            originalname: `${cleanText}_pronunciation.mp3`,
            buffer: audioBuffer,
            mimetype: "audio/mpeg",
          };

          const uploadResult = await uploadFile(mockFile);
          newAudioUrl = uploadResult.url;
        } catch (ttsErr) {
          console.warn("Google Translate S3 Upload failed on create:", ttsErr.message);
        }
      }

      const translations = {};


      const languages = await LanguageToLearnModel.find();
      for (const lang of languages) {
        const langName = lang.title.trim();
        if (langName.toLowerCase() === "english") {
          continue; 
        }

        let transText = "";
        let transRightAnswer = "";
        let transOptions = [];
        let targetAudioUrl = null;

        if (type === "speaking") {
          transText = await translateText(text, langName);
          transRightAnswer = "";


          try {
            const langMap = {
              "english": "en",
              "american english": "en-US",
              "british english": "en-GB",
              "spanish": "es",
              "french": "fr",
              "german": "de",
              "italian": "it",
              "gujarati": "gu",
              "hindi": "hi",
              "japanese": "ja",
              "portuguese": "pt",
              "vietnamese": "vi",
              "chinese": "zh",
              "korean": "ko",
              "russian": "ru"
            };
            const lowerLang = langName.toLowerCase().trim();
            const locale = langMap[lowerLang] || (lowerLang.length >= 2 ? lowerLang.substring(0, 2) : "en");
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${locale}&client=tw-ob&q=${encodeURIComponent(transText)}`;

            const ttsResponse = await axios.get(ttsUrl, { responseType: "arraybuffer" });
            const audioBuffer = Buffer.from(ttsResponse.data);

            const cleanText = transText.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
            const mockFile = {
              originalname: `${cleanText}_pronunciation_${langName.toLowerCase()}.mp3`,
              buffer: audioBuffer,
              mimetype: "audio/mpeg",
            };

            const uploadResult = await uploadFile(mockFile);
            targetAudioUrl = uploadResult.url;
          } catch (ttsErr) {
            console.warn(`Google Translate S3 Upload failed on target create for ${langName}:`, ttsErr.message);
          }
        } else {

          transText = await translateText(text, langName);
          transRightAnswer = await translateText(rightAnswer, langName);
          if (parsedOptions.length > 0) {
            transOptions = await translateArray(parsedOptions, langName);
          }
        }

        translations[langName.toLowerCase()] = {
          text: transText,
          rightAnswer: transRightAnswer,
          options: transOptions,
          audio: targetAudioUrl,
        };
      }

      const question = await JourneyQuestionModel.create({
        journeyLessonId,
        type,
        text: text ? text.trim() : "",
        translation: translation ? translation.trim() : "",
        options: type === "speaking" ? [] : parsedOptions,
        rightAnswer: type === "speaking" ? "" : (rightAnswer ? rightAnswer.trim() : ""),
        image: type === "mcq" ? newImageUrl : null,
        audio: type === "speaking" ? newAudioUrl : null,
        translations,
      });

      return sendCreatedResponse(res, "Journey question created successfully with all translations", question);
    } catch (error) {
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      if (newAudioUrl) await deleteFileFromS3(newAudioUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateJourneyQuestion(req, res) {
    let newImageUrl = null;
    let newAudioUrl = null;

    try {
      const { id } = req.params;
      const { journeyLessonId, type, text, translation, options, rightAnswer } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Question ID");
      }

      const question = await JourneyQuestionModel.findById(id);
      if (!question) {
        return sendNotFoundResponse(res, "Journey question not found");
      }

      const updateData = {};

      const targetLessonId = journeyLessonId !== undefined ? journeyLessonId : question.journeyLessonId;
      if (!mongoose.Types.ObjectId.isValid(targetLessonId)) {
        return sendBadRequestResponse(res, "Invalid Journey Lesson ID");
      }
      const lesson = await JourneyLessonModel.findById(targetLessonId);
      if (!lesson) {
        return sendNotFoundResponse(res, "Journey lesson not found");
      }

      if (journeyLessonId !== undefined) updateData.journeyLessonId = journeyLessonId;

      const finalType = type !== undefined ? type : question.type;
      const finalRightAnswer = rightAnswer !== undefined ? rightAnswer.trim() : question.rightAnswer;

      if (finalType !== "speaking" && !finalRightAnswer) {
        return sendBadRequestResponse(res, "rightAnswer is required for this question type.");
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

      if (req.files) {
        if (finalType === "mcq" && req.files.image && req.files.image[0]) {
          const uploadResult = await uploadFile(req.files.image[0]);
          newImageUrl = uploadResult.url;
          updateData.image = newImageUrl;
        }
        if (finalType === "speaking" && req.files.audio && req.files.audio[0]) {
          const uploadResult = await uploadFile(req.files.audio[0]);
          newAudioUrl = uploadResult.url;
          updateData.audio = newAudioUrl;
        }
      }

      const finalTranslation = translation !== undefined ? translation.trim() : question.translation;
      const isTranslationChanged = translation !== undefined && translation.trim() !== question.translation;
      const shouldGenerateAudio = finalType === "speaking" && ((!newAudioUrl && !question.audio && finalTranslation) || (isTranslationChanged && !req.files?.audio));

      if (shouldGenerateAudio && finalTranslation) {
        try {
          const langMap = {
            "english": "en",
            "american english": "en-US",
            "british english": "en-GB",
            "spanish": "es",
            "french": "fr",
            "german": "de",
            "italian": "it",
            "gujarati": "gu",
            "hindi": "hi",
            "japanese": "ja",
            "portuguese": "pt",
            "vietnamese": "vi",
            "chinese": "zh",
            "korean": "ko",
            "russian": "ru"
          };
          const lowerLang = langName.toLowerCase().trim();
          const locale = langMap[lowerLang] || (lowerLang.length >= 2 ? lowerLang.substring(0, 2) : "en");
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
          console.warn("Google Translate S3 Upload failed on update:", ttsErr.message);
        }
      }


      const isTextUpdated = text !== undefined && text.trim() !== question.text;
      const isRightAnswerUpdated = rightAnswer !== undefined && rightAnswer.trim() !== question.rightAnswer;
      const isOptionsUpdated = options !== undefined;

      if (isTextUpdated || isRightAnswerUpdated || isOptionsUpdated) {
        const translations = {};
        const languages = await LanguageToLearnModel.find();

        for (const lang of languages) {
          const langName = lang.title.trim();
          if (langName.toLowerCase() === "english") {
            continue;
          }

          let transText = "";
          let transRightAnswer = "";
          let transOptions = [];
          let targetAudioUrl = null;

          const oldTrans = question.translations ? question.translations.get(langName.toLowerCase()) : null;

          const currentText = text !== undefined ? text.trim() : question.text;
          const currentRightAnswer = rightAnswer !== undefined ? rightAnswer.trim() : question.rightAnswer;
          const currentOptions = options !== undefined ? updateData.options : question.options;

          if (finalType === "speaking") {
            transText = await translateText(currentText, langName);
            transRightAnswer = "";

            if (isTextUpdated) {

              try {
                const langMap = {
                  "english": "en",
                  "american english": "en-US",
                  "british english": "en-GB",
                  "spanish": "es",
                  "french": "fr",
                  "german": "de",
                  "italian": "it",
                  "gujarati": "gu",
                  "hindi": "hi",
                  "japanese": "ja",
                  "portuguese": "pt",
                  "vietnamese": "vi",
                  "chinese": "zh",
                  "korean": "ko",
                  "russian": "ru"
                };
                const lowerLang = langName.toLowerCase().trim();
                const locale = langMap[lowerLang] || (lowerLang.length >= 2 ? lowerLang.substring(0, 2) : "en");
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${locale}&client=tw-ob&q=${encodeURIComponent(transText)}`;

                const ttsResponse = await axios.get(ttsUrl, { responseType: "arraybuffer" });
                const audioBuffer = Buffer.from(ttsResponse.data);

                const cleanText = transText.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
                const mockFile = {
                  originalname: `${cleanText}_pronunciation_${langName.toLowerCase()}.mp3`,
                  buffer: audioBuffer,
                  mimetype: "audio/mpeg",
                };

                const uploadResult = await uploadFile(mockFile);
                targetAudioUrl = uploadResult.url;


                if (oldTrans && oldTrans.audio) {
                  await deleteFileFromS3(oldTrans.audio);
                }
              } catch (ttsErr) {
                console.warn(`S3 update translation audio failed for ${langName}:`, ttsErr.message);
              }
            }
          } else {

            transText = await translateText(currentText, langName);
            transRightAnswer = await translateText(currentRightAnswer, langName);
            if (currentOptions && currentOptions.length > 0) {
              transOptions = await translateArray(currentOptions, langName);
            }
          }

          translations[langName.toLowerCase()] = {
            text: transText,
            rightAnswer: transRightAnswer,
            options: transOptions,
            audio: targetAudioUrl || (oldTrans ? oldTrans.audio : null),
          };
        }
        updateData.translations = translations;
      }

      if (finalType !== "speaking") {
        updateData.audio = null;

        if (question.translations) {
          for (const [key, value] of question.translations.entries()) {
            if (value && value.audio) {
              await deleteFileFromS3(value.audio);
            }
          }
        }
      }
      if (finalType !== "mcq") updateData.image = null;
      if (finalType === "speaking") {
        updateData.options = [];
        updateData.rightAnswer = "";
      }

      const oldImage = question.image;
      const oldAudio = question.audio;

      const updated = await JourneyQuestionModel.findByIdAndUpdate(id, updateData, { new: true });

      if ((newImageUrl || finalType !== "mcq") && oldImage) await deleteFileFromS3(oldImage);
      if ((newAudioUrl || finalType !== "speaking") && oldAudio) await deleteFileFromS3(oldAudio);

      return sendSuccessResponse(res, "Journey question updated successfully", updated);
    } catch (error) {
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      if (newAudioUrl) await deleteFileFromS3(newAudioUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteJourneyQuestion(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Question ID");
      }

      const question = await JourneyQuestionModel.findById(id);
      if (!question) {
        return sendNotFoundResponse(res, "Journey question not found");
      }

      if (question.image) await deleteFileFromS3(question.image);
      if (question.audio) await deleteFileFromS3(question.audio);


      if (question.translations) {
        for (const [key, value] of question.translations.entries()) {
          if (value && value.audio) {
            await deleteFileFromS3(value.audio);
          }
        }
      }

      await JourneyQuestionModel.findByIdAndDelete(id);
      return sendSuccessResponse(res, "Journey question deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async mapAndHealQuestion(q, langKey, languageToLearn) {
    let qData = q.toObject ? q.toObject() : q;


    if (qData.type !== "speaking") {
      return qData;
    }

    if (!langKey) {
      return qData;
    }

    let trans = q.translations ? (q.translations.get ? q.translations.get(langKey) : q.translations[langKey]) : null;
    if (!trans) {
      try {
        const transText = await translateText(qData.text, languageToLearn);
        const transRightAnswer = qData.rightAnswer ? await translateText(qData.rightAnswer, languageToLearn) : "";
        const transOptions = qData.options && qData.options.length > 0
          ? await translateArray(qData.options, languageToLearn)
          : [];

        let targetAudioUrl = null;
        if (qData.type === "speaking" && transText) {
          try {
            const langMap = {
              "english": "en",
              "american english": "en-US",
              "british english": "en-GB",
              "spanish": "es",
              "french": "fr",
              "german": "de",
              "italian": "it",
              "gujarati": "gu",
              "hindi": "hi",
              "japanese": "ja",
              "portuguese": "pt",
              "vietnamese": "vi",
              "chinese": "zh",
              "korean": "ko",
              "russian": "ru"
            };
            const lowerLang = languageToLearn.toLowerCase().trim();
            const locale = langMap[lowerLang] || (lowerLang.length >= 2 ? lowerLang.substring(0, 2) : "en");
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${locale}&client=tw-ob&q=${encodeURIComponent(transText)}`;

            const ttsResponse = await axios.get(ttsUrl, { responseType: "arraybuffer" });
            const audioBuffer = Buffer.from(ttsResponse.data);

            const cleanText = transText.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
            const mockFile = {
              originalname: `${cleanText}_pronunciation_${lowerLang}.mp3`,
              buffer: audioBuffer,
              mimetype: "audio/mpeg",
            };

            const uploadResult = await uploadFile(mockFile);
            targetAudioUrl = uploadResult.url;
          } catch (ttsErr) {
            console.warn("Auto-heal TTS audio generation failed:", ttsErr.message);
          }
        }

        const updateObj = {};
        updateObj[`translations.${langKey}`] = {
          text: transText,
          rightAnswer: transRightAnswer,
          options: transOptions,
          audio: targetAudioUrl,
        };
        await JourneyQuestionModel.findByIdAndUpdate(qData._id, updateObj);

        trans = {
          text: transText,
          rightAnswer: transRightAnswer,
          options: transOptions,
          audio: targetAudioUrl,
        };
      } catch (err) {
        console.warn("Auto-heal question translation failed:", err.message);
      }
    }

    if (trans) {
      qData.translation = qData.text; 
      qData.text = trans.text || qData.text; 
      qData.rightAnswer = trans.rightAnswer || qData.rightAnswer;
      qData.options = trans.options && trans.options.length > 0 ? trans.options : qData.options;
      qData.audio = trans.audio || qData.audio;
    }

    return qData;
  }

  static async mapAndHealTopic(topic, langKey, languageToLearn) {
    let topicData = topic.toObject ? topic.toObject() : topic;
    if (!langKey) {
      return topicData;
    }

    let trans = topic.translations ? (topic.translations.get ? topic.translations.get(langKey) : topic.translations[langKey]) : null;
    if (!trans) {
      try {
        const transTitle = await translateText(topicData.title, languageToLearn);
        const transDesc = topicData.description ? await translateText(topicData.description, languageToLearn) : "";
        const transCategory = await translateText(topicData.category, languageToLearn);
        const transPoints = topicData.points && topicData.points.length > 0
          ? await translateArray(topicData.points, languageToLearn)
          : [];

        const updateObj = {};
        updateObj[`translations.${langKey}`] = {
          title: transTitle,
          description: transDesc,
          category: transCategory,
          points: transPoints,
        };
        await JourneyTopicModel.findByIdAndUpdate(topicData._id, updateObj);

        trans = {
          title: transTitle,
          description: transDesc,
          category: transCategory,
          points: transPoints,
        };
      } catch (err) {
        console.warn("Auto-heal topic translation failed:", err.message);
      }
    }

    if (trans) {
      topicData.title = trans.title || topicData.title;
      topicData.description = trans.description || topicData.description;
      topicData.category = trans.category || topicData.category;
      topicData.points = trans.points && trans.points.length > 0 ? trans.points : topicData.points;
    }

    return topicData;
  }

  static async mapAndHealLesson(lesson, langKey, languageToLearn) {
    let lessonData = lesson.toObject ? lesson.toObject() : lesson;
    if (!langKey) {
      return lessonData;
    }

    let trans = lesson.translations ? (lesson.translations.get ? lesson.translations.get(langKey) : lesson.translations[langKey]) : null;
    if (!trans) {
      try {
        const transTitle = await translateText(lessonData.title, languageToLearn);
        const transDesc = lessonData.description ? await translateText(lessonData.description, languageToLearn) : "";
        const transCategory = await translateText(lessonData.category, languageToLearn);

        const updateObj = {};
        updateObj[`translations.${langKey}`] = {
          title: transTitle,
          description: transDesc,
          category: transCategory,
        };
        await JourneyLessonModel.findByIdAndUpdate(lessonData._id, updateObj);

        trans = {
          title: transTitle,
          description: transDesc,
          category: transCategory,
        };
      } catch (err) {
        console.warn("Auto-heal lesson translation failed:", err.message);
      }
    }

    if (trans) {
      lessonData.title = trans.title || lessonData.title;
      lessonData.description = trans.description || lessonData.description;
      lessonData.category = trans.category || lessonData.category;
    }

    return lessonData;
  }

  static async syncTopicCompletion(analytics, journeyLessonId) {
    try {
      const lesson = await JourneyLessonModel.findById(journeyLessonId);
      if (!lesson) return;

      const completedLessonIds = analytics.completedLessons
        .filter((cl) => cl.status === "completed")
        .map((cl) => (cl.journeyLessonId || cl.lessonId)?.toString());


      const lessonIdStr = journeyLessonId.toString();
      if (!completedLessonIds.includes(lessonIdStr)) {
        completedLessonIds.push(lessonIdStr);
      }


      if (lesson.journeyTopicId) {
        const journeyTopicIdStr = lesson.journeyTopicId.toString();
        const allLessons = await JourneyLessonModel.find({ journeyTopicId: lesson.journeyTopicId });
        const allLessonIds = allLessons.map((l) => l._id.toString());

        const allCompleted = allLessonIds.every((id) => completedLessonIds.includes(id));
        if (allCompleted) {
          const topicRecord = analytics.completedTopics.find((ct) => ct.topicId === journeyTopicIdStr);
          if (!topicRecord) {
            analytics.completedTopics.push({
              topicId: journeyTopicIdStr,
              completedTasksCount: allLessons.length,
              status: "completed",
              completedAt: new Date(),
            });
          } else {
            topicRecord.completedTasksCount = allLessons.length;
            topicRecord.status = "completed";
            topicRecord.completedAt = new Date();
          }
        } else {
          const completedCount = allLessonIds.filter((id) => completedLessonIds.includes(id)).length;
          const topicRecord = analytics.completedTopics.find((ct) => ct.topicId === journeyTopicIdStr);
          if (!topicRecord) {
            analytics.completedTopics.push({
              topicId: journeyTopicIdStr,
              completedTasksCount: completedCount,
              status: "started",
            });
          } else if (topicRecord.status !== "completed") {
            topicRecord.completedTasksCount = completedCount;
          }
        }
      }


      const standaloneTopic = await TopicModel.findOne({ journeyLessonId });
      if (standaloneTopic) {
        const topicIdStr = standaloneTopic._id.toString();
        const topicRecord = analytics.completedTopics.find((ct) => ct.topicId === topicIdStr);
        if (!topicRecord) {
          analytics.completedTopics.push({
            topicId: topicIdStr,
            completedTasksCount: 1,
            status: "completed",
            completedAt: new Date(),
          });
        } else {
          topicRecord.completedTasksCount = 1;
          topicRecord.status = "completed";
          topicRecord.completedAt = new Date();
        }
      }
    } catch (err) {
      console.warn("syncTopicCompletion failed:", err.message);
    }
  }

  static async getAllQuestions(req, res) {
    try {
      const questions = await JourneyQuestionModel.find({ isDeleted: false }).populate("journeyLessonId");
      if (questions.length === 0) {
        return sendBadRequestResponse(res, "No journey questions found.");
      }

      const targetUserId = req.query.userId || req.user?._id;
      let targetUser = req.user;
      if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
        const userFound = await UserModel.findById(req.query.userId);
        if (userFound) {
          targetUser = userFound;
        }
      }

      const languageToLearn = targetUser?.onboarding?.languageToLearn;
      const langKey = languageToLearn ? languageToLearn.toLowerCase().trim() : null;
      const analytics = await AnalyticsModel.findOne({ userId: targetUserId });

      const completedLessonIdSet = new Set(
        (analytics?.completedLessons || [])
          .filter((cl) => cl.status === "completed")
          .map((cl) => (cl.journeyLessonId || cl.lessonId)?.toString())
      );
      const completedQIdSet = new Set(
        (analytics?.completedQuestions || [])
          .map((cq) => cq.questionId?.toString())
      );

      const mappedQuestions = [];
      for (const q of questions) {
        const mapped = await JourneyController.mapAndHealQuestion(q, langKey, languageToLearn);
        const lessonIdStr = (mapped.journeyLessonId?._id || mapped.journeyLessonId)?.toString();
        const isLessonDone = lessonIdStr ? completedLessonIdSet.has(lessonIdStr) : false;

        mapped.isCompleted = isLessonDone || completedQIdSet.has(q._id.toString());

        if (mapped.journeyLessonId && typeof mapped.journeyLessonId === "object") {
          mapped.journeyLessonId.isCompleted = isLessonDone;
        }

        mappedQuestions.push(mapped);
      }

      return sendSuccessResponse(res, "Journey questions retrieved successfully", mappedQuestions);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getQuestionById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Journey Question ID");
      }

      const question = await JourneyQuestionModel.findById(id).populate("journeyLessonId");
      if (!question || question.isDeleted) {
        return sendNotFoundResponse(res, "Journey question not found");
      }

      const targetUserId = req.query.userId || req.user?._id;
      let targetUser = req.user;
      if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
        const userFound = await UserModel.findById(req.query.userId);
        if (userFound) {
          targetUser = userFound;
        }
      }

      const languageToLearn = targetUser?.onboarding?.languageToLearn;
      const langKey = languageToLearn ? languageToLearn.toLowerCase().trim() : null;
      const analytics = await AnalyticsModel.findOne({ userId: targetUserId });

      const lessonIdStr = (question.journeyLessonId?._id || question.journeyLessonId)?.toString();
      const isLessonDone = analytics
        ? analytics.completedLessons.some(
            (cl) => (cl.journeyLessonId || cl.lessonId)?.toString() === lessonIdStr && cl.status === "completed"
          )
        : false;

      const completedQIdSet = new Set(
        (analytics?.completedQuestions || [])
          .map((cq) => cq.questionId?.toString())
      );

      const mapped = await JourneyController.mapAndHealQuestion(question, langKey, languageToLearn);
      mapped.isCompleted = isLessonDone || completedQIdSet.has(question._id.toString());

      if (mapped.journeyLessonId && typeof mapped.journeyLessonId === "object") {
        mapped.journeyLessonId.isCompleted = isLessonDone;
      }

      return sendSuccessResponse(res, "Journey question retrieved successfully", mapped);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getUserJourney(req, res) {
    try {
      const targetUserId = req.query.userId || req.user?._id;
      let targetUser = req.user;
      if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
        const userFound = await UserModel.findById(req.query.userId);
        if (userFound) {
          targetUser = userFound;
        }
      }

      const languageToLearn = targetUser?.onboarding?.languageToLearn;
      if (!languageToLearn) {
        return sendBadRequestResponse(res, "Please complete onboarding to choose a learning language.");
      }


      const topics = await JourneyTopicModel.find().sort({ topicNumber: 1, createdAt: 1 });
      const analytics = await AnalyticsModel.findOne({ userId: targetUserId });

      const completedQIdSet = new Set(
        (analytics?.completedQuestions || [])
          .map((cq) => cq.questionId?.toString())
      );

      const journey = [];
      const langKey = languageToLearn.toLowerCase().trim();

      for (const topic of topics) {
        const topicData = await JourneyController.mapAndHealTopic(topic, langKey, languageToLearn);


        const lessons = await JourneyLessonModel.find({ journeyTopicId: topic._id }).sort({ lessonNumber: 1, createdAt: 1 });
        const lessonsData = [];

        for (const lesson of lessons) {
          const lessonData = await JourneyController.mapAndHealLesson(lesson, langKey, languageToLearn);

          const questions = await JourneyQuestionModel.find({ journeyLessonId: lesson._id, isDeleted: false });


          const isLessonAlreadyCompleted = analytics
            ? analytics.completedLessons.some((cl) => {
                const targetId = cl.journeyLessonId || cl.lessonId;
                return targetId?.toString() === lesson._id.toString() && cl.status === "completed";
              })
            : false;

          const mappedQuestions = [];
          let allQuestionsDone = questions.length > 0;

          for (const q of questions) {
            const mapped = await JourneyController.mapAndHealQuestion(q, langKey, languageToLearn);
            const isQDone = isLessonAlreadyCompleted || completedQIdSet.has(q._id.toString());
            if (!isQDone) {
              allQuestionsDone = false;
            }
            mapped.isCompleted = isQDone;
            mappedQuestions.push(mapped);
          }

          const isLessonCompleted = isLessonAlreadyCompleted || (questions.length > 0 && allQuestionsDone);

          lessonsData.push({
            ...lessonData,
            isCompleted: isLessonCompleted,
            questions: mappedQuestions,
          });
        }


        const pointsWithStatus = (topicData.points || []).map((pointText, index) => {
          const correspondingLesson = lessonsData[index];
          return {
            text: pointText,
            isCompleted: correspondingLesson ? correspondingLesson.isCompleted : false,
          };
        });

        const totalLessons = lessonsData.length;
        const completedLessonsCount = lessonsData.filter((l) => l.isCompleted).length;
        const isTopicCompleted = totalLessons > 0 && completedLessonsCount === totalLessons;
        const progressPercent = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

        journey.push({
          ...topicData,
          isCompleted: isTopicCompleted,
          totalLessonsCount: totalLessons,
          completedLessonsCount,
          progressPercent,
          points: pointsWithStatus,
          lessons: lessonsData,
        });
      }

      return sendSuccessResponse(res, "User journey fetched successfully", journey);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getLessonsByTopic(req, res) {
    try {
      const { topicId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(topicId)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await JourneyTopicModel.findById(topicId);
      if (!topic) {
        return sendNotFoundResponse(res, "Journey topic not found");
      }

      const lessons = await JourneyLessonModel.find({ journeyTopicId: topicId }).sort({ lessonNumber: 1, createdAt: 1 });
      const targetUserId = req.query.userId || req.user?._id;
      let targetUser = req.user;
      if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
        const userFound = await UserModel.findById(req.query.userId);
        if (userFound) {
          targetUser = userFound;
        }
      }

      const analytics = await AnalyticsModel.findOne({ userId: targetUserId });
      const languageToLearn = targetUser?.onboarding?.languageToLearn;
      const langKey = languageToLearn ? languageToLearn.toLowerCase().trim() : null;

      const completedQIdSet = new Set(
        (analytics?.completedQuestions || [])
          .map((cq) => cq.questionId?.toString())
      );

      const mappedLessons = [];
      for (const lesson of lessons) {
        const mapped = await JourneyController.mapAndHealLesson(lesson, langKey, languageToLearn);

        const isLessonDoneInAnalytics = analytics
          ? analytics.completedLessons.some((cl) => {
              const targetId = cl.journeyLessonId || cl.lessonId;
              return targetId?.toString() === mapped._id.toString() && cl.status === "completed";
            })
          : false;

        let allQuestionsDone = false;
        if (!isLessonDoneInAnalytics) {
          const questions = await JourneyQuestionModel.find({ journeyLessonId: lesson._id, isDeleted: false });
          allQuestionsDone = questions.length > 0 && questions.every((q) => completedQIdSet.has(q._id.toString()));
        }

        mappedLessons.push({
          ...mapped,
          isCompleted: isLessonDoneInAnalytics || allQuestionsDone,
        });
      }

      return sendSuccessResponse(res, "Lessons retrieved successfully for the topic", mappedLessons);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getQuestionsByLesson(req, res) {
    try {
      const { lessonId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return sendBadRequestResponse(res, "Invalid Lesson ID");
      }

      const lesson = await JourneyLessonModel.findById(lessonId);
      if (!lesson) {
        return sendNotFoundResponse(res, "Journey lesson not found");
      }

      const questions = await JourneyQuestionModel.find({ journeyLessonId: lessonId, isDeleted: false }).populate("journeyLessonId");
      const targetUserId = req.query.userId || req.user?._id;
      let targetUser = req.user;
      if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
        const userFound = await UserModel.findById(req.query.userId);
        if (userFound) {
          targetUser = userFound;
        }
      }

      const analytics = await AnalyticsModel.findOne({ userId: targetUserId });
      const languageToLearn = targetUser?.onboarding?.languageToLearn;
      const langKey = languageToLearn ? languageToLearn.toLowerCase().trim() : null;

      const isLessonAlreadyCompleted = analytics
        ? analytics.completedLessons.some((cl) => {
            const targetId = cl.journeyLessonId || cl.lessonId;
            return targetId?.toString() === lessonId.toString() && cl.status === "completed";
          })
        : false;

      const completedQIdSet = new Set(
        (analytics?.completedQuestions || [])
          .map((cq) => cq.questionId?.toString())
      );

      const mappedQuestions = [];
      for (const q of questions) {
        const mapped = await JourneyController.mapAndHealQuestion(q, langKey, languageToLearn);
        mapped.isCompleted = isLessonAlreadyCompleted || completedQIdSet.has(q._id.toString());

        if (mapped.journeyLessonId && typeof mapped.journeyLessonId === "object") {
          mapped.journeyLessonId.isCompleted = isLessonAlreadyCompleted;
        }

        mappedQuestions.push(mapped);
      }

      return sendSuccessResponse(res, "Questions retrieved successfully for the lesson", mappedQuestions);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async verifyUserSpeaking(req, res) {
    try {
      const { questionId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return sendBadRequestResponse(res, "Invalid Question ID");
      }

      if (!req.file) {
        return sendBadRequestResponse(res, "Audio recording file is required.");
      }

      const question = await JourneyQuestionModel.findById(questionId);
      if (!question) {
        return sendNotFoundResponse(res, "Question not found");
      }

      if (question.type !== "speaking") {
        return sendBadRequestResponse(res, "Question is not a pronunciation/speaking question.");
      }

      const languageToLearn = req.user?.onboarding?.languageToLearn;
      const langKey = languageToLearn ? languageToLearn.toLowerCase().trim() : null;

      let targetText = question.text;
      if (langKey && langKey !== "english" && question.translations && question.translations.get(langKey)) {
        const trans = question.translations.get(langKey);
        targetText = trans.text || targetText;
      }

      let transcribedText = "";

      try {
        const hasGeminiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy-key-for-now";

        if (!hasGeminiKey) {
          console.warn("Gemini API key not configured, simulating transcription matching correct answer.");
          transcribedText = targetText;
        } else {
          transcribedText = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
      } catch (err) {
        console.error("Audio transcription failed:", err.message);
        return sendErrorResponse(res, 500, `Audio transcription failed: ${err.message}`, err);
      }

      if (!transcribedText || !transcribedText.trim()) {
        return sendBadRequestResponse(res, "Could not recognize speech from the provided audio.");
      }

      const cleanTranscribed = transcribedText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const cleanTarget = targetText
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      let score = 0;
      if (cleanTranscribed === cleanTarget) {
        score = 100;
      } else {
        const transWords = cleanTranscribed.split(" ");
        const targetWords = cleanTarget.split(" ");
        let matchCount = 0;
        targetWords.forEach(word => {
          if (transWords.includes(word)) matchCount++;
        });
        score = Math.round((matchCount / targetWords.length) * 100);
      }

      const passingScore = 70;
      const isCorrect = score >= passingScore;

      let analytics = await AnalyticsModel.findOne({ userId: req.user._id });
      if (!analytics) {
        analytics = new AnalyticsModel({ userId: req.user._id });
      }

      if (!analytics.completedQuestions) {
        analytics.completedQuestions = [];
      }

      const qIdStr = question._id.toString();
      const lessonIdStr = question.journeyLessonId.toString();

      const existingQ = analytics.completedQuestions.find(
        (cq) => cq.questionId?.toString() === qIdStr
      );
      if (!existingQ) {
        analytics.completedQuestions.push({
          questionId: qIdStr,
          journeyLessonId: lessonIdStr,
          isCorrect,
          score,
          completedAt: new Date(),
        });
      } else {
        existingQ.isCorrect = isCorrect;
        existingQ.score = score;
        existingQ.completedAt = new Date();
      }


      const allLessonQuestions = await JourneyQuestionModel.find({
        journeyLessonId: question.journeyLessonId,
        isDeleted: false,
      });

      const completedQIdSet = new Set(
        analytics.completedQuestions
          .map((cq) => cq.questionId?.toString())
      );

      const allQuestionsCompleted =
        allLessonQuestions.length > 0 &&
        allLessonQuestions.every((q) => completedQIdSet.has(q._id.toString()));

      let shouldComplete =
        allQuestionsCompleted || req.body.isCompleted === true || req.body.isCompleted === "true";

      if (shouldComplete) {
        const existingLesson = analytics.completedLessons.find(
          (cl) => (cl.journeyLessonId || cl.lessonId)?.toString() === lessonIdStr
        );

        let totalScoreSum = 0;
        allLessonQuestions.forEach((q) => {
          const cq = analytics.completedQuestions.find(
            (item) => item.questionId?.toString() === q._id.toString()
          );
          if (cq) {
            totalScoreSum += cq.score || 0;
          }
        });

        const lessonScore =
          allLessonQuestions.length > 0
            ? Math.round(totalScoreSum / allLessonQuestions.length)
            : score;

        if (!existingLesson) {
          analytics.completedLessons.push({
            journeyLessonId: question.journeyLessonId,
            status: "completed",
            score: lessonScore,
            completedAt: new Date(),
          });
        } else {
          existingLesson.status = "completed";
          existingLesson.score = lessonScore;
          existingLesson.completedAt = new Date();
        }

        analytics.speakingTrendScore = Math.min(
          100,
          Math.round(analytics.speakingTrendScore * 0.9 + lessonScore * 0.1)
        );
        analytics.vocabularyTrendScore = Math.min(
          100,
          Math.round(analytics.vocabularyTrendScore * 0.92 + 8)
        );

        await JourneyController.syncTopicCompletion(analytics, question.journeyLessonId);
      }

      await analytics.save();
      await recordUserPractice(req.user._id);

      return sendSuccessResponse(res, "Voice checked successfully", {
        transcribedText,
        targetText,
        score,
        isCorrect,
        isCompleted: shouldComplete,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async verifyJourneyQuestion(req, res) {
    try {
      const { questionId } = req.params;
      const { answer, isCompleted } = req.body;

      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return sendBadRequestResponse(res, "Invalid Question ID");
      }

      if (answer === undefined || answer === null) {
        return sendBadRequestResponse(res, "Answer is required.");
      }

      const question = await JourneyQuestionModel.findById(questionId);
      if (!question) {
        return sendNotFoundResponse(res, "Question not found");
      }

      if (question.type === "speaking") {
        return sendBadRequestResponse(res, "Please use verifyUserSpeaking for speaking questions.");
      }

      const targetRightAnswer = question.rightAnswer;
      const isCorrect = targetRightAnswer.trim().toLowerCase() === String(answer).trim().toLowerCase();

      let analytics = await AnalyticsModel.findOne({ userId: req.user._id });
      if (!analytics) {
        analytics = new AnalyticsModel({ userId: req.user._id });
      }

      if (!analytics.completedQuestions) {
        analytics.completedQuestions = [];
      }

      const qIdStr = question._id.toString();
      const lessonIdStr = question.journeyLessonId.toString();

      const existingQ = analytics.completedQuestions.find(
        (cq) => cq.questionId?.toString() === qIdStr
      );
      if (!existingQ) {
        analytics.completedQuestions.push({
          questionId: qIdStr,
          journeyLessonId: lessonIdStr,
          isCorrect,
          score: isCorrect ? 100 : 0,
          completedAt: new Date(),
        });
      } else {
        existingQ.isCorrect = isCorrect;
        existingQ.score = isCorrect ? 100 : 0;
        existingQ.completedAt = new Date();
      }


      const allLessonQuestions = await JourneyQuestionModel.find({
        journeyLessonId: question.journeyLessonId,
        isDeleted: false,
      });

      const completedQIdSet = new Set(
        analytics.completedQuestions
          .map((cq) => cq.questionId?.toString())
      );

      const allQuestionsCompleted =
        allLessonQuestions.length > 0 &&
        allLessonQuestions.every((q) => completedQIdSet.has(q._id.toString()));

      let shouldComplete =
        allQuestionsCompleted || isCompleted === true || isCompleted === "true";

      if (shouldComplete) {
        const existingLesson = analytics.completedLessons.find(
          (cl) => (cl.journeyLessonId || cl.lessonId)?.toString() === lessonIdStr
        );

        let totalScoreSum = 0;
        allLessonQuestions.forEach((q) => {
          const cq = analytics.completedQuestions.find(
            (item) => item.questionId?.toString() === q._id.toString()
          );
          if (cq) {
            totalScoreSum += cq.score || 0;
          }
        });

        const lessonScore =
          allLessonQuestions.length > 0
            ? Math.round(totalScoreSum / allLessonQuestions.length)
            : isCorrect
            ? 100
            : 0;

        if (!existingLesson) {
          analytics.completedLessons.push({
            journeyLessonId: question.journeyLessonId,
            status: "completed",
            score: lessonScore,
            completedAt: new Date(),
          });
        } else {
          existingLesson.status = "completed";
          existingLesson.score = lessonScore;
          existingLesson.completedAt = new Date();
        }

        analytics.listeningTrendScore = Math.min(
          100,
          Math.round(analytics.listeningTrendScore * 0.9 + lessonScore * 0.1)
        );
        analytics.vocabularyTrendScore = Math.min(
          100,
          Math.round(analytics.vocabularyTrendScore * 0.92 + 8)
        );

        await JourneyController.syncTopicCompletion(analytics, question.journeyLessonId);
      }

      await analytics.save();
      await recordUserPractice(req.user._id);

      return sendSuccessResponse(res, "Question verified successfully", {
        questionId,
        isCorrect,
        rightAnswer: targetRightAnswer,
        isCompleted: shouldComplete,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async resetLessonCompletion(req, res) {
    try {
      const { lessonId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return sendBadRequestResponse(res, "Invalid Lesson ID");
      }

      const lesson = await JourneyLessonModel.findById(lessonId);
      if (!lesson) {
        return sendNotFoundResponse(res, "Lesson not found");
      }

      let analytics = await AnalyticsModel.findOne({ userId });
      if (!analytics) {
        return sendSuccessResponse(res, "Lesson is already reset.");
      }

      const lessonIdStr = lessonId.toString();
      const isLessonCompleted = (analytics.completedLessons || []).some(
        (cl) => (cl.journeyLessonId || cl.lessonId)?.toString() === lessonIdStr
      );
      const hasCompletedQuestions = (analytics.completedQuestions || []).some(
        (cq) => cq.journeyLessonId?.toString() === lessonIdStr
      );

      if (!isLessonCompleted && !hasCompletedQuestions) {
        return sendSuccessResponse(res, "Lesson is already reset.");
      }

      analytics.completedLessons = (analytics.completedLessons || []).filter(
        (cl) => (cl.journeyLessonId || cl.lessonId)?.toString() !== lessonIdStr
      );

      if (analytics.completedQuestions) {
        analytics.completedQuestions = analytics.completedQuestions.filter(
          (cq) => cq.journeyLessonId?.toString() !== lessonIdStr
        );
      }

      if (lesson.journeyTopicId) {
        const journeyTopicIdStr = lesson.journeyTopicId.toString();
        const allLessons = await JourneyLessonModel.find({ journeyTopicId: lesson.journeyTopicId });
        const allLessonIds = allLessons.map((l) => l._id.toString());
        const remainingCompleted = analytics.completedLessons
          .filter((cl) => cl.status === "completed" && allLessonIds.includes((cl.journeyLessonId || cl.lessonId)?.toString()))
          .length;

        const topicRecord = (analytics.completedTopics || []).find((ct) => ct.topicId === journeyTopicIdStr);
        if (topicRecord) {
          topicRecord.completedTasksCount = remainingCompleted;
          topicRecord.status = remainingCompleted === allLessons.length && allLessons.length > 0 ? "completed" : "started";
          if (topicRecord.status !== "completed") {
            topicRecord.completedAt = null;
          }
        }
      }

      await analytics.save();
      return sendSuccessResponse(res, "Lesson completion status reset successfully.");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

}
