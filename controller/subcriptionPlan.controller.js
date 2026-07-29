import mongoose from "mongoose";
import subcriptionPlanModel from "../model/subcriptionPlan.model.js";
import {
  sendBadRequestResponse,
  sendErrorResponse,
  sendSuccessResponse,
  sendCreatedResponse,
  sendNotFoundResponse
} from "../utils/Response.utils.js";

export const createSubscriptionPlan = async (req, res) => {
  try {
    const { title, description, price, monthlyPrice, members } = req.body;

    if (!title || !description || price === undefined || monthlyPrice === undefined) {
      return sendBadRequestResponse(
        res,
        "Title, description, price, and monthlyPrice are required."
      );
    }

    const newPlan = await subcriptionPlanModel.create({
      title,
      description,
      price,
      monthlyPrice,
      members: members !== undefined ? members : 1
    });

    return sendCreatedResponse(res, "Subscription plan created successfully", newPlan);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getSubscriptionPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid subscription plan ID.");
    }

    const plan = await subcriptionPlanModel.findById(id);
    if (!plan) {
      return sendNotFoundResponse(res, "Subscription plan not found");
    }

    return sendSuccessResponse(res, "Subscription plan retrieved successfully", plan);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getAllSubscriptionPlans = async (req, res) => {
  try {
    const plans = await subcriptionPlanModel.find().sort({ price: 1 });

    if (plans.length === 0) {
      return sendBadRequestResponse(res, "No subscription plan found");
    }

    return sendSuccessResponse(res, "Subscription plans retrieved successfully", plans);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const updateSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, monthlyPrice,  members } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid subscription plan ID.");
    }

    const plan = await subcriptionPlanModel.findById(id);
    if (!plan) {
      return sendNotFoundResponse(res, "Subscription plan not found");
    }

    if (title !== undefined) plan.title = title;
    if (description !== undefined) plan.description = description;
    if (price !== undefined) plan.price = price;
    if (monthlyPrice !== undefined) plan.monthlyPrice = monthlyPrice;
    if (members !== undefined) plan.members = members;

    await plan.save();
    return sendSuccessResponse(res, "Subscription plan updated successfully", plan);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const deleteSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid subscription plan ID.");
    }

    const plan = await subcriptionPlanModel.findByIdAndDelete(id);
    if (!plan) {
      return sendNotFoundResponse(res, "Subscription plan not found");
    }

    return sendSuccessResponse(res, "Subscription plan deleted successfully", plan);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};