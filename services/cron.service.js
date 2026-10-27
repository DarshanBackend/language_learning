import cron from "node-cron";
import nodemailer from "nodemailer";
import UserModel from "../model/user.model.js";
import UserSettingsModel from "../model/userSettings.model.js";
import subcriptionPlanModel from "../model/subcriptionPlan.model.js";
import { sendPushNotification } from "../utils/notification.sender.js";
import { createNotification } from "../utils/notification.util.js";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


export const runTrialReminderCheck = async () => {
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);


    const usersDueReminder = await UserModel.find({
      role: { $ne: "admin" },
      isTrialReminderSent: { $ne: true },
      "subscription.status": { $ne: "active" },
      trialEndDate: {
        $gt: now,
        $lte: oneDayFromNow,
      },
    });

    console.log(`[Cron] Found ${usersDueReminder.length} user(s) due for Day-6 Trial Expiry Reminder`);


    const availablePlans = await subcriptionPlanModel.find().sort({ price: 1 });
    const plansSummaryHtml = availablePlans
      .map(
        (p) => `
        <div style="background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <h4 style="margin: 0 0 6px 0; color: #8B1E4F;">${p.title}</h4>
          <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>$${p.price}</strong> (${p.description})</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #718096;">Members supported: ${p.members || 1}</p>
        </div>`
      )
      .join("");

    for (const user of usersDueReminder) {
      const remainingHours = Math.max(
        1,
        Math.round((new Date(user.trialEndDate).getTime() - now.getTime()) / (1000 * 60 * 60))
      );

      const reminderTitle = "⏳ Your 7-Day Free Trial Ends Tomorrow!";
      const reminderBody = `Hi ${user.name}, your free trial is ending in ${remainingHours} hours. Choose a subscription plan today to keep learning without interruption!`;


      if (user.fcmToken) {
        try {
          await sendPushNotification(user.fcmToken, reminderTitle, reminderBody, {
            type: "TRIAL_REMINDER",
            trialEndDate: user.trialEndDate.toISOString(),
          });
        } catch (fcmErr) {
          console.error(`[Cron] FCM error for ${user.email}:`, fcmErr.message);
        }
      }


      try {
        await createNotification({
          userId: user._id,
          title: reminderTitle,
          message: reminderBody,
          type: "SUBSCRIPTION_REMINDER",
          reference: { trialEndDate: user.trialEndDate },
        });
      } catch (notifErr) {
        console.error(`[Cron] In-app notification error for ${user.email}:`, notifErr.message);
      }


      if (user.email && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER || "noreply@floma.ai",
            to: user.email,
            subject: "Your Free Trial Ends Tomorrow! Upgrade to Continue Learning",
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background: #fdf2f4; color: #333;">
                <div style="max-width: 540px; margin: auto; background: #ffffff; border-radius: 12px; padding: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #8B1E4F; margin: 0;">Language Learning AI Tutor</h2>
                    <p style="color: #718096; font-size: 14px; margin-top: 5px;">Your 7-Day Free Trial is Expiring Soon</p>
                  </div>
                  <p style="font-size: 15px; line-height: 1.5;">Hello <strong>${user.name}</strong>,</p>
                  <p style="font-size: 15px; line-height: 1.5;">
                    This is a reminder that tomorrow is the 7th and final day of your free trial.
                    After tomorrow, an active subscription plan is required to continue using AI voice tutoring, personalized journey lessons, and interactive practice.
                  </p>
                  <div style="margin: 20px 0;">
                    <h3 style="color: #2d3748; font-size: 16px; margin-bottom: 12px;">Choose a Plan That Fits You:</h3>
                    ${plansSummaryHtml}
                  </div>
                  <div style="text-align: center; margin: 25px 0 15px 0;">
                    <p style="font-size: 13px; color: #718096;">Open the mobile app and navigate to Subscription to pick a plan.</p>
                  </div>
                  <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
                  <p style="font-size: 12px; color: #a0aec0; text-align: center;">
                    Thank you for learning with us! – The Language Learning Team
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`[Cron] Day 6 reminder email sent to ${user.email}`);
        } catch (emailErr) {
          console.error(`[Cron] Email error for ${user.email}:`, emailErr.message);
        }
      }


      user.isTrialReminderSent = true;
      await user.save();
    }


    const expiredTrialUsers = await UserModel.find({
      role: { $ne: "admin" },
      trialEndDate: { $lte: now },
      "subscription.status": "trial",
    });

    for (const expUser of expiredTrialUsers) {
      expUser.subscription.status = "expired";
      expUser.plan = "free";
      await expUser.save();
    }


    const expiredPaidUsers = await UserModel.find({
      role: { $ne: "admin" },
      "subscription.status": "active",
      "subscription.endDate": { $lte: now },
    });

    for (const expUser of expiredPaidUsers) {
      expUser.subscription.status = "expired";
      expUser.plan = "free";
      await expUser.save();
    }

    return {
      success: true,
      remindersSent: usersDueReminder.length,
      trialsExpired: expiredTrialUsers.length,
      paidSubscriptionsExpired: expiredPaidUsers.length,
    };
  } catch (error) {
    console.error("[Cron] Error in trial reminder job:", error);
    return { success: false, error: error.message };
  }
};

const getTodayDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


