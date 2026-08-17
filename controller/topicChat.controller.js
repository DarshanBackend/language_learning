import mongoose from "mongoose";
import TopicModel from "../model/topic.model.js";
import TopicChatSessionModel from "../model/topicChatSession.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import { uploadFile } from "../middleware/imageupload.js";
import { transcribeAudio, textToSpeech, generateTaskChatResponse } from "../services/aiService.js";
import {
    sendSuccessResponse,
    sendCreatedResponse,
    sendErrorResponse,
    sendNotFoundResponse,
    sendBadRequestResponse,
} from "../utils/Response.utils.js";

export class TopicChatController {
    /**
     * Start (or resume) a topic's AI chat practice session.
     * POST /user/topic/:topicId/chat/start
     */
    static async startTopicChat(req, res) {
        try {
            const { topicId } = req.params;
            const userId = req.user._id;

            if (!mongoose.Types.ObjectId.isValid(topicId)) {
                return sendBadRequestResponse(res, "Invalid Topic ID");
            }

            const topic = await TopicModel.findById(topicId);
            if (!topic) {
                return sendNotFoundResponse(res, "Topic not found");
            }

            if (!topic.tasks || topic.tasks.length === 0) {
                return sendBadRequestResponse(res, "This topic has no tasks configured yet.");
            }

            let session = await TopicChatSessionModel.findOne({ userId, topicId });

            // Resume an existing, unfinished session as-is
            if (session && session.status === "in_progress") {
                return sendSuccessResponse(res, "Resumed existing chat session", session);
            }

            // Fresh start (either first time, or restarting after completion)
            const firstTask = topic.tasks[0];

            const aiResult = await generateTaskChatResponse({
                topicTitle: topic.title,
                topicDescription: topic.description,
                currentTask: firstTask,
                conversationHistory: [],
                userText: "(Session just started, greet the student and introduce the first task.)",
                targetLanguage: topic.languageToLearn,
            });

            const taskProgress = topic.tasks.map((task, index) => ({
                taskIndex: index,
                title: task.title,
                completed: false,
                completedAt: null,
            }));

            const firstMessage = {
                role: "ai",
                text: aiResult.aiReply,
                translation: aiResult.translation || "",
                relatedTaskIndex: 0,
            };

            if (session) {
                // Restarting a previously completed session
                session.messages = [firstMessage];
                session.taskProgress = taskProgress;
                session.currentTaskIndex = 0;
                session.status = "in_progress";
                await session.save();
            } else {
                session = await TopicChatSessionModel.create({
                    userId,
                    topicId,
                    messages: [firstMessage],
                    taskProgress,
                    currentTaskIndex: 0,
                    status: "in_progress",
                });
            }

            return sendCreatedResponse(res, "Chat session started", session);
        } catch (error) {
            return sendErrorResponse(res, 500, error.message, error);
        }
    }

