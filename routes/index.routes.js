import express from "express";
import { AuthController } from "../controller/auth.controller.js";
import {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getAnalytics,
  recordCompletedLesson,
  deleteAccount,
} from "../controller/user.controller.js";
import { handleVoiceMessage, getChatHistory } from "../controller/chatController.js";
import {
  createCheckoutSession,
  stripeSuccessCallback,
  upgradeToProManual,
  cancelSubscription,
} from "../controller/subscriptionController.js";
import { UserAuth, adminAuth } from "../middleware/auth.middleware.js";
import { upload, listBucketObjects, deleteManyFromS3 } from "../middleware/imageupload.js";
import { OnboardingOptionController } from "../controller/onboardingOption.controller.js";
import { sendResponse, sendSuccessResponse, sendErrorResponse, sendBadRequestResponse } from "../utils/Response.utils.js";
import {
  createHelpCenter,
  updateHelpCenter,
  deleteHelpCenter,
  getHelpCenterById,
  getAllHelpCenter
} from "../controller/helpCenter.controller.js";
import {
  createTermsConditions,
  getTermsConditionsById,
  getAllTermsConditions,
  updateTermsConditions,
  deleteTermsConditions,
  getTermsConditions,
  updateTermsConditionsHeader
} from "../controller/termsConditions.controller.js";
import {
  createPrivacyPolicy,
  getPrivacyPolicyById,
  getAllPrivacyPolicy,
  updatePrivacyPolicy,
  deletePrivacyPolicy
} from "../controller/privacyPolicy.controller.js";
import {
  createAppInfo,
  getAllAppInfo,
  getAppInfoById,
  updateAppInfo,
  deleteAppInfo
} from "../controller/appInfo.controller.js";
import {
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan
} from "../controller/subcriptionPlan.controller.js";
import { JourneyController } from "../controller/journey.controller.js";
import { TopicController } from "../controller/topic.controller.js";
import { TopicChatController } from "../controller/topicChat.controller.js";

const indexRouter = express.Router();

// ==========================================
// 1. Authentication Routes (/auth)
// ==========================================
indexRouter.post("/auth/register", AuthController.register);
indexRouter.post("/auth/login", AuthController.login);

// Email OTP Reset Password Flow
indexRouter.post("/auth/forgot-password", AuthController.sendForgotMailOtp);
indexRouter.post("/auth/verify-otp", AuthController.verifyForgetOtp);
indexRouter.post("/auth/reset-password", AuthController.resetPassword);

// Authenticated Password Change
indexRouter.post("/auth/change-password", UserAuth, AuthController.changePassword);

indexRouter.get("/auth/me", UserAuth, AuthController.getUser);
indexRouter.post("/auth/logout", UserAuth, AuthController.logout);
indexRouter.patch("/auth/update-fcm-token", UserAuth, AuthController.updateFcmToken);

// ==========================================
// 2. User Profile & Settings Routes (/user)
// ==========================================
indexRouter.patch("/user/updateProfile", UserAuth, upload.single("avatar"), updateProfile);
indexRouter.get("/user/getProfile", UserAuth, getProfile);

indexRouter.patch("/user/updateSettings", UserAuth, updateSettings);
indexRouter.get("/user/getSettings", UserAuth, getSettings);

indexRouter.patch("/user/updateAnalytics", UserAuth, recordCompletedLesson);
indexRouter.get("/user/getAnalytics", UserAuth, getAnalytics);

indexRouter.delete("/user/deleteAccount", UserAuth, deleteAccount);

// ==========================================
// 3. Voice Chat Routes (/chat)
// ==========================================
indexRouter.post("/chat/message", UserAuth, upload.single("audio"), handleVoiceMessage);
indexRouter.get("/chat/history", UserAuth, getChatHistory);

// ==========================================
// 4. Subscription Routes (/subscription)
// ==========================================
indexRouter.post("/subscription/create-checkout-session", UserAuth, createCheckoutSession);
indexRouter.get("/subscription/success", stripeSuccessCallback);
indexRouter.post("/subscription/upgrade-manual", UserAuth, upgradeToProManual);
indexRouter.post("/subscription/cancel", UserAuth, cancelSubscription);

