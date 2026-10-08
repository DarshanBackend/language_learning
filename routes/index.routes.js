import express from "express";
import { AuthController } from "../controller/auth.controller.js";
import {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getAnalytics,
  getInsights,
  recordCompletedLesson,
  deleteAccount,
} from "../controller/user.controller.js";
import {
  handleVoiceMessage,
  getChatHistory,
  getConversationHint,
  deleteChatHistory,
} from "../controller/chatController.js";
import {
  createPaymentIntent,
  confirmSubscriptionPayment,
  testPayPaymentIntent,
  cancelSubscription,
  getMySubscriptionStatus,
  addFamilyMember,
  removeFamilyMember,
  getFamilyMembers,
} from "../controller/subscriptionController.js";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification as deleteNotificationController,
  clearAllNotifications,
} from "../controller/notification.controller.js";
import { UserAuth, adminAuth, requireSubscription } from "../middleware/auth.middleware.js";
import { upload, listBucketObjects, deleteManyFromS3 } from "../middleware/imageupload.js";
import { OnboardingOptionController } from "../controller/onboardingOption.controller.js";
import {
  sendResponse,
  sendSuccessResponse,
  sendErrorResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";
import {
  createHelpCenter,
  updateHelpCenter,
  deleteHelpCenter,
  getHelpCenterById,
  getAllHelpCenter,
} from "../controller/helpCenter.controller.js";
import {
  createTermsConditions,
  getTermsConditionsById,
  getAllTermsConditions,
  updateTermsConditions,
  deleteTermsConditions,
  getTermsConditions,
  updateTermsConditionsHeader,
} from "../controller/termsConditions.controller.js";
import {
  createPrivacyPolicy,
  getPrivacyPolicyById,
  getAllPrivacyPolicy,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
} from "../controller/privacyPolicy.controller.js";
import {
  createAppInfo,
  getAllAppInfo,
  getAppInfoById,
  updateAppInfo,
  deleteAppInfo,
} from "../controller/appInfo.controller.js";
import {
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from "../controller/subcriptionPlan.controller.js";
import { JourneyController } from "../controller/journey.controller.js";
import { TopicController } from "../controller/topic.controller.js";

const indexRouter = express.Router();


indexRouter.post("/auth/register", AuthController.register);
indexRouter.post("/auth/login", AuthController.login);


indexRouter.post("/auth/forgot-password", AuthController.sendForgotMailOtp);
indexRouter.post("/auth/verify-otp", AuthController.verifyForgetOtp);
indexRouter.post("/auth/reset-password", AuthController.resetPassword);


indexRouter.post("/auth/change-password", UserAuth, AuthController.changePassword);

indexRouter.get("/auth/me", UserAuth, AuthController.getUser);
indexRouter.post("/auth/logout", UserAuth, AuthController.logout);
indexRouter.patch("/auth/update-fcm-token", UserAuth, AuthController.updateFcmToken);


indexRouter.patch("/user/updateProfile", UserAuth, upload.single("avatar"), updateProfile);
indexRouter.get("/user/getProfile", UserAuth, getProfile);

indexRouter.patch("/user/updateSettings", UserAuth, updateSettings);
indexRouter.get("/user/getSettings", UserAuth, getSettings);

indexRouter.patch("/user/updateAnalytics", UserAuth, requireSubscription, recordCompletedLesson);
indexRouter.get("/user/getAnalytics", UserAuth, getAnalytics);
indexRouter.get("/user/getInsights", UserAuth, getInsights);

indexRouter.delete("/user/deleteAccount", UserAuth, deleteAccount);


indexRouter.post("/chat/message", UserAuth, requireSubscription, upload.single("audio"), handleVoiceMessage);
indexRouter.post("/chat/hint", UserAuth, requireSubscription, getConversationHint);
indexRouter.get("/chat/history", UserAuth, requireSubscription, getChatHistory);
indexRouter.delete("/deleteChatHistory", UserAuth, deleteChatHistory);


indexRouter.get("/getAllSubscriptionPlans", getAllSubscriptionPlans);
indexRouter.get("/getSubscriptionPlanById/:id", getSubscriptionPlanById);


indexRouter.get("/getMySubscriptionStatus", UserAuth, getMySubscriptionStatus);
indexRouter.post("/createPaymentIntent/:planId", UserAuth, createPaymentIntent);
indexRouter.post("/confirmSubscriptionPayment", UserAuth, confirmSubscriptionPayment);
indexRouter.post("/cancelSubscription", UserAuth, cancelSubscription);


indexRouter.post("/testPayPaymentIntent", UserAuth, testPayPaymentIntent);


indexRouter.get("/getFamilyMembers", UserAuth, getFamilyMembers);
indexRouter.post("/addFamilyMember", UserAuth, addFamilyMember);
indexRouter.post("/removeFamilyMember", UserAuth, removeFamilyMember);


indexRouter.post("/admin/createSubscriptionPlan", UserAuth, adminAuth, createSubscriptionPlan);
indexRouter.put("/admin/updateSubscriptionPlan/:id", UserAuth, adminAuth, updateSubscriptionPlan);
indexRouter.delete("/admin/deleteSubscriptionPlan/:id", UserAuth, adminAuth, deleteSubscriptionPlan);


indexRouter.get("/getMyNotifications", UserAuth, getMyNotifications);
indexRouter.patch("/markNotificationRead/:id", UserAuth, markNotificationRead);
indexRouter.patch("/markAllNotificationsRead", UserAuth, markAllNotificationsRead);
indexRouter.delete("/deleteNotificationController/:id", UserAuth, deleteNotificationController);
indexRouter.delete("/clearAllNotifications", UserAuth, clearAllNotifications);


indexRouter.get("/onboarding/options", OnboardingOptionController.getAllOptions);


indexRouter.post("/admin/onboarding/createLanguage", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.createLanguage);
indexRouter.get("/onboarding/getLanguages", OnboardingOptionController.getLanguages);
indexRouter.put("/admin/onboarding/updateLanguage/:id", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.updateLanguage);
indexRouter.delete("/admin/onboarding/deleteLanguage/:id", UserAuth, adminAuth, OnboardingOptionController.deleteLanguage);


indexRouter.post("/admin/onboarding/createLevel", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.createLevel);
indexRouter.get("/onboarding/getLevels", OnboardingOptionController.getLevels);
indexRouter.put("/admin/onboarding/updateLevel/:id", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.updateLevel);
indexRouter.delete("/admin/onboarding/deleteLevel/:id", UserAuth, adminAuth, OnboardingOptionController.deleteLevel);


indexRouter.post("/admin/onboarding/createNativeLanguage", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.createNativeLanguage);
indexRouter.get("/onboarding/getNativeLanguages", OnboardingOptionController.getNativeLanguages);
indexRouter.put("/admin/onboarding/updateNativeLanguage/:id", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.updateNativeLanguage);
indexRouter.delete("/admin/onboarding/deleteNativeLanguage/:id", UserAuth, adminAuth, OnboardingOptionController.deleteNativeLanguage);


indexRouter.post("/admin/onboarding/createGoal", UserAuth, adminAuth, OnboardingOptionController.createGoal);
indexRouter.get("/onboarding/getGoals", OnboardingOptionController.getGoals);
indexRouter.put("/admin/onboarding/updateGoal/:id", UserAuth, adminAuth, OnboardingOptionController.updateGoal);
indexRouter.delete("/admin/onboarding/deleteGoal/:id", UserAuth, adminAuth, OnboardingOptionController.deleteGoal);


indexRouter.post("/admin/onboarding/createCommitment", UserAuth, adminAuth, OnboardingOptionController.createCommitment);
indexRouter.get("/onboarding/getCommitments", OnboardingOptionController.getCommitments);
indexRouter.put("/admin/onboarding/updateCommitment/:id", UserAuth, adminAuth, OnboardingOptionController.updateCommitment);
indexRouter.delete("/admin/onboarding/deleteCommitment/:id", UserAuth, adminAuth, OnboardingOptionController.deleteCommitment);


indexRouter.post("/admin/onboarding/createInterest", UserAuth, adminAuth, OnboardingOptionController.createInterest);
indexRouter.get("/onboarding/getInterests", OnboardingOptionController.getInterests);
indexRouter.put("/admin/onboarding/updateInterest/:id", UserAuth, adminAuth, OnboardingOptionController.updateInterest);
indexRouter.delete("/admin/onboarding/deleteInterest/:id", UserAuth, adminAuth, OnboardingOptionController.deleteInterest);


indexRouter.post("/admin/createHelpCenter", UserAuth, adminAuth, createHelpCenter);
indexRouter.get("/getAllHelpCenter", getAllHelpCenter);
indexRouter.get("/getHelpCenterById/:id", getHelpCenterById);
indexRouter.put("/admin/updateHelpCenter/:id", UserAuth, adminAuth, updateHelpCenter);
indexRouter.delete("/admin/deleteHelpCenter/:id", UserAuth, adminAuth, deleteHelpCenter);


indexRouter.post("/admin/createTermsConditions", UserAuth, adminAuth, createTermsConditions);
indexRouter.get("/getAllTermsConditions", getAllTermsConditions);
indexRouter.get("/getTermsConditionsById/:id", getTermsConditionsById);
indexRouter.put("/admin/updateTermsConditions/:id", UserAuth, adminAuth, updateTermsConditions);
indexRouter.delete("/admin/deleteTermsConditions/:id", UserAuth, adminAuth, deleteTermsConditions);
indexRouter.get("/getTermsConditions", getTermsConditions);
indexRouter.put("/admin/updateTermsConditionsHeader", UserAuth, adminAuth, updateTermsConditionsHeader);


indexRouter.post("/admin/createPrivacyPolicy", UserAuth, adminAuth, createPrivacyPolicy);
indexRouter.get("/getAllPrivacyPolicy", getAllPrivacyPolicy);
indexRouter.get("/getPrivacyPolicyById/:id", getPrivacyPolicyById);
indexRouter.put("/admin/updatePrivacyPolicy/:id", UserAuth, adminAuth, updatePrivacyPolicy);
indexRouter.delete("/admin/deletePrivacyPolicy/:id", UserAuth, adminAuth, deletePrivacyPolicy);


indexRouter.post("/admin/createAppInfo", UserAuth, adminAuth, createAppInfo);
indexRouter.get("/getAllAppInfo", getAllAppInfo);
indexRouter.get("/getAppInfoById/:id", getAppInfoById);
indexRouter.put("/admin/updateAppInfo/:id", UserAuth, adminAuth, updateAppInfo);
indexRouter.delete("/admin/deleteAppInfo/:id", UserAuth, adminAuth, deleteAppInfo);


indexRouter.post("/admin/createJourneyTopic", UserAuth, adminAuth, JourneyController.createJourneyTopic);
indexRouter.get("/admin/getAllJourneyTopicsAdmin", UserAuth, JourneyController.getAllJourneyTopicsAdmin);
indexRouter.put("/admin/updateJourneyTopic/:id", UserAuth, adminAuth, JourneyController.updateJourneyTopic);
indexRouter.delete("/admin/deleteJourneyTopic/:id", UserAuth, adminAuth, JourneyController.deleteJourneyTopic);


indexRouter.post("/admin/createJourneyLesson", UserAuth, adminAuth, upload.single("image"), JourneyController.createJourneyLesson);
indexRouter.get("/admin/getAllJourneyLessonsAdmin", UserAuth, JourneyController.getAllJourneyLessonsAdmin);
indexRouter.put("/admin/updateJourneyLesson/:id", UserAuth, adminAuth, upload.single("image"), JourneyController.updateJourneyLesson);
indexRouter.delete("/admin/deleteJourneyLesson/:id", UserAuth, adminAuth, JourneyController.deleteJourneyLesson);


indexRouter.post(
  "/admin/createJourneyQuestion",
  UserAuth,
  adminAuth,
  upload.fields([{ name: "image", maxCount: 1 }, { name: "audio", maxCount: 1 }]),
  JourneyController.createJourneyQuestion
);
indexRouter.get("/admin/getAllQuestions", UserAuth, JourneyController.getAllQuestions);
indexRouter.get("/admin/getQuestionById/:id", UserAuth, adminAuth, JourneyController.getQuestionById);
indexRouter.put(
  "/admin/updateJourneyQuestion/:id",
  UserAuth,
  adminAuth,
  upload.fields([{ name: "image", maxCount: 1 }, { name: "audio", maxCount: 1 }]),
  JourneyController.updateJourneyQuestion
);
indexRouter.delete("/admin/deleteJourneyQuestion/:id", UserAuth, adminAuth, JourneyController.deleteJourneyQuestion);
indexRouter.get("/admin/lessonsByTopic/:topicId", UserAuth, JourneyController.getLessonsByTopic);
indexRouter.get("/admin/questionsByLesson/:lessonId", UserAuth, JourneyController.getQuestionsByLesson);


indexRouter.get("/user/getQuestionById/:id", UserAuth, requireSubscription, JourneyController.getQuestionById);
indexRouter.get("/user/getUserJourney", UserAuth, requireSubscription, JourneyController.getUserJourney);
indexRouter.post("/user/verifyUserSpeaking/:questionId", UserAuth, requireSubscription, upload.single("audio"), JourneyController.verifyUserSpeaking);
indexRouter.post("/user/verifyJourneyQuestion/:questionId", UserAuth, requireSubscription, JourneyController.verifyJourneyQuestion);
indexRouter.post("/user/resetLessonCompletion/:lessonId", UserAuth, requireSubscription, JourneyController.resetLessonCompletion);
indexRouter.get("/user/lessonsByTopic/:topicId", UserAuth, requireSubscription, JourneyController.getLessonsByTopic);
indexRouter.get("/user/questionsByLesson/:lessonId", UserAuth, requireSubscription, JourneyController.getQuestionsByLesson);


indexRouter.post("/admin/createTopic", UserAuth, adminAuth, upload.single("image"), TopicController.createTopic);
indexRouter.get("/admin/getAllTopicsAdmin", UserAuth, adminAuth, TopicController.getAllTopicsAdmin);
indexRouter.put("/admin/updateTopic/:id", UserAuth, adminAuth, upload.single("image"), TopicController.updateTopic);
indexRouter.delete("/admin/deleteTopic/:id", UserAuth, adminAuth, TopicController.deleteTopic);


indexRouter.get("/user/getTopics", UserAuth, requireSubscription, TopicController.getTopics);
indexRouter.get("/user/getTopicDetails/:id", UserAuth, requireSubscription, TopicController.getTopicDetails);
indexRouter.post("/user/startTopicLesson/:id", UserAuth, requireSubscription, TopicController.startTopicLesson);
indexRouter.post("/user/sendTopicMessage", UserAuth, requireSubscription, upload.single("audio"), TopicController.sendTopicMessage);
indexRouter.get("/user/getTopicChatHistory/:id", UserAuth, requireSubscription, TopicController.getTopicChatHistory);
indexRouter.post("/user/recordCompletedTask/:id", UserAuth, requireSubscription, TopicController.recordCompletedTask);
indexRouter.post("/user/resetTopicProgress/:id", UserAuth, requireSubscription, TopicController.resetTopicProgress);


indexRouter.get("/list", async (req, res) => {
  try {
    const images = await listBucketObjects();

    return sendSuccessResponse(res, "Get all images successfully", {
      total: images.length,
      images: images.map((e) => `${e.url}`),
    });
  } catch (error) {
    console.log("ERROR WHILE GET ALL IMAGE FROM S3:", error);
    return sendErrorResponse(res, 500, "ERROR WHILE GET ALL IMAGE FROM S3", error);
  }
});

indexRouter.delete("/deleteMany", async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images) || !images.length) return sendBadRequestResponse(res, "URLs array required");

    const keys = images
      .map((url) => {
        if (String(url).includes(".amazonaws.com/")) {
          return String(url).split(".amazonaws.com/")[1];
        } else if (String(url).includes("/uploads/")) {
          return String(url).split("/uploads/")[1];
        } else {
          return String(url).substring(String(url).lastIndexOf("/") + 1);
        }
      })
      .filter(Boolean);

    if (!keys.length) return sendBadRequestResponse(res, "Invalid URLs");

    await deleteManyFromS3(keys);

    return sendSuccessResponse(res, "Deleted multiple files", {
      deleted: keys.length,
      keys,
    });
  } catch (error) {
    return sendErrorResponse(res, 500, "Delete many error", error);
  }
});

export default indexRouter;