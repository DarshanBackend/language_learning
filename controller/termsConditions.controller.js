import mongoose from "mongoose";
import TermsConditionsModel from "../model/termsConditions.model.js";
import {
  sendBadRequestResponse,
  sendErrorResponse,
  sendSuccessResponse,
  sendCreatedResponse,
  sendNotFoundResponse
} from "../utils/Response.utils.js";

export const getTermsConditions = async (req, res) => {
  try {
    const terms = await TermsConditionsModel.findOne().sort({ createdAt: -1 });
    if (!terms) {
      return sendSuccessResponse(res, "No Terms & Conditions found", null);
    }
    return sendSuccessResponse(res, "Terms & Conditions retrieved successfully", terms);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const updateTermsConditionsHeader = async (req, res) => {
  try {
    const { lastUpdated, introduction } = req.body;

    if (!lastUpdated || !introduction) {
      return sendBadRequestResponse(res, "lastUpdated and introduction are required.");
    }

    const terms = await TermsConditionsModel.findOneAndUpdate(
      {},
      { lastUpdated, introduction },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccessResponse(res, "Terms & Conditions header updated successfully", terms);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const createTermsConditions = async (req, res) => {
  try {
    const { title, description, points } = req.body;

    if (!title) {
      return sendBadRequestResponse(res, "Title is required.");
    }

    if (points !== undefined && !Array.isArray(points)) {
      return sendBadRequestResponse(res, "Points must be an array of strings.");
    }

    let terms = await TermsConditionsModel.findOne();
    if (!terms) {
      // Create a default parent document if it does not exist yet
      terms = await TermsConditionsModel.create({
        lastUpdated: "May 2025",
        introduction: "Welcome to Floma! By downloading or using the app, you agree to the following terms and conditions. Please read them carefully.",
        sections: []
      });
    }

    const newSection = {
      title,
      description: description || "",
      points: points || []
    };

    terms.sections.push(newSection);
    await terms.save();

    const savedSection = terms.sections[terms.sections.length - 1];
    return sendCreatedResponse(res, "Terms & Conditions section created successfully", savedSection);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getTermsConditionsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid Terms & Conditions ID.");
    }

    const terms = await TermsConditionsModel.findOne();
    if (!terms) {
      return sendNotFoundResponse(res, "Terms & Conditions not found");
    }

    const section = terms.sections.id(id);
    if (!section) {
      return sendNotFoundResponse(res, "Terms & Conditions section not found");
    }

    return sendSuccessResponse(res, "Terms & Conditions retrieved successfully", section);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getAllTermsConditions = async (req, res) => {
  try {
    const terms = await TermsConditionsModel.findOne();

    if (!terms || terms.sections.length === 0) {
      return sendBadRequestResponse(res, "No Terms & Conditions section found");
    }

    return sendSuccessResponse(res, "Terms & Conditions retrieved successfully", terms.sections);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const updateTermsConditions = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, points } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid Terms & Conditions ID.");
    }

    const terms = await TermsConditionsModel.findOne();
    if (!terms) {
      return sendNotFoundResponse(res, "Terms & Conditions not found");
    }

    const section = terms.sections.id(id);
    if (!section) {
      return sendNotFoundResponse(res, "Terms & Conditions section not found");
    }

    if (title !== undefined) section.title = title;
    if (description !== undefined) section.description = description;
    if (points !== undefined) {
      if (!Array.isArray(points)) {
        return sendBadRequestResponse(res, "Points must be an array of strings.");
      }
      section.points = points;
    }

    await terms.save();
    return sendSuccessResponse(res, "Terms & Conditions section updated successfully", section);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const deleteTermsConditions = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid Terms & Conditions ID.");
    }

    const terms = await TermsConditionsModel.findOne();
    if (!terms) {
      return sendNotFoundResponse(res, "Terms & Conditions not found");
    }

    const section = terms.sections.id(id);
    if (!section) {
      return sendNotFoundResponse(res, "Terms & Conditions section not found");
    }

    section.deleteOne();
    await terms.save();

    return sendSuccessResponse(res, "Terms & Conditions section deleted successfully", section);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};