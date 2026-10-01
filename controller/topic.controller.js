import mongoose from "mongoose";
import TopicModel from "../model/topic.model.js";
import JourneyLessonModel from "../model/journeyLesson.model.js";
import JourneyQuestionModel from "../model/journeyQuestion.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import UserModel from "../model/user.model.js";
import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";
import {
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";

export class TopicController {
  // =========================================================================
  // 1. Admin CRUD Operations
  // =========================================================================

  /**
   * Create a new Topic.
   * Pass EITHER journeyLessonId (Mode A: reuse MCQ/speaking/response lesson flow)
   * OR tasks (Mode B: AI task-chat flow) - never both.
   */
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
        journeyLessonId,
      } = req.body;

      if (!title || !category || !languageToLearn) {
        return sendBadRequestResponse(res, "Title, category, and languageToLearn are required.");
      }

      if (journeyLessonId && !mongoose.Types.ObjectId.isValid(journeyLessonId)) {
        return sendBadRequestResponse(res, "Invalid Journey Lesson ID");
      }

      if (journeyLessonId) {
        const lesson = await JourneyLessonModel.findById(journeyLessonId);
        if (!lesson) {
          return sendNotFoundResponse(res, "Linked Journey Lesson not found");
        }
      }

      // Handle image upload from file or fallback to string body
      let imageUrl = image || "";
      if (req.file) {
        try {
          const uploadRes = await uploadFile(req.file);
          imageUrl = uploadRes.url;
        } catch (uploadErr) {
          return sendErrorResponse(res, 500, "Failed to upload topic image", uploadErr);
        }
      }

      // Handle tasks: parses JSON array or splits string list
      let parsedTasks = [];
      if (tasks) {
        if (Array.isArray(tasks)) {
          parsedTasks = tasks.map((t) => ({
            title: t.title ? t.title.trim() : "",
            description: t.description ? t.description.trim() : "",
          }));
        } else {
          try {
            parsedTasks = JSON.parse(tasks).map((t) => ({
              title: t.title ? t.title.trim() : "",
              description: t.description ? t.description.trim() : "",
            }));
          } catch (e) {
            parsedTasks = tasks.split(",").map((t) => ({
              title: t.trim(),
              description: "",
            }));
          }
        }
      }

      if (journeyLessonId && parsedTasks.length > 0) {
        return sendBadRequestResponse(res, "Provide either journeyLessonId or tasks, not both.");
      }
      if (!journeyLessonId && parsedTasks.length === 0) {
        return sendBadRequestResponse(res, "Provide journeyLessonId (lesson flow) or tasks (AI chat flow).");
      }

      // Handle whatYouWillLearn
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

      const countTerms = termsCount !== undefined && termsCount !== null
        ? Number(termsCount)
        : parsedTasks.length > 0
          ? parsedTasks.length
          : 0;

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
        journeyLessonId: journeyLessonId || null,
        tasks: parsedTasks,
      });

      return sendCreatedResponse(res, "Topic created successfully", topic);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Update an existing Topic
   */
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
        journeyLessonId,
      } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Topic ID");
      }

      const topic = await TopicModel.findById(id);
      if (!topic) {
        return sendNotFoundResponse(res, "Topic not found");
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (category !== undefined) updateData.category = category.trim();
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
        updateData.image = image;
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

      if (journeyLessonId !== undefined) {
        if (journeyLessonId) {
          if (!mongoose.Types.ObjectId.isValid(journeyLessonId)) {
            return sendBadRequestResponse(res, "Invalid Journey Lesson ID");
          }
          const lesson = await JourneyLessonModel.findById(journeyLessonId);
          if (!lesson) {
            return sendNotFoundResponse(res, "Linked Journey Lesson not found");
          }
          updateData.journeyLessonId = journeyLessonId;
          updateData.tasks = []; // switching to lesson mode clears tasks
        } else {
          updateData.journeyLessonId = null;
        }
      }

      if (tasks !== undefined) {
        let parsedTasks = [];
        if (Array.isArray(tasks)) {
          parsedTasks = tasks.map((t) => ({
            title: t.title ? t.title.trim() : "",
            description: t.description ? t.description.trim() : "",
          }));
        } else {
          try {
            parsedTasks = JSON.parse(tasks).map((t) => ({
              title: t.title ? t.title.trim() : "",
              description: t.description ? t.description.trim() : "",
            }));
          } catch (e) {
            parsedTasks = tasks.split(",").map((t) => ({
              title: t.trim(),
              description: "",
            }));
          }
        }
        updateData.tasks = parsedTasks;
        if (parsedTasks.length > 0) {
          updateData.journeyLessonId = null; // switching to AI-chat mode clears journeyLessonId
        }
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

  /**
   * Delete a Topic
   */
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

      await TopicModel.findByIdAndDelete(id);
      return sendSuccessResponse(res, "Topic deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Get all Topics (Admin panel)
   */
  static async getAllTopicsAdmin(req, res) {
    try {
      const topics = await TopicModel.find().populate("journeyLessonId").sort({ createdAt: -1 });

      if (topics.length === 0) {
        return sendBadRequestResponse(res, "No Topics found");
      }

      return sendSuccessResponse(res, "Topics retrieved successfully", topics);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // =========================================================================
  // 2. User Operations
  // =========================================================================

  /**
   * Get all Topics for the user's selected language,
   * grouped by category with category subtitle, and a "Continue" card for the
   * most recently in-progress topic (Figma: Topics screen).
   */
  static async getTopics(req, res) {
    try {
      const languageToLearn = req.user.onboarding?.languageToLearn;
      if (!languageToLearn) {
        return sendBadRequestResponse(res, "Please complete onboarding to select a language.");
      }

      const topics = await TopicModel.find({ languageToLearn }).sort({ createdAt: 1 });
      const analytics = await AnalyticsModel.findOne({ userId: req.user._id });
      const user = await UserModel.findById(req.user._id).select("streakDays");

      const mappedTopics = topics.map((topic) => {
        const contentType = topic.journeyLessonId ? "lesson" : "ai_chat";
        let status = "not_started";
        let completedTasksCount = 0;
        let totalTasksCount = topic.tasks && topic.tasks.length > 0 ? topic.tasks.length : (topic.termsCount || 1);
        let lastActivityAt = null;

        if (contentType === "ai_chat") {
          const record = analytics
            ? analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString())
            : null;
          if (record) {
            status = record.status;
            completedTasksCount = record.completedTasksCount;
            lastActivityAt = record.completedAt;
          }
        } else {
          // lesson mode: completion is driven by completedLessons for the linked lesson
          const record = analytics
            ? analytics.completedLessons
              .filter((cl) => {
                const targetId = cl.journeyLessonId || cl.lessonId;
                return targetId?.toString() === topic.journeyLessonId.toString();
              })
              .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
            : null;
          totalTasksCount = topic.termsCount || 1;
          if (record) {
            status = record.status === "completed" ? "completed" : "started";
            completedTasksCount = record.status === "completed" ? totalTasksCount : 1;
            lastActivityAt = record.completedAt;
          }
        }

        return {
          _id: topic._id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          categorySubtitle: topic.categorySubtitle || "",
          difficulty: topic.difficulty,
          termsCount: topic.termsCount || totalTasksCount,
          image: topic.image || "",
          languageToLearn: topic.languageToLearn,
          contentType,
          journeyLessonId: topic.journeyLessonId || null,
          totalTasksCount,
          completedTasksCount,
          status,
          isCompleted: status === "completed",
          progressPercent: totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0,
          lastActivityAt,
        };
      });

      const inProgressTopics = mappedTopics
        .filter((t) => t.status === "started")
        .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
      const continueTopic = inProgressTopics.length > 0 ? inProgressTopics[0] : null;

      // Group into categories list with subtitle
      const categoriesMap = {};
      for (const topic of mappedTopics) {
        if (!categoriesMap[topic.category]) {
          categoriesMap[topic.category] = {
            name: topic.category,
            subtitle: topic.categorySubtitle || "",
            topics: [],
          };
        }
        categoriesMap[topic.category].topics.push(topic);
      }

      const categoriesList = Object.values(categoriesMap);

      return sendSuccessResponse(res, "Topics fetched successfully", {
        streakDays: user?.streakDays || 0,
        continue: continueTopic,
        categories: categoriesList,
        categoriesMap,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Get specific Topic details.
   * - lesson mode: also returns the linked journey lesson + its questions (Chair/Table/Desk flow)
   * - ai_chat mode: returns tasks with completion status (Participating in meetings flow)
   */
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
      const contentType = topic.journeyLessonId ? "lesson" : "ai_chat";

      const base = {
        _id: topic._id,
        title: topic.title,
        description: topic.description,
        category: topic.category,
        categorySubtitle: topic.categorySubtitle || "",
        difficulty: topic.difficulty,
        termsCount: topic.termsCount || (topic.tasks ? topic.tasks.length : 0),
        image: topic.image || "",
        languageToLearn: topic.languageToLearn,
        whatYouWillLearn: topic.whatYouWillLearn,
        contentType,
      };

      if (contentType === "lesson") {
        const lesson = await JourneyLessonModel.findById(topic.journeyLessonId);
        const questions = await JourneyQuestionModel.find({ journeyLessonId: topic.journeyLessonId, isDeleted: false });

        const record = analytics
          ? analytics.completedLessons
            .filter((cl) => {
              const targetId = cl.journeyLessonId || cl.lessonId;
              return targetId?.toString() === topic.journeyLessonId.toString();
            })
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
          : null;

        const isCompleted = record ? record.status === "completed" : false;
        const status = record ? record.status : "not_started";

        return sendSuccessResponse(res, "Topic details fetched successfully", {
          ...base,
          lesson,
          questions,
          status,
          isCompleted,
          progressPercent: isCompleted ? 100 : status === "started" ? 50 : 0,
        });
      }

      // ai_chat mode
      const completedRecord = analytics
        ? analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString())
        : null;
      const completedCount = completedRecord ? completedRecord.completedTasksCount : 0;
      const totalTasks = topic.tasks ? topic.tasks.length : 0;

      const tasksWithStatus = (topic.tasks || []).map((task, index) => ({
        _id: task._id,
        order: index + 1,
        title: task.title,
        description: task.description,
        isCompleted: index < completedCount,
      }));

      const isCompleted = completedRecord ? completedRecord.status === "completed" : false;
      const status = completedRecord ? completedRecord.status : "not_started";

      return sendSuccessResponse(res, "Topic details fetched successfully", {
        ...base,
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

  /**
   * Record a completed task under an AI-chat Topic.
   */
  static async recordCompletedTask(req, res) {
    try {
      const { topicId } = req.body;
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

      if (topic.journeyLessonId) {
        return sendBadRequestResponse(res, "This topic uses the lesson flow. Complete it via the lesson/question endpoints instead.");
      }

      const totalTasks = topic.tasks.length;

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

  /**
   * Reset Topic progress (for "Start from the beginning" / "Start learning again")
   */
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

      const analytics = await AnalyticsModel.findOne({ userId });
      if (!analytics) {
        return sendSuccessResponse(res, "Topic progress reset successfully");
      }

      if (topic.journeyLessonId) {
        // Reset lesson progress
        analytics.completedLessons = analytics.completedLessons.filter((cl) => {
          const targetId = cl.journeyLessonId || cl.lessonId;
          return targetId?.toString() !== topic.journeyLessonId.toString();
        });
      } else {
        // Reset AI chat topic progress
        analytics.completedTopics = analytics.completedTopics.filter(
          (ct) => ct.topicId !== topic._id.toString()
        );
      }

      await analytics.save();
      return sendSuccessResponse(res, "Topic progress reset successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }
}