    /**
     * Send a message (text or audio) in the topic chat.
     * The AI judges whether the current task was practiced; if so it moves
     * to the next task, and marks the topic completed when all tasks are done.
     * POST /user/topic/:topicId/chat/message   (multipart if sending audio, field name "audio")
     * body: { text }  -- required if no audio file is attached
     */
    static async sendMessage(req, res) {
        try {
            const { topicId } = req.params;
            const userId = req.user._id;
            let { text } = req.body;

            if (!mongoose.Types.ObjectId.isValid(topicId)) {
                return sendBadRequestResponse(res, "Invalid Topic ID");
            }

            const topic = await TopicModel.findById(topicId);
            if (!topic) {
                return sendNotFoundResponse(res, "Topic not found");
            }

            const session = await TopicChatSessionModel.findOne({ userId, topicId });
            if (!session) {
                return sendBadRequestResponse(res, "No active chat session. Start the chat first.");
            }

            if (session.status === "completed") {
                return sendBadRequestResponse(res, "This topic's chat is already completed.");
            }

            let userAudioUrl = null;

            // If the user sent a voice message, transcribe it first
            if (req.file) {
                try {
                    text = await transcribeAudio(req.file.buffer, req.file.originalname, req.file.mimetype);
                    const uploadResult = await uploadFile(req.file);
                    userAudioUrl = uploadResult.url;
                } catch (err) {
                    return sendErrorResponse(res, 500, "Failed to transcribe audio", err);
                }
            }

            if (!text || !text.trim()) {
                return sendBadRequestResponse(res, "Message text (or an audio file) is required.");
            }

            const currentTaskIndex = session.currentTaskIndex;
            const currentTask = topic.tasks[currentTaskIndex];

            if (!currentTask) {
                return sendBadRequestResponse(res, "No active task found. This topic may already be complete.");
            }

            // Push the user's message first
            session.messages.push({
                role: "user",
                text: text.trim(),
                audioUrl: userAudioUrl,
                relatedTaskIndex: currentTaskIndex,
            });

            const conversationHistory = session.messages.map((m) => ({ role: m.role, text: m.text }));

            const aiResult = await generateTaskChatResponse({
                topicTitle: topic.title,
                topicDescription: topic.description,
                currentTask,
                conversationHistory,
                userText: text.trim(),
                targetLanguage: topic.languageToLearn,
            });

            let isTopicCompleted = false;
            let nextTaskIndex = currentTaskIndex;

            if (aiResult.taskCompleted) {
                const progressEntry = session.taskProgress.find((t) => t.taskIndex === currentTaskIndex);
                if (progressEntry && !progressEntry.completed) {
                    progressEntry.completed = true;
                    progressEntry.completedAt = new Date();
                }

                if (currentTaskIndex + 1 < topic.tasks.length) {
                    nextTaskIndex = currentTaskIndex + 1;
                } else {
                    isTopicCompleted = true;
                }
            }

            session.messages.push({
                role: "ai",
                text: aiResult.aiReply,
                translation: aiResult.translation || "",
                relatedTaskIndex: isTopicCompleted ? currentTaskIndex : nextTaskIndex,
            });

            session.currentTaskIndex = nextTaskIndex;
            session.status = isTopicCompleted ? "completed" : "in_progress";
            await session.save();

            // Generate TTS audio for the AI reply so the client can play it back
            let aiAudioUrl = null;
            try {
                const audioBuffer = await textToSpeech(aiResult.aiReply);
                const mockFile = {
                    originalname: `topic_${topicId}_reply_${Date.now()}.mp3`,
                    buffer: audioBuffer,
                    mimetype: "audio/mpeg",
                };
                const uploadResult = await uploadFile(mockFile);
                aiAudioUrl = uploadResult.url;
            } catch (ttsErr) {
                console.warn("⚠️ TTS generation failed for topic chat reply:", ttsErr.message);
            }

            // If the whole topic just got completed, sync it into Analytics too
            if (isTopicCompleted) {
                let analytics = await AnalyticsModel.findOne({ userId });
                if (!analytics) {
                    analytics = new AnalyticsModel({ userId });
                }

                let topicRecord = analytics.completedTopics.find((ct) => ct.topicId === topicId.toString());
                if (!topicRecord) {
                    analytics.completedTopics.push({
                        topicId: topicId.toString(),
                        completedTasksCount: topic.tasks.length,
                        status: "completed",
                        completedAt: new Date(),
                    });
                } else {
                    topicRecord.completedTasksCount = topic.tasks.length;
                    topicRecord.status = "completed";
                    topicRecord.completedAt = new Date();
                }

                // small nudge to the speaking trend, mirrors recordCompletedLesson's smoothing style
                analytics.speakingTrendScore = Math.min(100, Math.round(analytics.speakingTrendScore * 0.9 + 10));
                await analytics.save();
            } else {
                // Keep completedTasksCount roughly in sync while still in progress
                const completedCount = session.taskProgress.filter((t) => t.completed).length;
                let analytics = await AnalyticsModel.findOne({ userId });
                if (!analytics) {
                    analytics = new AnalyticsModel({ userId });
                }
                let topicRecord = analytics.completedTopics.find((ct) => ct.topicId === topicId.toString());
                if (!topicRecord) {
                    analytics.completedTopics.push({
                        topicId: topicId.toString(),
                        completedTasksCount: completedCount,
                        status: "started",
                    });
                } else if (topicRecord.status !== "completed") {
                    topicRecord.completedTasksCount = completedCount;
                    topicRecord.status = "started";
                }
                await analytics.save();
            }

            return sendSuccessResponse(res, "Message processed successfully", {
                aiReply: aiResult.aiReply,
                translation: aiResult.translation,
                feedbackText: aiResult.feedbackText,
                aiAudioUrl,
                taskCompleted: !!aiResult.taskCompleted,
                currentTaskIndex: session.currentTaskIndex,
                isTopicCompleted,
                taskProgress: session.taskProgress,
                messages: session.messages,
            });
        } catch (error) {
            return sendErrorResponse(res, 500, error.message, error);
        }
    }

    /**
     * Get the chat history + task progress for a topic.
     * GET /user/topic/:topicId/chat/history
     */
    static async getChatHistory(req, res) {
        try {
            const { topicId } = req.params;
            const userId = req.user._id;

            if (!mongoose.Types.ObjectId.isValid(topicId)) {
                return sendBadRequestResponse(res, "Invalid Topic ID");
            }

            const session = await TopicChatSessionModel.findOne({ userId, topicId });
            if (!session) {
                return sendNotFoundResponse(res, "No chat session found for this topic yet.");
            }

            return sendSuccessResponse(res, "Chat history fetched successfully", session);
        } catch (error) {
            return sendErrorResponse(res, 500, error.message, error);
        }
    }
}