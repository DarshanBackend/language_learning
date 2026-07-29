import mongoose from "mongoose";
import privacyPolicyModel from "../model/privacyPolicy.model.js";
import {
  sendBadRequestResponse,
  sendErrorResponse,
  sendSuccessResponse,
  sendCreatedResponse,
  sendNotFoundResponse
} from "../utils/Response.utils.js";

export const createPrivacyPolicy = async (req, res) => {
  try {
    const { title, description, points } = req.body;

    if (!title) {
      return sendBadRequestResponse(res, "Title is required.");
    }

    if (points !== undefined && !Array.isArray(points)) {
      return sendBadRequestResponse(res, "Points must be an array of strings.");
    }

    const newSection = await privacyPolicyModel.create({
      title,
      description: description || "",
      points: points || []
    });

    return sendCreatedResponse(res, "Privacy Policy section created successfully", newSection);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getPrivacyPolicyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid Privacy Policy ID.");
    }

    const section = await privacyPolicyModel.findById(id);
    if (!section) {
      return sendNotFoundResponse(res, "Privacy Policy section not found");
    }
    return sendSuccessResponse(res, "Privacy Policy retrieved successfully", section);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getAllPrivacyPolicy = async (req, res) => {
  try {
    const sections = await privacyPolicyModel.find().sort({ createdAt: 1 });

    if (sections.length === 0) {
      return sendBadRequestResponse(res, "No Privacy Policy section found");
    }

    return sendSuccessResponse(res, "Privacy Policy retrieved successfully", sections);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const updatePrivacyPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, points } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid Privacy Policy ID.");
    }

    const section = await privacyPolicyModel.findById(id);
    if (!section) {
      return sendNotFoundResponse(res, "Privacy Policy section not found");
    }

    if (title !== undefined) section.title = title;
    if (description !== undefined) section.description = description;
    if (points !== undefined) {
      if (!Array.isArray(points)) {
        return sendBadRequestResponse(res, "Points must be an array of strings.");
      }
      section.points = points;
    }

    await section.save();
    return sendSuccessResponse(res, "Privacy Policy section updated successfully", section);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const deletePrivacyPolicy = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid Privacy Policy ID.");
    }

    const section = await privacyPolicyModel.findByIdAndDelete(id);
    if (!section) {
      return sendNotFoundResponse(res, "Privacy Policy section not found");
    }

    return sendSuccessResponse(res, "Privacy Policy section deleted successfully", section);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};
