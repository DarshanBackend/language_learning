import mongoose from "mongoose";
import helpcenterModel from "../model/helpCenter.model.js";
import {
    sendBadRequestResponse,
    sendErrorResponse,
    sendSuccessResponse,
    sendCreatedResponse,
    sendNotFoundResponse
} from "../utils/Response.utils.js";

export const createHelpCenter = async (req, res) => {
    try {
        const { title, description, points } = req.body;

        if (!title || !description || !Array.isArray(points)) {
            return sendBadRequestResponse(res, "Title, description, and points (array of strings) are required.");
        }

        const newSection = await helpcenterModel.create({ title, description, points });

        return sendCreatedResponse(res, "Help Center section created successfully", newSection);
    } catch (error) {
        return sendErrorResponse(res, 500, "Server error", error);
    }
};

export const getHelpCenterById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Help Center ID.");
        }

        const section = await helpcenterModel.findById(id);
        if (!section) {
            return sendNotFoundResponse(res, "Help Center section not found");
        }
        return sendSuccessResponse(res, "Help Center retrieved successfully", section);
    } catch (error) {
        return sendErrorResponse(res, 500, "Server error", error);
    }
};

export const getAllHelpCenter = async (req, res) => {
    try {
        const sections = await helpcenterModel.find();

        if (sections.length === 0) {
            return sendBadRequestResponse(res, "No Help Center section found");
        }

        return sendSuccessResponse(res, "Help Center retrieved successfully", sections);
    } catch (error) {
        return sendErrorResponse(res, 500, "Server error", error);
    }
};

export const updateHelpCenter = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, points } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Help Center ID.");
        }

        const section = await helpcenterModel.findById(id);
        if (!section) {
            return sendNotFoundResponse(res, "Help Center section not found");
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
        return sendSuccessResponse(res, "Help Center section updated successfully", section);
    } catch (error) {
        return sendErrorResponse(res, 500, "Server error", error);
    }
};

export const deleteHelpCenter = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Help Center ID.");
        }

        const section = await helpcenterModel.findByIdAndDelete(id);
        if (!section) {
            return sendNotFoundResponse(res, "Help Center section not found");
        }

        return sendSuccessResponse(res, "Help Center section deleted successfully", section);
    } catch (error) {
        return sendErrorResponse(res, 500, "Server error", error);
    }
};