// ==========================================
// 5. Onboarding Options Config CRUD Routes
// ==========================================
indexRouter.get("/onboarding/options", OnboardingOptionController.getAllOptions);

// Languages
indexRouter.post("/admin/onboarding/createLanguage", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.createLanguage);
indexRouter.get("/onboarding/getLanguages", OnboardingOptionController.getLanguages);
indexRouter.put("/admin/onboarding/updateLanguage/:id", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.updateLanguage);
indexRouter.delete("/admin/onboarding/deleteLanguage/:id", UserAuth, adminAuth, OnboardingOptionController.deleteLanguage);

// Levels
indexRouter.post("/admin/onboarding/createLevel", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.createLevel);
indexRouter.get("/onboarding/getLevels", OnboardingOptionController.getLevels);
indexRouter.put("/admin/onboarding/updateLevel/:id", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.updateLevel);
indexRouter.delete("/admin/onboarding/deleteLevel/:id", UserAuth, adminAuth, OnboardingOptionController.deleteLevel);

// Native Languages
indexRouter.post("/admin/onboarding/createNativeLanguage", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.createNativeLanguage);
indexRouter.get("/onboarding/getNativeLanguages", OnboardingOptionController.getNativeLanguages);
indexRouter.put("/admin/onboarding/updateNativeLanguage/:id", UserAuth, adminAuth, upload.single("image"), OnboardingOptionController.updateNativeLanguage);
indexRouter.delete("/admin/onboarding/deleteNativeLanguage/:id", UserAuth, adminAuth, OnboardingOptionController.deleteNativeLanguage);

// Goals
indexRouter.post("/admin/onboarding/createGoal", UserAuth, adminAuth, OnboardingOptionController.createGoal);
indexRouter.get("/onboarding/getGoals", OnboardingOptionController.getGoals);
indexRouter.put("/admin/onboarding/updateGoal/:id", UserAuth, adminAuth, OnboardingOptionController.updateGoal);
indexRouter.delete("/admin/onboarding/deleteGoal/:id", UserAuth, adminAuth, OnboardingOptionController.deleteGoal);

// Commitments
indexRouter.post("/admin/onboarding/createCommitment", UserAuth, adminAuth, OnboardingOptionController.createCommitment);
indexRouter.get("/onboarding/getCommitments", OnboardingOptionController.getCommitments);
indexRouter.put("/admin/onboarding/updateCommitment/:id", UserAuth, adminAuth, OnboardingOptionController.updateCommitment);
indexRouter.delete("/admin/onboarding/deleteCommitment/:id", UserAuth, adminAuth, OnboardingOptionController.deleteCommitment);

// Interests
indexRouter.post("/admin/onboarding/createInterest", UserAuth, adminAuth, OnboardingOptionController.createInterest);
indexRouter.get("/onboarding/getInterests", OnboardingOptionController.getInterests);
indexRouter.put("/admin/onboarding/updateInterest/:id", UserAuth, adminAuth, OnboardingOptionController.updateInterest);
indexRouter.delete("/admin/onboarding/deleteInterest/:id", UserAuth, adminAuth, OnboardingOptionController.deleteInterest);

// ==========================================
// 6. Help Center Routes (/help-center)
// ==========================================
indexRouter.post("/admin/createHelpCenter", UserAuth, adminAuth, createHelpCenter);
indexRouter.get("/getAllHelpCenter", getAllHelpCenter);
indexRouter.get("/getHelpCenterById/:id", getHelpCenterById);
indexRouter.put("/admin/updateHelpCenter/:id", UserAuth, adminAuth, updateHelpCenter);
indexRouter.delete("/admin/deleteHelpCenter/:id", UserAuth, adminAuth, deleteHelpCenter);

