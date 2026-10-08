import UserModel from "../model/user.model.js";
import UserSettingsModel from "../model/userSettings.model.js";
import AnalyticsModel from "../model/analytics.model.js";
import { syncUserStreak } from "./user.controller.js";
import { checkUserSubscriptionAccess } from "../middleware/auth.middleware.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export class AuthController {
  static saltRounds = 10;
  static JWT_SECRET = process.env.JWT_SECRET || "floma_access_token_secret";
  static otpMap = new Map(); 


  static async register(req, res) {
    try {
      const { name, email, password, role = "user", onboarding } = req.body;


      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and password are required!",
        });
      }

      let onboardingData = null;

      if (role !== "admin") {

        if (!onboarding) {
          return res.status(400).json({
            success: false,
            message: "Onboarding step details are required for registration!",
          });
        }

        const {
          languageToLearn,
          learningLevel,
          nativeLanguage,
          learningGoals,
          dailyTimeCommitment,
          bestTimeToStudy,
          interests,
        } = onboarding;

        if (!languageToLearn || !learningLevel || !nativeLanguage || !dailyTimeCommitment || !bestTimeToStudy) {
          return res.status(400).json({
            success: false,
            message: "Onboarding details (languageToLearn, learningLevel, nativeLanguage, dailyTimeCommitment, bestTimeToStudy) are required!",
          });
        }


        const formattedGoals = Array.isArray(learningGoals)
          ? learningGoals
          : learningGoals
            ? [learningGoals]
            : [];

        const formattedInterests = Array.isArray(interests)
          ? interests
          : interests
            ? [interests]
            : [];

        onboardingData = {
          languageToLearn,
          learningLevel,
          nativeLanguage,
          learningGoals: formattedGoals,
          dailyTimeCommitment,
          bestTimeToStudy,
          interests: formattedInterests,
        };
      }


      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered. Please login.",
        });
      }


      const hashedPassword = await bcrypt.hash(password, AuthController.saltRounds);


      const formattedName = encodeURIComponent(name.trim());
      const avatarUrl = `https://ui-avatars.com/api/?name=${formattedName}&background=8B1E4F&color=fff&size=128`;

      const now = new Date();
      const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); 


      const cleanEmail = email.toLowerCase().trim();
      const familyOwner = await UserModel.findOne({
        "subscription.familyMembers.email": cleanEmail,
        "subscription.status": "active",
      });

      let initialSubscription = {
        status: "trial",
        startDate: now,
        endDate: trialEndDate,
        maxMembers: 1,
        isFamilyMember: false,
        familyOwnerId: null,
        familyMembers: [],
      };
      let initialPlan = "free";

      if (familyOwner) {
        initialSubscription = {
          status: "active",
          planTitle: `${familyOwner.subscription.planTitle} (Family Member)`,
          startDate: familyOwner.subscription.startDate,
          endDate: familyOwner.subscription.endDate,
          maxMembers: 1,
          isFamilyMember: true,
          familyOwnerId: familyOwner._id,
          familyMembers: [],
        };
        initialPlan = "pro";
      }


      const user = await UserModel.create({
        name,
        email: cleanEmail,
        password: hashedPassword,
        avatarUrl,
        role,
        plan: initialPlan,
        trialStartDate: now,
        trialEndDate: trialEndDate,
        isTrialReminderSent: false,
        subscription: initialSubscription,
        onboarding: onboardingData,
      });


      if (familyOwner) {
        await UserModel.updateOne(
          { _id: familyOwner._id, "subscription.familyMembers.email": cleanEmail },
          {
            $set: {
              "subscription.familyMembers.$.userId": user._id,
              "subscription.familyMembers.$.name": user.name,
            },
          }
        );
      }


      await UserSettingsModel.create({ userId: user._id });
      await AnalyticsModel.create({ userId: user._id });


      const token = jwt.sign(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tokenVersion: user.tokenVersion || 0,
        },
        AuthController.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const accessInfo = await checkUserSubscriptionAccess(user);

      return res.status(201).json({
        success: true,
        message: `${user.role.toUpperCase()} registered successfully`,
        result: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
            plan: user.plan,
            onboarding: user.onboarding,
            trialStartDate: user.trialStartDate,
            trialEndDate: user.trialEndDate,
            subscription: user.subscription,
            subscriptionStatus: accessInfo,
          },
          token,
        },
      });
    } catch (error) {
      console.error("Registration Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to register user",
        error: error.message,
      });
    }
  }


  static async login(req, res) {
    try {
      const { email, username, emailOrUsername, password } = req.body;
      const identifier = emailOrUsername || email || username;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: "Email/Username and password are required!",
        });
      }


      const user = await UserModel.findOne({
        $or: [
          { email: identifier.toLowerCase().trim() },
          { name: new RegExp(`^${identifier.trim()}$`, "i") },
        ],
      }).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found. Please register first.",
        });
      }

      if (user.isUserDeleted) {
        return res.status(403).json({
          success: false,
          message: "This account has been deleted.",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid password!",
        });
      }


      const token = jwt.sign(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          tokenVersion: user.tokenVersion || 0,
        },
        AuthController.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const streakDays = await syncUserStreak(user);
      const accessInfo = await checkUserSubscriptionAccess(user);

      return res.status(200).json({
        success: true,
        message: `${user.role.toUpperCase()} login successful`,
        result: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
            plan: user.plan,
            onboarding: user.onboarding,
            streakDays: streakDays,
            lastPracticedDate: user.lastPracticedDate,
            trialStartDate: user.trialStartDate,
            trialEndDate: user.trialEndDate,
            subscription: user.subscription,
            subscriptionStatus: accessInfo,
          },
          token,
        },
      });
    } catch (error) {
      console.error("Login Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to log in",
        error: error.message,
      });
    }
  }


  static async sendForgotMailOtp(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required!",
        });
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No user found with this email.",
        });
      }


      const OTP = Math.floor(1000 + Math.random() * 9000).toString();


      AuthController.otpMap.set(email, {
        OTP,
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: false,
      });

      const emailSender = process.env.EMAIL_USER || "noreply@floma.ai";

      await transporter.sendMail({
        from: emailSender,
        to: email,
        subject: "OTP for Password Reset - Floma Voice Tutor",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9;">
              <div style="max-width: 500px; margin: auto; background: #ffffff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
                  <h2 style="color: #8B1E4F; text-align: center;">Floma Password Reset</h2>
                  <p style="font-size: 15px; color: #333;">Hello ${user.name},</p>
                  <p style="font-size: 15px; color: #333;">
                      We received a request to reset your Floma account password.<br>
                      Please use the OTP below to verify your request:
                  </p>
                  <p style="font-size: 26px; font-weight: bold; text-align: center; color: #8B1E4F; margin: 20px 0; letter-spacing: 4px;">
                      ${OTP}
                  </p>
                  <p style="font-size: 14px; color: #777;">
                      This OTP is valid for 10 minutes. If you didn't request a password reset, you can safely ignore this email.
                  </p>
                  <p style="font-size: 14px; color: #555; text-align: center; margin-top: 20px;">
                      – The Floma Team
                  </p>
              </div>
          </div>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "Password reset OTP sent to email.",
        result: { email, otp: OTP }, 
      });
    } catch (error) {
      console.error("Forgot Password OTP Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email OTP.",
        error: error.message,
      });
    }
  }


  static async verifyForgetOtp(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: "Email and OTP are required!",
        });
      }

      const otpEntry = AuthController.otpMap.get(email);
      if (!otpEntry) {
        return res.status(400).json({
          success: false,
          message: "No OTP request found for this email. Request a new one.",
        });
      }

      if (otpEntry.expiresAt < Date.now()) {
        AuthController.otpMap.delete(email);
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
      }

      if (otpEntry.OTP !== otp.toString()) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP code.",
        });
      }


      AuthController.otpMap.set(email, { ...otpEntry, verified: true });

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully. You can now reset your password.",
      });
    } catch (error) {
      console.error("Verify OTP Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to verify OTP",
        error: error.message,
      });
    }
  }


  static async resetPassword(req, res) {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Email and new password are required!",
        });
      }

      const otpEntry = AuthController.otpMap.get(email);
      if (!otpEntry || !otpEntry.verified) {
        return res.status(403).json({
          success: false,
          message: "Access Denied. Please verify the OTP first.",
        });
      }

      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }


      user.password = await bcrypt.hash(newPassword, AuthController.saltRounds);
      await user.save();


      AuthController.otpMap.delete(email);

      return res.status(200).json({
        success: true,
        message: "Password reset successful. Please login with your new password.",
      });
    } catch (error) {
      console.error("Reset Password Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to reset password",
        error: error.message,
      });
    }
  }


  static async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user._id;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Old password and new password are required!",
        });
      }


      const user = await UserModel.findById(userId).select("+password");
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }


      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid old password!",
        });
      }


      user.password = await bcrypt.hash(newPassword, AuthController.saltRounds);
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Password changed successfully.",
      });
    } catch (error) {
      console.error("Change Password Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: error.message,
      });
    }
  }


  static async getUser(req, res) {
    try {
      const id = req.user._id;
      const user = await UserModel.findById(id).select("-password");

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      await syncUserStreak(user);
      const accessInfo = await checkUserSubscriptionAccess(user);

      return res.status(200).json({
        success: true,
        message: "User profile fetched successfully",
        result: {
          ...user.toObject(),
          subscriptionStatus: accessInfo,
        },
      });
    } catch (error) {
      console.error("Get User Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error fetching user data",
        error: error.message,
      });
    }
  }


  static async logout(req, res) {
    try {
      const userId = req.user?._id;

      if (userId) {

        await UserModel.findByIdAndUpdate(userId, {
          $inc: { tokenVersion: 1 },
          fcmToken: null,
          lastLogoutAt: new Date(),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error logging out",
        error: error.message,
      });
    }
  }


  static async updateFcmToken(req, res) {
    try {
      const userId = req.user._id;
      const { fcmToken } = req.body;

      if (!fcmToken) {
        return res.status(400).json({
          success: false,
          message: "fcmToken is required!",
        });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found!",
        });
      }

      user.fcmToken = fcmToken;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "FCM Token updated successfully",
      });
    } catch (error) {
      console.error("Update FCM Token Error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Error updating FCM Token",
        error: error.message,
      });
    }
  }
}