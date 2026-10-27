import UserModel from "../model/user.model.js";
import subcriptionPlanModel from "../model/subcriptionPlan.model.js";
import { checkUserSubscriptionAccess } from "../middleware/auth.middleware.js";
import {
  sendBadRequestResponse,
  sendErrorResponse,
  sendSuccessResponse,
  sendNotFoundResponse,
} from "../utils/Response.utils.js";
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const stripe = new Stripe(
  process.env.STRIPE_SECRET || "sk_test_mock_secret_key"
);


const getPlanDurationMs = (plan) => {
  const title = (plan.title || "").toLowerCase();
  if (title.includes("3 month") || title.includes("3monthly") || title.includes("quarter")) {
    return 90 * 24 * 60 * 60 * 1000; 
  }

  return 365 * 24 * 60 * 60 * 1000;
};


export const getMySubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId).populate("subscription.planId");

    if (!user) {
      return sendNotFoundResponse(res, "User not found");
    }

    const accessInfo = await checkUserSubscriptionAccess(user);
    const plans = await subcriptionPlanModel.find().sort({ price: 1 });

    return sendSuccessResponse(res, "Subscription status retrieved successfully", {
      hasAccess: accessInfo.hasAccess,
      accessType: accessInfo.reason,
      daysRemaining: accessInfo.daysRemaining,
      trial: {
        isTrial: accessInfo.isTrial || false,
        startDate: user.trialStartDate || user.createdAt,
        endDate: user.trialEndDate,
        daysRemaining: accessInfo.isTrial ? accessInfo.daysRemaining : 0,
        isReminderSent: user.isTrialReminderSent || false,
      },
      subscription: user.subscription || null,
      familyMembers: user.subscription?.familyMembers || [],
      availablePlans: plans,
    });
  } catch (error) {
    console.error("Get Subscription Status Error:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve subscription status", error);
  }
};


export const createPaymentIntent = async (req, res) => {
  try {
    const userId = req.user._id;
    const planId = req.params.planId || req.params.id || req.body.planId;

    const user = await UserModel.findById(userId);
    if (!user) {
      return sendNotFoundResponse(res, "User not found");
    }

    if (!planId) {
      return sendBadRequestResponse(res, "Plan ID is required in URL params or request body");
    }

    const plan = await subcriptionPlanModel.findById(planId);
    if (!plan) {
      return sendNotFoundResponse(res, "Subscription plan not found with the provided ID");
    }

    const amountInCents = Math.round(Number(plan.price) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      return sendBadRequestResponse(res, "Invalid plan price");
    }


    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      metadata: {
        userId: userId.toString(),
        userEmail: user.email || "",
        planId: plan._id.toString(),
        planTitle: plan.title || "",
      },
      description: `Language Learning Subscription - ${plan.title}`,
    });

    return sendSuccessResponse(res, "PaymentIntent created successfully", {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: plan.price,
      currency: "usd",
      plan: {
        id: plan._id,
        title: plan.title,
        price: plan.price,
        monthlyPrice: plan.monthlyPrice,
        members: plan.members || 1,
      },
    });
  } catch (error) {
    console.error("Create PaymentIntent Error:", error);
    return sendErrorResponse(res, 500, "Failed to create payment intent", error);
  }
};