export const sendSingleDailyStudyReminder = async (user) => {
  try {
    const todayStr = getTodayDateString();
    const title = "📚 Time for Your Daily Practice!";
    const body = `Hi ${user.name || "Learner"}, take 5 minutes today to practice your lessons and keep improving!`;

    let pushSent = false;

    if (user.fcmToken) {
      try {
        pushSent = await sendPushNotification(user.fcmToken, title, body, {
          type: "DAILY_STUDY_REMINDER",
          date: todayStr,
        });
      } catch (fcmErr) {
        console.error(`[Cron] FCM daily reminder error for ${user.email}:`, fcmErr.message);
      }
    }


    let notif = null;
    try {
      notif = await createNotification({
        userId: user._id,
        title,
        message: body,
        type: "STUDY_REMINDER",
        reference: { date: todayStr },
      });
    } catch (notifErr) {
      console.error(`[Cron] In-app daily reminder error for ${user.email}:`, notifErr.message);
    }

    user.lastDailyReminderSentDate = todayStr;
    await user.save();

    return { success: true, pushSent, notification: notif };
  } catch (error) {
    console.error(`[Cron] Error sending daily reminder to user ${user._id}:`, error);
    return { success: false, error: error.message };
  }
};


export const sendSingleStreakReminder = async (user, overrideStreak = null) => {
  try {
    const todayStr = getTodayDateString();
    const streak = overrideStreak !== null ? overrideStreak : user.streakDays || 1;
    const title = `🔥 Don't lose your ${streak}-day streak!`;
    const body = `Hi ${user.name || "Learner"}, you haven't practiced today yet. Complete a lesson before midnight to keep your streak alive!`;

    let pushSent = false;

    if (user.fcmToken) {
      try {
        pushSent = await sendPushNotification(user.fcmToken, title, body, {
          type: "STREAK_REMINDER",
          streakDays: streak,
          date: todayStr,
        });
      } catch (fcmErr) {
        console.error(`[Cron] FCM streak reminder error for ${user.email}:`, fcmErr.message);
      }
    }


    let notif = null;
    try {
      notif = await createNotification({
        userId: user._id,
        title,
        message: body,
        type: "STREAK_REMINDER",
        reference: { streakDays: streak, date: todayStr },
      });
    } catch (notifErr) {
      console.error(`[Cron] In-app streak reminder error for ${user.email}:`, notifErr.message);
    }

    user.lastStreakReminderSentDate = todayStr;
    await user.save();

    return { success: true, pushSent, streak, notification: notif };
  } catch (error) {
    console.error(`[Cron] Error sending streak reminder to user ${user._id}:`, error);
    return { success: false, error: error.message };
  }
};


export const runDailyStudyReminderCheck = async () => {
  try {
    const todayStr = getTodayDateString();
    const users = await UserModel.find({
      role: { $ne: "admin" },
      isUserDeleted: { $ne: true },
      lastDailyReminderSentDate: { $ne: todayStr },
    });

    let sentCount = 0;

    for (const user of users) {

      const alreadyPracticedToday =
        Array.isArray(user.practiceHistory) && user.practiceHistory.includes(todayStr);

      if (alreadyPracticedToday) continue;


      const settings = await UserSettingsModel.findOne({ userId: user._id });
      if (settings && settings.notifications) {
        if (
          settings.notifications.status === false ||
          settings.notifications.dailyPracticeReminder === false
        ) {
          continue;
        }
      }

      await sendSingleDailyStudyReminder(user);
      sentCount++;
    }

    console.log(`[Cron] Daily study reminders sent to ${sentCount} user(s) for ${todayStr}`);
    return { success: true, sentCount, date: todayStr };
  } catch (error) {
    console.error("[Cron] Error running daily study reminder check:", error);
    return { success: false, error: error.message };
  }
};


export const runStreakReminderCheck = async () => {
  try {
    const todayStr = getTodayDateString();
    const users = await UserModel.find({
      role: { $ne: "admin" },
      isUserDeleted: { $ne: true },
      streakDays: { $gt: 0 },
      lastStreakReminderSentDate: { $ne: todayStr },
    });

    let sentCount = 0;

    for (const user of users) {

      const alreadyPracticedToday =
        Array.isArray(user.practiceHistory) && user.practiceHistory.includes(todayStr);

      if (alreadyPracticedToday) continue;


      const settings = await UserSettingsModel.findOne({ userId: user._id });
      if (settings && settings.notifications) {
        if (
          settings.notifications.status === false ||
          settings.notifications.streakReminder === false
        ) {
          continue;
        }
      }

      await sendSingleStreakReminder(user);
      sentCount++;
    }

    console.log(`[Cron] Streak reminders sent to ${sentCount} user(s) for ${todayStr}`);
    return { success: true, sentCount, date: todayStr };
  } catch (error) {
    console.error("[Cron] Error running streak reminder check:", error);
    return { success: false, error: error.message };
  }
};


export const initializeCronJobs = () => {

  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Running hourly trial & subscription status check...");
    await runTrialReminderCheck();
  });


  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Running scheduled Daily Study Reminder check (09:00 AM)...");
    await runDailyStudyReminderCheck();
  });


  cron.schedule("0 19 * * *", async () => {
    console.log("[Cron] Running scheduled Streak Reminder check (07:00 PM)...");
    await runStreakReminderCheck();
  });

  console.log("Cron jobs initialized successfully (Trial, Daily Study & Streak Reminders).");
};