// ==========================================
// 7. Terms & Conditions Routes (/terms)
// ==========================================
indexRouter.post("/admin/createTermsConditions", UserAuth, adminAuth, createTermsConditions);
indexRouter.get("/getAllTermsConditions", getAllTermsConditions);
indexRouter.get("/getTermsConditionsById/:id", getTermsConditionsById);
indexRouter.put("/admin/updateTermsConditions/:id", UserAuth, adminAuth, updateTermsConditions);
indexRouter.delete("/admin/deleteTermsConditions/:id", UserAuth, adminAuth, deleteTermsConditions);
indexRouter.get("/getTermsConditions", getTermsConditions);
indexRouter.put("/admin/updateTermsConditionsHeader", UserAuth, adminAuth, updateTermsConditionsHeader);

// ==========================================
// 8. Privacy Policy Routes (/privacy)
// ==========================================
indexRouter.post("/admin/createPrivacyPolicy", UserAuth, adminAuth, createPrivacyPolicy);
indexRouter.get("/getAllPrivacyPolicy", getAllPrivacyPolicy);
indexRouter.get("/getPrivacyPolicyById/:id", getPrivacyPolicyById);
indexRouter.put("/admin/updatePrivacyPolicy/:id", UserAuth, adminAuth, updatePrivacyPolicy);
indexRouter.delete("/admin/deletePrivacyPolicy/:id", UserAuth, adminAuth, deletePrivacyPolicy);

// ==========================================
// 9. App Info Routes (/app-info)
// ==========================================
indexRouter.post("/admin/createAppInfo", UserAuth, adminAuth, createAppInfo);
indexRouter.get("/getAllAppInfo", getAllAppInfo);
indexRouter.get("/getAppInfoById/:id", getAppInfoById);
indexRouter.put("/admin/updateAppInfo/:id", UserAuth, adminAuth, updateAppInfo);
indexRouter.delete("/admin/deleteAppInfo/:id", UserAuth, adminAuth, deleteAppInfo);

// ==========================================
// 10. Subscription Plan Routes (/subscription-plan)
// ==========================================
indexRouter.post("/admin/createSubscriptionPlan", UserAuth, adminAuth, createSubscriptionPlan);
indexRouter.get("/getAllSubscriptionPlans", getAllSubscriptionPlans);
indexRouter.get("/getSubscriptionPlanById/:id", getSubscriptionPlanById);
indexRouter.put("/admin/updateSubscriptionPlan/:id", UserAuth, adminAuth, updateSubscriptionPlan);
indexRouter.delete("/admin/deleteSubscriptionPlan/:id", UserAuth, adminAuth, deleteSubscriptionPlan);

// ==========================================
// ==========================================
// 11. Journey, Lesson & Question Routes (Admin & User)
// ==========================================
// Admin JourneyTopic CRUD
indexRouter.post("/admin/createJourneyTopic", UserAuth, adminAuth, JourneyController.createJourneyTopic);
indexRouter.get("/admin/getAllJourneyTopicsAdmin", UserAuth, JourneyController.getAllJourneyTopicsAdmin);
indexRouter.put("/admin/updateJourneyTopic/:id", UserAuth, adminAuth, JourneyController.updateJourneyTopic);
indexRouter.delete("/admin/deleteJourneyTopic/:id", UserAuth, adminAuth, JourneyController.deleteJourneyTopic);

// Admin JourneyLesson CRUD
indexRouter.post("/admin/createJourneyLesson", UserAuth, adminAuth, JourneyController.createJourneyLesson);
indexRouter.get("/admin/getAllJourneyLessonsAdmin", UserAuth, JourneyController.getAllJourneyLessonsAdmin);
indexRouter.put("/admin/updateJourneyLesson/:id", UserAuth, adminAuth, JourneyController.updateJourneyLesson);
indexRouter.delete("/admin/deleteJourneyLesson/:id", UserAuth, adminAuth, JourneyController.deleteJourneyLesson);

