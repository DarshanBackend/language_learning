import mongoose from "mongoose";
import TopicModel from "../model/topic.model.js";
import JourneyLessonModel from "../model/journeyLesson.model.js";
import JourneyQuestionModel from "../model/journeyQuestion.model.js";
import AnalyticsModel from "../model/analytics.model.js";
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
      const { title, description, category, difficulty, languageToLearn, whatYouWillLearn, tasks, journeyLessonId } = req.body;

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

      // Handle tasks: parses JSON array or splits string list
      let parsedTasks = [];
      if (tasks) {
        if (Array.isArray(tasks)) {
          parsedTasks = tasks.map(t => ({
            title: t.title ? t.title.trim() : "",
            description: t.description ? t.description.trim() : "",
          }));
        } else {
          try {
            parsedTasks = JSON.parse(tasks).map(t => ({
              title: t.title ? t.title.trim() : "",
              description: t.description ? t.description.trim() : "",
            }));
          } catch (e) {
            parsedTasks = tasks.split(",").map(t => ({
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
          parsedLearnList = whatYouWillLearn.map(item => item.trim());
        } else {
          try {
            parsedLearnList = JSON.parse(whatYouWillLearn).map(item => item.trim());
          } catch (e) {
            parsedLearnList = whatYouWillLearn.split(",").map(item => item.trim());
          }
        }
      }

      const topic = await TopicModel.create({
        title: title.trim(),
        description: description ? description.trim() : "",
        category: category.trim(),
        difficulty: difficulty || "Easy",
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
      const { title, description, category, difficulty, languageToLearn, whatYouWillLearn, tasks, journeyLessonId } = req.body;

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
      if (difficulty !== undefined) updateData.difficulty = difficulty;
      if (languageToLearn !== undefined) updateData.languageToLearn = languageToLearn.trim();

      if (whatYouWillLearn !== undefined) {
        if (Array.isArray(whatYouWillLearn)) {
          updateData.whatYouWillLearn = whatYouWillLearn.map(item => item.trim());
        } else {
          try {
            updateData.whatYouWillLearn = JSON.parse(whatYouWillLearn).map(item => item.trim());
          } catch (e) {
            updateData.whatYouWillLearn = whatYouWillLearn.split(",").map(item => item.trim());
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
          parsedTasks = tasks.map(t => ({
            title: t.title ? t.title.trim() : "",
            description: t.description ? t.description.trim() : "",
          }));
        } else {
          try {
            parsedTasks = JSON.parse(tasks).map(t => ({
              title: t.title ? t.title.trim() : "",
              description: t.description ? t.description.trim() : "",
            }));
          } catch (e) {
            parsedTasks = tasks.split(",").map(t => ({
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

      const updatedTopic = await TopicModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
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
        return sendBadRequestResponse(res, "No Topics found")
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
   * grouped by category with a "Continue" card for the
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

      const mappedTopics = topics.map((topic) => {
        const contentType = topic.journeyLessonId ? "lesson" : "ai_chat";
        let status = "not_started";
        let completedTasksCount = 0;
        let totalTasksCount = topic.tasks.length;
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
          // lesson mode: completion is driven by completedLessons for the linked lesson (supports old lessonId field)
          const record = analytics
            ? analytics.completedLessons
              .filter((cl) => {
                const targetId = cl.journeyLessonId || cl.lessonId;
                return targetId?.toString() === topic.journeyLessonId.toString();
              })
              .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
            : null;
          totalTasksCount = 1; // a lesson counts as one "task" for progress display
          if (record) {
            status = record.status === "completed" ? "completed" : "started";
            completedTasksCount = record.status === "completed" ? 1 : 0;
            lastActivityAt = record.completedAt;
          }
        }

        return {
          _id: topic._id,
          title: topic.title,
          description: topic.description,
          category: topic.category,
          difficulty: topic.difficulty,
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

      const categories = {};
      for (const topic of mappedTopics) {
        if (!categories[topic.category]) {
          categories[topic.category] = [];
        }
        categories[topic.category].push(topic);
      }

      return sendSuccessResponse(res, "Topics fetched successfully", {
        continue: continueTopic,
        categories,
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
        difficulty: topic.difficulty,
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

        return sendSuccessResponse(res, "Topic details fetched successfully", {
          ...base,
          lesson,
          questions,
          isCompleted: record ? record.status === "completed" : false,
        });
      }

      // ai_chat mode
      const completedRecord = analytics
        ? analytics.completedTopics.find((ct) => ct.topicId === topic._id.toString())
        : null;
      const completedCount = completedRecord ? completedRecord.completedTasksCount : 0;

      const tasksWithStatus = (topic.tasks || []).map((task, index) => ({
        _id: task._id,
        title: task.title,
        description: task.description,
        isCompleted: index < completedCount,
      }));

      return sendSuccessResponse(res, "Topic details fetched successfully", {
        ...base,
        tasks: tasksWithStatus,
        completedTasksCount: completedCount,
        isCompleted: completedRecord ? completedRecord.status === "completed" : false,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  /**
   * Record a completed task under an AI-chat Topic.
   * (Only used for contentType = "ai_chat". Lesson-mode topics complete
   * automatically via recordCompletedLesson / the topic chat controller.)
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

      let topicRecord = analytics.completedTopics.find(ct => ct.topicId === topicId.toString());
      if (!topicRecord) {
        topicRecord = {
          topicId: topicId.toString(),
          completedTasksCount: 1,
          status: totalTasks === 1 ? "completed" : "started",
        };
        analytics.completedTopics.push(topicRecord);
      } else {
        if (topicRecord.completedTasksCount < totalTasks) {
          topicRecord.completedTasksCount += 1;
        }
        if (topicRecord.completedTasksCount >= totalTasks) {
          topicRecord.status = "completed";
        }
      }

      await analytics.save();

      return sendSuccessResponse(res, "Topic task progress recorded successfully", {
        topicId,
        completedTasksCount: topicRecord.completedTasksCount,
        status: topicRecord.status,
      });
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }
}