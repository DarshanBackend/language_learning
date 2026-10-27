import mongoose from "mongoose";
import TopicModel from "../model/topic.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import UserModel from "../model/user.model.js";
import TopicChatModel from "../model/topicChat.model.js";
import { recordUserPractice, syncUserStreak } from "./user.controller.js";
import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";
import {
  transcribeAudio,
  generateTopicTutorResponse,
  textToSpeech,
  translateText,
} from "../services/aiService.js";
import {
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";

export class TopicController {





  static async createTopic(req, res) {
    try {
      const {
        title,
        description,
        category,
        categorySubtitle,
        difficulty,
        termsCount,
        image,
        languageToLearn,
        whatYouWillLearn,
        tasks,
      } = req.body;

      if (!title || !title.trim() || !category || !languageToLearn) {
        return sendBadRequestResponse(res, "Title, category, and languageToLearn are required.");
      }


      const existingTopic = await TopicModel.findOne({
        title: { $regex: new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, "i") },
      });
      if (existingTopic) {
        return sendBadRequestResponse(res, "Topic with this title already exists.");
      }

      const validCategories = ["Business", "Pick for You", "Travel"];
      if (!validCategories.includes(category.trim())) {
        return sendBadRequestResponse(
          res,
          `Invalid category. Must be one of: ${validCategories.join(", ")}`
        );
      }


      if (!req.file && (!image || !String(image).trim())) {
        return sendBadRequestResponse(res, "Topic image is required.");
      }


      let imageUrl = image ? String(image).trim() : "";
      if (req.file) {
        try {
          const uploadRes = await uploadFile(req.file);
          imageUrl = uploadRes.url;
        } catch (uploadErr) {
          return sendErrorResponse(res, 500, "Failed to upload topic image", uploadErr);
        }
      }

      if (!imageUrl) {
        return sendBadRequestResponse(res, "Topic image is required.");
      }


      let parsedTasks = [];
      if (tasks) {
        let rawTasks = tasks;
        if (typeof tasks === "string") {
          try {
            rawTasks = JSON.parse(tasks);
          } catch (e) {
            rawTasks = tasks.split(",").map((t) => ({ title: t.trim(), description: "", points: [] }));
          }
        }

        if (Array.isArray(rawTasks)) {
          parsedTasks = rawTasks.map((t) => {
            let pointsList = [];
            if (Array.isArray(t.points)) {
              pointsList = t.points.map((p) => String(p).trim()).filter(Boolean);
            } else if (typeof t.points === "string" && t.points.trim()) {
              try {
                const parsed = JSON.parse(t.points);
                if (Array.isArray(parsed)) {
                  pointsList = parsed.map((p) => String(p).trim()).filter(Boolean);
                } else {
                  pointsList = [t.points.trim()];
                }
              } catch (e) {
                pointsList = [t.points.trim()];
              }
            } else if (t.point) {
              if (Array.isArray(t.point)) {
                pointsList = t.point.map((p) => String(p).trim()).filter(Boolean);
              } else {
                pointsList = [String(t.point).trim()];
              }
            }

            let desc = "";
            if (typeof t.description === "string") {
              desc = t.description.trim();
            } else if (Array.isArray(t.description)) {
              desc = t.description.map((d) => String(d).trim()).filter(Boolean).join(". ");
            }

            return {
              title: t.title ? t.title.trim() : "",
              description: desc,
              points: pointsList,
            };
          });
        }
      }

      if (parsedTasks.length === 0) {
        return sendBadRequestResponse(res, "At least one task is required for the topic.");
      }


      let parsedLearnList = [];
      if (whatYouWillLearn) {
        if (Array.isArray(whatYouWillLearn)) {
          parsedLearnList = whatYouWillLearn.map((item) => item.trim());
        } else {
          try {
            parsedLearnList = JSON.parse(whatYouWillLearn).map((item) => item.trim());
          } catch (e) {
            parsedLearnList = whatYouWillLearn.split(",").map((item) => item.trim());
          }
        }
      }

      const countTerms =
        termsCount !== undefined && termsCount !== null
          ? Number(termsCount)
          : parsedTasks.length;

      const topic = await TopicModel.create({
        title: title.trim(),
        description: description ? description.trim() : "",
        category: category.trim(),
        categorySubtitle: categorySubtitle ? categorySubtitle.trim() : "",
        difficulty: difficulty || "Easy",
        termsCount: countTerms,
        image: imageUrl,
        languageToLearn: languageToLearn.trim(),
        whatYouWillLearn: parsedLearnList,
        tasks: parsedTasks,
      });

      return sendCreatedResponse(res, "Topic created successfully", topic);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async updateTopic(req, res) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        category,
        categorySubtitle,
        difficulty,
        termsCount,
        image,
        languageToLearn,
        whatYouWillLearn,
        tasks,
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      const updateData = {};
      if (title !== undefined) {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          return sendBadRequestResponse(res, "Topic title cannot be empty.");
        }
        const existingTopic = await TopicModel.findOne({
          _id: { $ne: id },
          title: { $regex: new RegExp(`^${trimmedTitle.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, "i") },
        });
        if (existingTopic) {
          return sendBadRequestResponse(res, "Another topic with this title already exists.");
        }
        updateData.title = trimmedTitle;
      }
      if (description !== undefined) updateData.description = description.trim();
      if (category !== undefined) {
        const validCategories = ["Business", "Pick for You", "Travel"];
        if (!validCategories.includes(category.trim())) {
          return sendBadRequestResponse(
            res,
            `Invalid category. Must be one of: ${validCategories.join(", ")}`
          );
        }
        updateData.category = category.trim();
      }
      if (categorySubtitle !== undefined) updateData.categorySubtitle = categorySubtitle.trim();
      if (difficulty !== undefined) updateData.difficulty = difficulty;
      if (termsCount !== undefined) updateData.termsCount = Number(termsCount);
      if (languageToLearn !== undefined) updateData.languageToLearn = languageToLearn.trim();

      if (req.file) {
        try {
          if (topic.image) {
            await deleteFileFromS3(topic.image);
          }
          const uploadRes = await uploadFile(req.file);
          updateData.image = uploadRes.url;
        } catch (uploadErr) {
          return sendErrorResponse(res, 500, "Failed to upload topic image", uploadErr);
        }
      } else if (image !== undefined) {
        if (!String(image).trim()) {
          return sendBadRequestResponse(res, "Topic image cannot be empty.");
        }
        updateData.image = String(image).trim();
      }

      if (whatYouWillLearn !== undefined) {
        if (Array.isArray(whatYouWillLearn)) {
          updateData.whatYouWillLearn = whatYouWillLearn.map((item) => item.trim());
        } else {
          try {
            updateData.whatYouWillLearn = JSON.parse(whatYouWillLearn).map((item) => item.trim());
          } catch (e) {
            updateData.whatYouWillLearn = whatYouWillLearn.split(",").map((item) => item.trim());
          }
        }
      }

      if (tasks !== undefined) {
        let parsedTasks = [];
        let rawTasks = tasks;
        if (typeof tasks === "string") {
          try {
            rawTasks = JSON.parse(tasks);
          } catch (e) {
            rawTasks = tasks.split(",").map((t) => ({ title: t.trim(), description: "", points: [] }));
          }
        }

        if (Array.isArray(rawTasks)) {
          parsedTasks = rawTasks.map((t) => {
            let pointsList = [];
            if (Array.isArray(t.points)) {
              pointsList = t.points.map((p) => String(p).trim()).filter(Boolean);
            } else if (typeof t.points === "string" && t.points.trim()) {
              try {
                const parsed = JSON.parse(t.points);
                if (Array.isArray(parsed)) {
                  pointsList = parsed.map((p) => String(p).trim()).filter(Boolean);
                } else {
                  pointsList = [t.points.trim()];
                }
              } catch (e) {
                pointsList = [t.points.trim()];
              }
            } else if (t.point) {
              if (Array.isArray(t.point)) {
                pointsList = t.point.map((p) => String(p).trim()).filter(Boolean);
              } else {
                pointsList = [String(t.point).trim()];
              }
            }

            let desc = "";
            if (typeof t.description === "string") {
              desc = t.description.trim();
            } else if (Array.isArray(t.description)) {
              desc = t.description.map((d) => String(d).trim()).filter(Boolean).join(". ");
            }

            return {
              title: t.title ? t.title.trim() : "",
              description: desc,
              points: pointsList,
            };
          });
        }
        updateData.tasks = parsedTasks;
      }

      const updatedTopic = await TopicModel.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
      return sendSuccessResponse(res, "Topic updated successfully", updatedTopic);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async deleteTopic(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      if (topic.image) {
        await deleteFileFromS3(topic.image);
      }

      await TopicChatModel.deleteMany({ topicId: id });
      await TopicModel.findByIdAndDelete(id);
      return sendSuccessResponse(res, "Topic deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async getAllTopicsAdmin(req, res) {
    try {
      const topics = await TopicModel.find().sort({ createdAt: -1 });

      if (topics.length === 0) {
        return sendBadRequestResponse(res, "No Topics found");
      }

      return sendSuccessResponse(res, "Topics retrieved successfully", topics);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }






  static async getTopics(req, res) {
    try {
      const userLanguage = req.user.onboarding?.languageToLearn || "English";

      let topics = await TopicModel.find({
        languageToLearn: { $regex: new RegExp(`^${userLanguage.trim()}$`, "i") },
      }).sort({ createdAt: 1 });


      if (topics.length === 0) {
        topics = await TopicModel.find().sort({ createdAt: 1 });
      }

      const analytics = await AnalyticsModel.findOne({ userId: req.user._id });
      const currentStreak = await syncUserStreak(req.user._id);


      const userChats = await TopicChatModel.find({ userId: req.user._id }).sort({ updatedAt: -1 });
      const userChatMap = {};
      for (const chat of userChats) {
        if (chat.topicId) {
          userChatMap[chat.topicId.toString()] = chat.updatedAt;
        }
      }

      const defaultCategorySubtitles = {
        "Business": "Speak confidently in a professional setting",
        "Pick for You": "Personalized just for your goals and interests",
        "Travel": "Learn the essentials for trips and adventures",
        "Everyday Conversations": "Speak naturally in daily situations",
      };

      const mappedTopics = topics.map((topic) => {
        let status = "not_started";
        let completedTasksCount = 0;
        const totalTasksCount = topic.tasks && topic.tasks.length > 0 ? topic.tasks.length : (topic.termsCount || 1);
        let lastActivityAt = null;

        const record = analytics
          ? analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString())
          : null;

        const chatLastUpdated = userChatMap[topic._id.toString()] || null;

        if (record) {
          status = record.status;
          completedTasksCount = record.completedTasksCount || 0;
          lastActivityAt = record.completedAt || chatLastUpdated;
        } else if (chatLastUpdated) {
          status = "started";
          lastActivityAt = chatLastUpdated;
        }

        const subtitle = topic.categorySubtitle || defaultCategorySubtitles[topic.category] || "";

        return {
          _id: topic._id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          categorySubtitle: subtitle,
          difficulty: topic.difficulty,
          termsCount: topic.termsCount || totalTasksCount,
          image: topic.image || "",
          languageToLearn: topic.languageToLearn,
          totalTasksCount,
          completedTasksCount,
          status,
          isCompleted: status === "completed",
          progressPercent: totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0,
          lastActivityAt,
        };
      });


      const inProgressTopics = mappedTopics
        .filter((t) => (t.status === "started" || (userChatMap[t._id.toString()] && !t.isCompleted)))
        .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0));

      const continueTopic = inProgressTopics.length > 0 ? inProgressTopics[0] : null;


      const shuffleArray = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };


      const everydayConversations = shuffleArray(mappedTopics).slice(0, 5);


      const categoriesMap = {};
      const categoryOrder = ["Business", "Pick for You", "Travel"];

      for (const catName of categoryOrder) {
        categoriesMap[catName] = {
          name: catName,
          subtitle: defaultCategorySubtitles[catName] || "Speak confidently in daily situations",
          topics: [],
        };
      }

      for (const topic of mappedTopics) {
        const catName = topic.category || "General";
        if (!categoriesMap[catName]) {
          categoriesMap[catName] = {
            name: catName,
            subtitle: defaultCategorySubtitles[catName] || "Speak confidently in daily situations",
            topics: [],
          };
        }
        categoriesMap[catName].topics.push(topic);
      }

      const categoriesList = Object.values(categoriesMap).filter((c) => c.topics.length > 0);

      return sendSuccessResponse(res, "Topics fetched successfully", {
        streakDays: currentStreak,
        continue: continueTopic,
        everydayConversations,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async getTopicDetails(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      const analytics = await AnalyticsModel.findOne({ userId: req.user._id });
      const completedRecord = analytics
        ? analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString())
        : null;
      const completedCount = completedRecord ? completedRecord.completedTasksCount : 0;
      const totalTasks = topic.tasks ? topic.tasks.length : 0;

      const tasksWithStatus = (topic.tasks || []).map((task, index) => ({
        _id: task._id,
        order: index + 1,
        title: task.title,
        description: task.description || "",
        points: Array.isArray(task.points) ? task.points : [],
        isCompleted: index < completedCount,
      }));

      const isCompleted = completedRecord ? completedRecord.status === "completed" : false;
      const status = completedRecord ? completedRecord.status : "not_started";

      return sendSuccessResponse(res, "Topic details fetched successfully", {
        _id: topic._id,
        title: topic.title,
        description: topic.description,
        category: topic.category,
        categorySubtitle: topic.categorySubtitle || "",
        difficulty: topic.difficulty,
        termsCount: topic.termsCount || totalTasks,
        image: topic.image || "",
        languageToLearn: topic.languageToLearn,
        whatYouWillLearn: topic.whatYouWillLearn,
        tasks: tasksWithStatus,
        totalTasksCount: totalTasks,
        completedTasksCount: completedCount,
        status,
        isCompleted,
        progressPercent: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async recordCompletedTask(req, res) {
    try {
      const topicId = req.params.id || req.params.topicId || req.body.topicId;
      const userId = req.user._id;

      if (!topicId) {
        return sendBadRequestResponse(res, "Topic ID is required.");
      }

      if (!mongoose.Types.ObjectId.isValid(topicId)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(topicId);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      const totalTasks = topic.tasks ? topic.tasks.length : 0;

      let analytics = await AnalyticsModel.findOne({ userId });
      if (!analytics) {
        analytics = new AnalyticsModel({ userId });
      }

      let topicRecord = analytics.completedTopics.find((ct) => ct.topicId === topicId.toString());
      if (!topicRecord) {
        topicRecord = {
          topicId: topicId.toString(),
          completedTasksCount: 1,
          status: totalTasks === 1 ? "completed" : "started",
          completedAt: new Date(),
        };
        analytics.completedTopics.push(topicRecord);
      } else {
        if (topicRecord.completedTasksCount < totalTasks) {
          topicRecord.completedTasksCount += 1;
        }
        if (topicRecord.completedTasksCount >= totalTasks) {
          topicRecord.status = "completed";
        }
        topicRecord.completedAt = new Date();
      }

      await analytics.save();
      await recordUserPractice(userId);

      return sendSuccessResponse(res, "Topic task progress recorded successfully", {
        topicId,
        completedTasksCount: topicRecord.completedTasksCount,
        totalTasksCount: totalTasks,
        status: topicRecord.status,
        isCompleted: topicRecord.status === "completed",
        progressPercent: totalTasks > 0 ? Math.round((topicRecord.completedTasksCount / totalTasks) * 100) : 0,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async startTopicLesson(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      const user = await UserModel.findById(userId);
      const targetLanguage = user?.onboarding?.languageToLearn || topic.languageToLearn || "English";
      const nativeLanguage = user?.onboarding?.nativeLanguage || "Spanish";

      let analytics = await AnalyticsModel.findOne({ userId });
      if (!analytics) {
        analytics = new AnalyticsModel({ userId });
      }

      const totalTasks = topic.tasks ? topic.tasks.length : 0;
      let topicRecord = analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString());
      if (!topicRecord) {
        topicRecord = {
          topicId: topic._id.toString(),
          completedTasksCount: 0,
          status: "started",
          completedAt: new Date(),
        };
        analytics.completedTopics.push(topicRecord);
        await analytics.save();
      }

      const completedCount = topicRecord.completedTasksCount || 0;
      const activeTaskIndex = Math.min(completedCount, Math.max(0, totalTasks - 1));
      const activeTask = topic.tasks && topic.tasks[activeTaskIndex] ? topic.tasks[activeTaskIndex] : null;

      let chatSession = await TopicChatModel.findOne({ userId, topicId: topic._id });
      if (!chatSession) {
        chatSession = new TopicChatModel({
          userId,
          topicId: topic._id,
          topicName: topic.title,
          messages: [],
        });
      }


      if (chatSession.messages.length === 0) {
        const firstPoint = activeTask && activeTask.points && activeTask.points.length > 0
          ? activeTask.points[0]
          : `Let's practice: "${topic.title}"`;

        const openerText = `That's a great goal! ${topic.title} is a big part of professional life. Let's start with something simple. Try saying: "${firstPoint}"`;
        let openerTranslation = "";
        try {
          openerTranslation = await translateText(openerText, nativeLanguage);
        } catch (e) {
          openerTranslation = "";
        }

        let openerAudioUrl = null;
        try {
          const audioBuf = await textToSpeech(openerText);
          const uploadRes = await uploadFile({
            originalname: `topic_opener_${Date.now()}.mp3`,
            buffer: audioBuf,
            mimetype: "audio/mpeg",
          });
          openerAudioUrl = uploadRes.url;
        } catch (e) {
          console.warn("TTS failed for topic opener:", e.message);
        }

        chatSession.messages.push({
          sender: "tutor",
          text: openerText,
          audioUrl: openerAudioUrl,
          translation: openerTranslation,
          feedbackText: "Welcome to this interactive lesson! Speak naturally to complete each task.",
        });
        await chatSession.save();
      }

      const tasksWithStatus = (topic.tasks || []).map((task, index) => ({
        _id: task._id,
        order: index + 1,
        title: task.title,
        description: task.description || "",
        points: Array.isArray(task.points) ? task.points : [],
        isCompleted: index < completedCount,
      }));

      return sendSuccessResponse(res, "Topic lesson started successfully", {
        topic: {
          _id: topic._id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          categorySubtitle: topic.categorySubtitle || "",
          difficulty: topic.difficulty,
          termsCount: topic.termsCount || totalTasks,
          image: topic.image || "",
          languageToLearn: targetLanguage,
          whatYouWillLearn: topic.whatYouWillLearn,
        },
        activeTask: activeTask
          ? {
            _id: activeTask._id,
            order: activeTaskIndex + 1,
            title: activeTask.title,
            description: activeTask.description || "",
            points: activeTask.points || [],
            isCompleted: activeTaskIndex < completedCount,
          }
          : null,
        tasks: tasksWithStatus,
        completedTasksCount: completedCount,
        totalTasksCount: totalTasks,
        progressPercent: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
        isCompleted: topicRecord.status === "completed",
        status: topicRecord.status,
        messages: chatSession.messages,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async sendTopicMessage(req, res) {
    try {
      const userId = req.user._id;
      const { topicId, taskId } = req.body;

      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
        return sendBadRequestResponse(res, "Valid topicId is required.");
      }

      const topic = await TopicModel.findById(topicId);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      const user = await UserModel.findById(userId);
      const targetLanguage = req.body.targetLanguage || user?.onboarding?.languageToLearn || topic.languageToLearn || "English";
      const nativeLanguage = req.body.nativeLanguage || user?.onboarding?.nativeLanguage || "Spanish";

      const hasAudio = !!req.file;
      const hasText = !!(req.body.text && req.body.text.trim());
      const hasTaskId = !!(taskId && taskId.trim());


      const inputCount = (hasAudio ? 1 : 0) + (hasText ? 1 : 0) + (hasTaskId ? 1 : 0);

      if (inputCount === 0) {
        return sendBadRequestResponse(
          res,
          "Please provide either 'audio' file, 'text' message, or 'taskId' to select a task (only one at a time)."
        );
      }

      if (inputCount > 1) {
        return sendBadRequestResponse(
          res,
          "Please provide only ONE input at a time: either 'audio', 'text', or 'taskId' (do not send them together)."
        );
      }

      let userText = "";
      let userAudioUrl = null;

      if (hasAudio) {
        try {
          const uploadRes = await uploadFile(req.file);
          userAudioUrl = uploadRes.url;
          userText = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
        } catch (err) {
          return sendErrorResponse(res, 500, "Failed to process audio file", err);
        }
      } else if (hasText) {
        userText = req.body.text.trim();
      }

      let userTranslation = "";
      if (userText) {
        try {
          userTranslation = await translateText(userText, nativeLanguage);
        } catch (err) {
          console.warn("User translation failed:", err.message);
        }
      }


      let chatSession = await TopicChatModel.findOne({ userId, topicId: topic._id });
      if (!chatSession) {
        chatSession = new TopicChatModel({
          userId,
          topicId: topic._id,
          topicName: topic.title,
          messages: [],
        });
      }

      const conversationHistory = chatSession.messages.slice(-10).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));


      let analytics = await AnalyticsModel.findOne({ userId });
      if (!analytics) {
        analytics = new AnalyticsModel({ userId });
      }

      let topicRecord = analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString());
      if (!topicRecord) {
        topicRecord = {
          topicId: topic._id.toString(),
          completedTasksCount: 0,
          status: "started",
          completedAt: new Date(),
        };
        analytics.completedTopics.push(topicRecord);
      }

      const totalTasks = topic.tasks ? topic.tasks.length : 0;
      let completedCount = topicRecord.completedTasksCount || 0;


      if (hasTaskId) {
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
          return sendBadRequestResponse(res, "Invalid taskId.");
        }

        const taskIndex = (topic.tasks || []).findIndex((t) => t._id.toString() === taskId.toString());
        if (taskIndex === -1) {
          return sendNotFoundResponse(res, "Task not found in this topic.");
        }

        const selectedTask = topic.tasks[taskIndex];
        const taskPoint = selectedTask.points && selectedTask.points.length > 0
          ? selectedTask.points[0]
          : selectedTask.description || selectedTask.title;

        const aiPrompt = `Let's work on task ${taskIndex + 1}: "${selectedTask.title}". ${taskPoint}`;
        let promptTranslation = "";
        try {
          promptTranslation = await translateText(aiPrompt, nativeLanguage);
        } catch (e) {
          promptTranslation = "";
        }

        let promptAudioUrl = null;
        try {
          const ttsBuf = await textToSpeech(aiPrompt);
          const uploadRes = await uploadFile({
            originalname: `task_prompt_${Date.now()}.mp3`,
            buffer: ttsBuf,
            mimetype: "audio/mpeg",
          });
          promptAudioUrl = uploadRes.url;
        } catch (e) {
          console.warn("TTS generation failed for task selection:", e.message);
        }

        chatSession.messages.push({
          sender: "tutor",
          text: aiPrompt,
          audioUrl: promptAudioUrl,
          translation: promptTranslation,
          feedbackText: `Switched to Task ${taskIndex + 1}: ${selectedTask.title}`,
        });
        await chatSession.save();

        const tasksWithStatus = (topic.tasks || []).map((task, index) => ({
          _id: task._id,
          order: index + 1,
          title: task.title,
          description: task.description || "",
          points: Array.isArray(task.points) ? task.points : [],
          isCompleted: index < completedCount,
        }));

        return sendSuccessResponse(res, "Task selected successfully", {
          aiReply: aiPrompt,
          tutorAudioUrl: promptAudioUrl,
          translation: promptTranslation,
          activeTask: {
            _id: selectedTask._id,
            order: taskIndex + 1,
            title: selectedTask.title,
            description: selectedTask.description || "",
            points: selectedTask.points || [],
            isCompleted: taskIndex < completedCount,
          },
          tasks: tasksWithStatus,
          completedTasksCount: completedCount,
          totalTasksCount: totalTasks,
          progressPercent: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
          isTopicCompleted: topicRecord.status === "completed",
        });
      }


      let activeTaskIndex = completedCount < totalTasks ? completedCount : totalTasks - 1;
      const activeTask = topic.tasks && topic.tasks[activeTaskIndex] ? topic.tasks[activeTaskIndex] : null;
      const nextTask = topic.tasks && topic.tasks[activeTaskIndex + 1] ? topic.tasks[activeTaskIndex + 1] : null;


      const tutorResponse = await generateTopicTutorResponse({
        userText,
        topicTitle: topic.title,
        topicDescription: topic.description,
        activeTask,
        nextTask,
        targetLanguage,
        nativeLanguage,
        conversationHistory,
        audioBuffer: req.file ? req.file.buffer : null,
        audioMimeType: req.file ? req.file.mimetype : null,
      });

      const {
        aiReply,
        translation,
        grammarScore,
        feedbackText,
        pronunciationScore,
        pronunciationFeedback,
        isTaskCompleted,
      } = tutorResponse;


      let tutorAudioUrl = null;
      try {
        const tutorAudioBuf = await textToSpeech(aiReply);
        const uploadRes = await uploadFile({
          originalname: `tutor_reply_${Date.now()}.mp3`,
          buffer: tutorAudioBuf,
          mimetype: "audio/mpeg",
        });
        tutorAudioUrl = uploadRes.url;
      } catch (err) {
        console.warn("TTS generation failed:", err.message);
      }


      let justCompletedTask = null;
      if (isTaskCompleted && activeTask) {
        if (activeTaskIndex === completedCount && completedCount < totalTasks) {
          topicRecord.completedTasksCount += 1;
          completedCount = topicRecord.completedTasksCount;
          justCompletedTask = {
            _id: activeTask._id,
            title: activeTask.title,
            isCompleted: true,
          };
        }
        if (completedCount >= totalTasks) {
          topicRecord.status = "completed";
        }
        topicRecord.completedAt = new Date();
      }

      await analytics.save();
      const updatedStreak = await recordUserPractice(userId);


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
        pronunciationScore: req.file ? (pronunciationScore || 85) : null,
        pronunciationFeedback: req.file ? (pronunciationFeedback || "Good pronunciation!") : null,
      });

      await chatSession.save();

      const newActiveIndex = Math.min(completedCount, Math.max(0, totalTasks - 1));
      const currentActiveTask = topic.tasks && topic.tasks[newActiveIndex] ? topic.tasks[newActiveIndex] : null;

      const tasksWithStatus = (topic.tasks || []).map((task, index) => ({
        _id: task._id,
        order: index + 1,
        title: task.title,
        description: task.description || "",
        points: Array.isArray(task.points) ? task.points : [],
        isCompleted: index < completedCount,
      }));

      return sendSuccessResponse(res, "Topic message processed successfully", {
        userText,
        userAudioUrl,
        userTranslation,
        aiReply,
        tutorAudioUrl,
        translation,
        grammarScore,
        feedbackText,
        pronunciationScore: req.file ? (pronunciationScore || 85) : null,
        pronunciationFeedback: req.file ? (pronunciationFeedback || "Good pronunciation!") : null,
        isTaskCompleted: !!isTaskCompleted,
        justCompletedTask,
        activeTask: currentActiveTask
          ? {
            _id: currentActiveTask._id,
            order: newActiveIndex + 1,
            title: currentActiveTask.title,
            description: currentActiveTask.description || "",
            points: currentActiveTask.points || [],
            isCompleted: newActiveIndex < completedCount,
          }
          : null,
        tasks: tasksWithStatus,
        completedTasksCount: completedCount,
        totalTasksCount: totalTasks,
        progressPercent: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
        isTopicCompleted: topicRecord.status === "completed",
        streakDays: updatedStreak || 0,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async getTopicChatHistory(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const history = await TopicChatModel.find({ userId, topicId: id }).sort({ updatedAt: -1 });
      if (!history || history.length === 0) {
        return sendNotFoundResponse(res, "No any history found...");
      }

      return sendSuccessResponse(res, "Chat history retrieved successfully", history);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }


  static async resetTopicProgress(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      let analytics = await AnalyticsModel.findOne({ userId });
      if (analytics) {
        analytics.completedTopics = analytics.completedTopics.filter(
          (ct) => ct.topicId !== topic._id.toString()
        );
        await analytics.save();
      }


      await TopicChatModel.deleteMany({ userId, topicId: id });

      return sendSuccessResponse(res, "Topic progress and chat history reset successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }
}