// Admin JourneyQuestion CRUD (supports S3 image & audio uploads)
indexRouter.post("/admin/createJourneyQuestion", UserAuth, adminAuth, upload.fields([{ name: "image", maxCount: 1 }, { name: "audio", maxCount: 1 }]), JourneyController.createJourneyQuestion);
indexRouter.get("/admin/getAllQuestions", UserAuth, JourneyController.getAllQuestions);
indexRouter.get("/admin/getQuestionById/:id", UserAuth, adminAuth, JourneyController.getQuestionById);
indexRouter.put("/admin/updateJourneyQuestion/:id", UserAuth, adminAuth, upload.fields([{ name: "image", maxCount: 1 }, { name: "audio", maxCount: 1 }]), JourneyController.updateJourneyQuestion);
indexRouter.delete("/admin/deleteJourneyQuestion/:id", UserAuth, adminAuth, JourneyController.deleteJourneyQuestion);
indexRouter.get("/admin/lessonsByTopic/:topicId", UserAuth, JourneyController.getLessonsByTopic);
indexRouter.get("/admin/questionsByLesson/:lessonId", UserAuth, JourneyController.getQuestionsByLesson);
indexRouter.get("/user/getQuestionById/:id", UserAuth, JourneyController.getQuestionById);


// User Journey & Verification Routes
indexRouter.get("/user/getUserJourney", UserAuth, JourneyController.getUserJourney);
indexRouter.post("/user/verifyUserSpeaking/:questionId", UserAuth, upload.single("audio"), JourneyController.verifyUserSpeaking);
indexRouter.post("/user/verifyJourneyQuestion/:questionId", UserAuth, JourneyController.verifyJourneyQuestion);
indexRouter.get("/user/lessonsByTopic/:topicId", UserAuth, JourneyController.getLessonsByTopic);
indexRouter.get("/user/questionsByLesson/:lessonId", UserAuth, JourneyController.getQuestionsByLesson);


// Admin Topic CRUD
indexRouter.post("/admin/createTopic", UserAuth, adminAuth, TopicController.createTopic);
indexRouter.get("/admin/getAllTopicsAdmin", UserAuth, adminAuth, TopicController.getAllTopicsAdmin);
indexRouter.put("/admin/updateTopic/:id", UserAuth, adminAuth, TopicController.updateTopic);
indexRouter.delete("/admin/deleteTopic/:id", UserAuth, adminAuth, TopicController.deleteTopic);

// User Topic Routes
indexRouter.get("/user/getTopics", UserAuth, TopicController.getTopics);
indexRouter.get("/user/getTopicDetails/:id", UserAuth, TopicController.getTopicDetails);
indexRouter.post("/user/recordCompletedTask", UserAuth, TopicController.recordCompletedTask);

indexRouter.post("/user/topic/:topicId/chat/start", UserAuth, TopicChatController.startTopicChat);
indexRouter.post(
  "/user/topic/:topicId/chat/message",
  UserAuth,
  upload.single("audio"),
  TopicChatController.sendMessage
);
indexRouter.get("/user/topic/:topicId/chat/history", UserAuth, TopicChatController.getChatHistory);

indexRouter.get("/list", async (req, res) => {
  try {
    const images = await listBucketObjects();

    return sendSuccessResponse(res, "Get all images successfully", {
      total: images.length,
      images: images.map((e, index) => { return `${e.url}` })
    })
  } catch (error) {
    console.log("ERROR WHILE GET ALL IMAGE FROM S3:", error);
    return sendErrorResponse(res, 500, "ERROR WHILE GET ALL IMAGE FROM S3", error);
  }
});

indexRouter.delete("/deleteMany", async (req, res) => {
  try {
    const { images } = req.body;
    if (!Array.isArray(images) || !images.length) return sendBadRequestResponse(res, "URLs array required");

    const keys = images.map(url => {
      if (String(url).includes(".amazonaws.com/")) {
        return String(url).split(".amazonaws.com/")[1];
      } else if (String(url).includes("/uploads/")) {
        return String(url).split("/uploads/")[1];
      } else {
        return String(url).substring(String(url).lastIndexOf("/") + 1);
      }
    }).filter(Boolean);

    if (!keys.length) return sendBadRequestResponse(res, "Invalid URLs");

    await deleteManyFromS3(keys);

    return sendSuccessResponse(res, "Deleted multiple files", {
      deleted: keys.length,
      keys
    });
  } catch (error) {
    return sendErrorResponse(res, 500, "Delete many error", error);
  }
});

export default indexRouter;