export const confirmSubscriptionPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const paymentIntentId =
      req.body.paymentIntentId ||
      req.body.paymentIntentID ||
      req.params.paymentIntentId ||
      req.query.paymentIntentId;

    if (!paymentIntentId) {
      return sendBadRequestResponse(res, "paymentIntentId is required in request body");
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return sendNotFoundResponse(res, "User not found");
    }


    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return sendBadRequestResponse(
        res,
        `Payment is not completed yet. Current status: ${paymentIntent.status}`
      );
    }


    const selectedPlanId = paymentIntent.metadata?.planId || req.body.planId;
    let plan = null;
    if (selectedPlanId) {
      plan = await subcriptionPlanModel.findById(selectedPlanId);
    }
    if (!plan) {
      plan = await subcriptionPlanModel.findOne().sort({ price: 1 });
    }

    const durationMs = plan ? getPlanDurationMs(plan) : 365 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const endDate = new Date(now.getTime() + durationMs);

    user.plan = "pro";
    user.subscription = {
      planId: plan ? plan._id : null,
      planTitle: plan ? plan.title : "Pro Plan",
      startDate: now,
      endDate: endDate,
      status: "active",
      maxMembers: plan ? plan.members || 1 : 1,
      isFamilyMember: false,
      familyOwnerId: null,
      familyMembers: user.subscription?.familyMembers || [],
      paymentIntentId: paymentIntent.id,
      paymentMethod: "stripe_card",
    };

    await user.save();

    return sendSuccessResponse(
      res,
      `Payment verified and ${user.subscription.planTitle} activated successfully!`,
      {
        userId: user._id,
        name: user.name,
        plan: user.plan,
        subscription: user.subscription,
      }
    );
  } catch (error) {
    console.error("Confirm Subscription Payment Error:", error);
    return sendErrorResponse(res, 500, "Failed to confirm subscription payment", error);
  }
};


export const testPayPaymentIntent = async (req, res) => {
  try {
    const paymentIntentId =
      req.body.paymentIntentId ||
      req.body.paymentIntentID ||
      req.params.paymentIntentId;

    if (!paymentIntentId) {
      return sendBadRequestResponse(res, "paymentIntentId is required in request body");
    }


    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: "pm_card_visa",
      return_url: "https://localhost:9000",
    });

    return sendSuccessResponse(
      res,
      "Test payment successfully completed on Stripe! Status is now 'succeeded'. You can now call confirmSubscriptionPayment.",
      {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      }
    );
  } catch (error) {
    console.error("Test Pay PaymentIntent Error:", error);
    return sendErrorResponse(res, 500, "Failed to simulate test payment", error);
  }
};


export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return sendNotFoundResponse(res, "User not found");
    }


    if (user.subscription?.familyMembers?.length) {
      for (const member of user.subscription.familyMembers) {
        if (member.userId) {
          await UserModel.findByIdAndUpdate(member.userId, {
            "subscription.status": "expired",
            "subscription.isFamilyMember": false,
            "subscription.familyOwnerId": null,
            plan: "free",
          });
        }
      }
    }

    user.plan = "free";
    if (user.subscription) {
      user.subscription.status = "inactive";
      user.subscription.familyMembers = [];
    }
    await user.save();

    return sendSuccessResponse(res, "Subscription cancelled successfully", {
      userId: user._id,
      name: user.name,
      plan: user.plan,
      subscriptionStatus: "inactive",
    });
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to cancel subscription", error);
  }
};


export const addFamilyMember = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email } = req.body;

    if (!email) {
      return sendBadRequestResponse(res, "Member email is required");
    }

    const cleanEmail = email.toLowerCase().trim();

    if (cleanEmail === req.user.email.toLowerCase().trim()) {
      return sendBadRequestResponse(res, "You cannot add yourself as a family member");
    }

    const owner = await UserModel.findById(ownerId);
    if (!owner) {
      return sendNotFoundResponse(res, "Owner account not found");
    }


    const maxAllowed = owner.subscription?.maxMembers || 1;
    if (maxAllowed <= 1 || owner.subscription?.status !== "active") {
      return sendBadRequestResponse(
        res,
        "Your current plan does not support family members or is not active. Please upgrade to Family Plan (5 members)."
      );
    }


    if (new Date() >= new Date(owner.subscription.endDate)) {
      return sendBadRequestResponse(res, "Your subscription plan has expired. Please renew first.");
    }



    const currentMembers = owner.subscription.familyMembers || [];
    if (currentMembers.length >= maxAllowed) {
      return sendBadRequestResponse(
        res,
        `You have reached the maximum allowed limit of ${maxAllowed} members for this plan.`
      );
    }


    const alreadyInList = currentMembers.some(
      (m) => m.email?.toLowerCase().trim() === cleanEmail
    );
    if (alreadyInList) {
      return sendBadRequestResponse(res, "This member is already added to your family plan");
    }


    const memberUser = await UserModel.findOne({ email: cleanEmail });

    let memberUserId = null;
    let memberName = "";

    if (memberUser) {
      memberUserId = memberUser._id;
      memberName = memberUser.name;


      memberUser.subscription = {
        ...memberUser.subscription?.toObject(),
        isFamilyMember: true,
        familyOwnerId: owner._id,
        planTitle: `${owner.subscription.planTitle} (Family Member)`,
        startDate: owner.subscription.startDate,
        endDate: owner.subscription.endDate,
        status: "active",
      };
      memberUser.plan = "pro";
      await memberUser.save();
    }


    owner.subscription.familyMembers.push({
      userId: memberUserId,
      email: cleanEmail,
      name: memberName || cleanEmail.split("@")[0],
      addedAt: new Date(),
    });

    await owner.save();

    return sendSuccessResponse(res, "Family member added successfully", {
      email: cleanEmail,
      name: memberName || cleanEmail.split("@")[0],
      isRegistered: !!memberUser,
      totalMembers: owner.subscription.familyMembers.length,
      maxAllowedMembers: maxAllowed,
      slotsRemaining: maxAllowed - owner.subscription.familyMembers.length,
      members: owner.subscription.familyMembers,
    });
  } catch (error) {
    console.error("Add Family Member Error:", error);
    return sendErrorResponse(res, 500, "Failed to add family member", error);
  }
};


