import mongoose from "mongoose";
import AppInfoModel from "../model/appInfo.model.js";
import {
  sendBadRequestResponse,
  sendErrorResponse,
  sendSuccessResponse,
  sendCreatedResponse,
  sendNotFoundResponse
} from "../utils/Response.utils.js";


export const createAppInfo = async (req, res) => {
  try {
    const { currentVersion, lastUpdated, releaseNotes, aboutUs, securityPrivacy } = req.body;

    if (!currentVersion || !lastUpdated || !aboutUs) {
      return sendBadRequestResponse(
        res,
        "currentVersion, lastUpdated, and aboutUs details are required."
      );
    }

    if (releaseNotes !== undefined && !Array.isArray(releaseNotes)) {
      return sendBadRequestResponse(res, "releaseNotes must be an array of strings.");
    }

    if (securityPrivacy !== undefined && !Array.isArray(securityPrivacy)) {
      return sendBadRequestResponse(res, "securityPrivacy must be an array of strings.");
    }

    const newInfo = await AppInfoModel.create({
      currentVersion,
      lastUpdated,
      releaseNotes: releaseNotes || [],
      aboutUs,
      securityPrivacy: securityPrivacy || []
    });

    return sendCreatedResponse(res, "App Info created successfully", newInfo);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getAllAppInfo = async (req, res) => {
  try {
    const list = await AppInfoModel.find().sort({ createdAt: -1 });
    if (list.length === 0) {
      return sendBadRequestResponse(res, "No App Info found");
    }
    return sendSuccessResponse(res, "App Info retrieved successfully", list);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const getAppInfoById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid App Info ID.");
    }

    const info = await AppInfoModel.findById(id);
    if (!info) {
      return sendNotFoundResponse(res, "App Info not found");
    }

    return sendSuccessResponse(res, "App Info retrieved successfully", info);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const updateAppInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentVersion, lastUpdated, releaseNotes, aboutUs, securityPrivacy } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid App Info ID.");
    }

    const info = await AppInfoModel.findById(id);
    if (!info) {
      return sendNotFoundResponse(res, "App Info not found");
    }

    if (currentVersion !== undefined) info.currentVersion = currentVersion;
    if (lastUpdated !== undefined) info.lastUpdated = lastUpdated;
    if (aboutUs !== undefined) info.aboutUs = aboutUs;
    if (releaseNotes !== undefined) {
      if (!Array.isArray(releaseNotes)) {
        return sendBadRequestResponse(res, "releaseNotes must be an array of strings.");
      }
      info.releaseNotes = releaseNotes;
    }
    if (securityPrivacy !== undefined) {
      if (!Array.isArray(securityPrivacy)) {
        return sendBadRequestResponse(res, "securityPrivacy must be an array of strings.");
      }
      info.securityPrivacy = securityPrivacy;
    }

    await info.save();
    return sendSuccessResponse(res, "App Info updated successfully", info);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};

export const deleteAppInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendBadRequestResponse(res, "Invalid App Info ID.");
    }

    const info = await AppInfoModel.findByIdAndDelete(id);
    if (!info) {
      return sendNotFoundResponse(res, "App Info not found");
    }

    return sendSuccessResponse(res, "App Info deleted successfully", info);
  } catch (error) {
    return sendErrorResponse(res, 500, "Server error", error);
  }
};