export const removeFamilyMember = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const { email, memberId } = req.body;

    if (!email && !memberId) {
      return sendBadRequestResponse(res, "Member email or memberId is required");
    }

    const owner = await UserModel.findById(ownerId);
    if (!owner) {
      return sendNotFoundResponse(res, "Owner account not found");
    }

    const initialLength = (owner.subscription?.familyMembers || []).length;
    let removedMemberEmail = null;
    let removedMemberUserId = null;

    const remainingMembers = (owner.subscription?.familyMembers || []).filter((m) => {
      const matchEmail = email && m.email?.toLowerCase().trim() === email.toLowerCase().trim();
      const matchId = memberId && (m._id?.toString() === memberId || m.userId?.toString() === memberId);
      if (matchEmail || matchId) {
        removedMemberEmail = m.email;
        removedMemberUserId = m.userId;
        return false;
      }
      return true;
    });

    if (remainingMembers.length === initialLength) {
      return sendNotFoundResponse(res, "Member not found in your family plan list");
    }

    owner.subscription.familyMembers = remainingMembers;
    await owner.save();


    if (removedMemberUserId || removedMemberEmail) {
      const memberQuery = removedMemberUserId
        ? { _id: removedMemberUserId }
        : { email: removedMemberEmail };

      const memberUser = await UserModel.findOne(memberQuery);
      if (memberUser && memberUser.subscription?.familyOwnerId?.toString() === ownerId.toString()) {
        memberUser.subscription.isFamilyMember = false;
        memberUser.subscription.familyOwnerId = null;
        memberUser.subscription.status = "expired";
        memberUser.plan = "free";
        await memberUser.save();
      }
    }

    return sendSuccessResponse(res, "Family member removed successfully", {
      removedEmail: removedMemberEmail,
      totalMembers: owner.subscription.familyMembers.length,
      maxAllowedMembers: owner.subscription.maxMembers || 1,
      slotsRemaining: (owner.subscription.maxMembers || 1) - owner.subscription.familyMembers.length,
      members: owner.subscription.familyMembers,
    });
  } catch (error) {
    console.error("Remove Family Member Error:", error);
    return sendErrorResponse(res, 500, "Failed to remove family member", error);
  }
};


export const getFamilyMembers = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const owner = await UserModel.findById(ownerId);

    if (!owner) {
      return sendNotFoundResponse(res, "User not found");
    }

    const members = owner.subscription?.familyMembers || [];
    const maxAllowed = owner.subscription?.maxMembers || 1;

    return sendSuccessResponse(res, "Family members retrieved successfully", {
      planTitle: owner.subscription?.planTitle || "Free",
      isOwner: !owner.subscription?.isFamilyMember,
      isFamilyPlan: maxAllowed > 1,
      totalMembers: members.length,
      maxAllowedMembers: maxAllowed,
      slotsRemaining: Math.max(0, maxAllowed - members.length),
      members,
    });
  } catch (error) {
    return sendErrorResponse(res, 500, "Failed to get family members", error);
  }
};
