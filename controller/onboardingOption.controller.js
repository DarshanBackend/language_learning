import LanguageToLearnModel from "../model/languageToLearn.model.js";
import NativeLanguageModel from "../model/nativeLanguage.model.js";
import LearningLevelModel from "../model/learningLevel.model.js";
import LearningGoalModel from "../model/learningGoal.model.js";
import TimeCommitmentModel from "../model/timeCommitment.model.js";
import InterestModel from "../model/interest.model.js";
import { uploadFile, deleteFileFromS3 } from "../middleware/imageupload.js";
import {
  sendSuccessResponse,
  sendCreatedResponse,
  sendErrorResponse,
  sendNotFoundResponse,
  sendBadRequestResponse,
} from "../utils/Response.utils.js";
import mongoose from "mongoose";

export class OnboardingOptionController {
  // ==========================================
  // Aggregate Endpoint: Retrieves everything in one payload
  // ==========================================
  static async getAllOptions(req, res) {
    try {
      const [
        languagesToLearn,
        nativeLanguages,
        levels,
        learningGoals,
        dailyTimeCommitments,
        interests,
      ] = await Promise.all([
        LanguageToLearnModel.find().sort({ title: 1 }),
        NativeLanguageModel.find().sort({ title: 1 }),
        LearningLevelModel.find(),
        LearningGoalModel.find().sort({ title: 1 }),
        TimeCommitmentModel.find(),
        InterestModel.find().sort({ title: 1 }),
      ]);

      const data = {
        languagesToLearn: languagesToLearn.map((l) => ({
          id: l._id,
          title: l.title,
          image: l.image,
        })),
        nativeLanguages: nativeLanguages.map((n) => ({
          id: n._id,
          title: n.title,
          image: n.image,
        })),
        levels: levels.map((lv) => ({
          id: lv._id,
          title: lv.title,
          image: lv.image,
          description: lv.description,
        })),
        learningGoals: learningGoals.map((g) => g.title),
        dailyTimeCommitments: dailyTimeCommitments.map((c) => c.title),
        interests: interests.map((i) => i.title),
      };

      return sendSuccessResponse(res, "All onboarding options loaded successfully.", data);
    } catch (error) {
      console.error("❌ Get All Onboarding Options Error:", error.message);
      return sendErrorResponse(res, 500, "Failed to aggregate onboarding options", error);
    }
  }

  // ==========================================
  // 1. Languages to Learn CRUD
  // ==========================================
  static async createLanguage(req, res) {
    let imageUrl = null;
    try {
      const { title } = req.body;
      if (!title) {
        return sendBadRequestResponse(res, "Title is required!");
      }

      const existing = await LanguageToLearnModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      });
      if (existing) {
        return sendBadRequestResponse(res, "Language already exists!");
      }

      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        imageUrl = uploadResult.url;
      }

      const item = await LanguageToLearnModel.create({
        title: title.trim(),
        image: imageUrl,
      });

      return sendCreatedResponse(res, "Language created successfully", item);
    } catch (error) {
      if (imageUrl) await deleteFileFromS3(imageUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getLanguages(req, res) {
    try {
      const list = await LanguageToLearnModel.find();

      if (list.length === 0) {
        return sendBadRequestResponse(res, "No any Language Found!!!")
      }

      return sendSuccessResponse(res, "Languages fetched successfully", list);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateLanguage(req, res) {
    let newImageUrl = null;
    try {
      const { id } = req.params;
      const { title } = req.body;

      const item = await LanguageToLearnModel.findById(id);
      if (!item) {
        return sendNotFoundResponse(res, "Language not found");
      }

      const updateData = {};
      if (title !== undefined) {
        updateData.title = title.trim();
      }

      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        newImageUrl = uploadResult.url;
        updateData.image = newImageUrl;
      }

      const oldImage = item.image;
      const updatedItem = await LanguageToLearnModel.findByIdAndUpdate(id, updateData, { new: true });

      if (req.file && oldImage) {
        await deleteFileFromS3(oldImage);
      }

      return sendSuccessResponse(res, "Language updated successfully", updatedItem);
    } catch (error) {
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteLanguage(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid LanguageId!!!")
      }

      const item = await LanguageToLearnModel.findById(id);
      if (!item) {
        return sendNotFoundResponse(res, "Language not found");
      }

      if (item.image) {
        await deleteFileFromS3(item.image);
      }

      await LanguageToLearnModel.findByIdAndDelete(id);
      return sendSuccessResponse(res, "Language deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // ==========================================
  // 2. Native Languages CRUD
  // ==========================================
  static async createNativeLanguage(req, res) {
    let imageUrl = null;
    try {
      const { title } = req.body;
      if (!title) {
        return sendBadRequestResponse(res, "Title is required!");
      }

      const existing = await NativeLanguageModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      });
      if (existing) {
        return sendBadRequestResponse(res, "Native language already exists!");
      }

      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        imageUrl = uploadResult.url;
      }

      const item = await NativeLanguageModel.create({
        title: title.trim(),
        image: imageUrl,
      });

      return sendCreatedResponse(res, "Native language created successfully", item);
    } catch (error) {
      if (imageUrl) await deleteFileFromS3(imageUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getNativeLanguages(req, res) {
    try {
      const list = await NativeLanguageModel.find();

      if (list.length === 0) {
        return sendBadRequestResponse(res, "No any Native Language Found!!!")
      }

      return sendSuccessResponse(res, "Native languages fetched successfully", list);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateNativeLanguage(req, res) {
    let newImageUrl = null;
    try {
      const { id } = req.params;
      const { title } = req.body;

      const item = await NativeLanguageModel.findById(id);
      if (!item) {
        return sendNotFoundResponse(res, "Native language not found");
      }

      const updateData = {};
      if (title !== undefined) {
        updateData.title = title.trim();
      }

      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        newImageUrl = uploadResult.url;
        updateData.image = newImageUrl;
      }

      const oldImage = item.image;
      const updatedItem = await NativeLanguageModel.findByIdAndUpdate(id, updateData, { new: true });

      if (req.file && oldImage) {
        await deleteFileFromS3(oldImage);
      }

      return sendSuccessResponse(res, "Native language updated successfully", updatedItem);
    } catch (error) {
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteNativeLanguage(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid Native LanguageId!!!")
      }

      const item = await NativeLanguageModel.findById(id);
      if (!item) {
        return sendNotFoundResponse(res, "Native language not found");
      }

      if (item.image) {
        await deleteFileFromS3(item.image);
      }

      await NativeLanguageModel.findByIdAndDelete(id);
      return sendSuccessResponse(res, "Native language deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // ==========================================
  // 3. Learning Levels CRUD
  // ==========================================
  static async createLevel(req, res) {
    let imageUrl = null;
    try {
      const { title, description } = req.body;
      if (!title || !description) {
        return sendBadRequestResponse(res, "Title and description are required!");
      }

      const existing = await LearningLevelModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      });
      if (existing) {
        return sendBadRequestResponse(res, "Level already exists!");
      }

      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        imageUrl = uploadResult.url;
      }

      const item = await LearningLevelModel.create({
        title: title.trim(),
        image: imageUrl,
        description: description.trim(),
      });

      return sendCreatedResponse(res, "Level created successfully", item);
    } catch (error) {
      if (imageUrl) await deleteFileFromS3(imageUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getLevels(req, res) {
    try {
      const list = await LearningLevelModel.find();

      if (list.length === 0) {
        return sendBadRequestResponse(res, "No any Level Found!!!")
      }


      return sendSuccessResponse(res, "Learning levels fetched successfully", list);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateLevel(req, res) {
    let newImageUrl = null;
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      const item = await LearningLevelModel.findById(id);
      if (!item) {
        return sendNotFoundResponse(res, "Level not found");
      }

      const updateData = {};
      if (title !== undefined) {
        updateData.title = title.trim();
      }
      if (description !== undefined) {
        updateData.description = description.trim();
      }

      if (req.file) {
        const uploadResult = await uploadFile(req.file);
        newImageUrl = uploadResult.url;
        updateData.image = newImageUrl;
      }

      const oldImage = item.image;
      const updatedItem = await LearningLevelModel.findByIdAndUpdate(id, updateData, { new: true });

      if (req.file && oldImage) {
        await deleteFileFromS3(oldImage);
      }

      return sendSuccessResponse(res, "Level updated successfully", updatedItem);
    } catch (error) {
      if (newImageUrl) await deleteFileFromS3(newImageUrl);
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteLevel(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid LevelId!!!")
      }

      const item = await LearningLevelModel.findById(id);
      if (!item) {
        return sendNotFoundResponse(res, "Level not found");
      }

      if (item.image) {
        await deleteFileFromS3(item.image);
      }

      await LearningLevelModel.findByIdAndDelete(id);
      return sendSuccessResponse(res, "Level deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // ==========================================
  // 4. Learning Goals CRUD
  // ==========================================
  static async createGoal(req, res) {
    try {
      const { title } = req.body;
      if (!title) return sendBadRequestResponse(res, "Title is required!");

      const existing = await LearningGoalModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      });
      if (existing) return sendBadRequestResponse(res, "Goal already exists!");

      const item = await LearningGoalModel.create({ title: title.trim() });
      return sendCreatedResponse(res, "Goal created successfully", item);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getGoals(req, res) {
    try {
      const list = await LearningGoalModel.find();

      if (list.length === 0) {
        return sendBadRequestResponse(res, "No any Goals Found!!!")
      }

      return sendSuccessResponse(res, "Learning goals fetched successfully", list);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateGoal(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid GoalId!!!")
      }

      const { title } = req.body;

      if (!title) return sendBadRequestResponse(res, "Title is required!");

      const item = await LearningGoalModel.findByIdAndUpdate(id, { title: title.trim() }, { new: true });
      if (!item) return sendNotFoundResponse(res, "Goal not found");

      return sendSuccessResponse(res, "Goal updated successfully", item);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteGoal(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid GoalId!!!")
      }

      const result = await LearningGoalModel.findByIdAndDelete(id);
      if (!result) return sendNotFoundResponse(res, "Goal not found");
      return sendSuccessResponse(res, "Goal deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // ==========================================
  // 5. Time Commitments CRUD
  // ==========================================
  static async createCommitment(req, res) {
    try {
      const { title } = req.body;
      if (!title) return sendBadRequestResponse(res, "Title is required!");

      const existing = await TimeCommitmentModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      });
      if (existing) return sendBadRequestResponse(res, "Commitment already exists!");

      const item = await TimeCommitmentModel.create({ title: title.trim() });
      return sendCreatedResponse(res, "Commitment created successfully", item);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getCommitments(req, res) {
    try {
      const list = await TimeCommitmentModel.find();

      if (list.length === 0) {
        return sendBadRequestResponse(res, "No any Commitments Found!!!")
      }

      return sendSuccessResponse(res, "Commitments fetched successfully", list);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateCommitment(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid commitmentId!!!")
      }

      const { title } = req.body;

      if (!title) return sendBadRequestResponse(res, "Title is required!");

      const item = await TimeCommitmentModel.findByIdAndUpdate(id, { title: title.trim() }, { new: true });
      if (!item) return sendNotFoundResponse(res, "Commitment not found");

      return sendSuccessResponse(res, "Commitment updated successfully", item);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteCommitment(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid CommitmentId!!!")
      }

      const result = await TimeCommitmentModel.findByIdAndDelete(id);
      if (!result) return sendNotFoundResponse(res, "Commitment not found");
      return sendSuccessResponse(res, "Commitment deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  // ==========================================
  // 6. Interests CRUD
  // ==========================================
  static async createInterest(req, res) {
    try {
      const { title } = req.body;
      if (!title) return sendBadRequestResponse(res, "Title is required!");

      const existing = await InterestModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      });
      if (existing) return sendBadRequestResponse(res, "Interest already exists!");

      const item = await InterestModel.create({ title: title.trim() });
      return sendCreatedResponse(res, "Interest created successfully", item);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async getInterests(req, res) {
    try {
      const list = await InterestModel.find();

      if (list.length === 0) {
        return sendBadRequestResponse(res, "No any Interest Found!!!")
      }

      return sendSuccessResponse(res, "Interests fetched successfully", list);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async updateInterest(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid InterestId!!!")
      }

      const { title } = req.body;

      if (!title) return sendBadRequestResponse(res, "Title is required!");

      const item = await InterestModel.findByIdAndUpdate(id, { title: title.trim() }, { new: true });
      if (!item) return sendNotFoundResponse(res, "Interest not found");

      return sendSuccessResponse(res, "Interest updated successfully", item);
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }

  static async deleteInterest(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return sendBadRequestResponse(res, "Invalid InterestId!!!")
      }

      const result = await InterestModel.findByIdAndDelete(id);
      if (!result) return sendNotFoundResponse(res, "Interest not found");
      return sendSuccessResponse(res, "Interest deleted successfully");
    } catch (error) {
      return sendErrorResponse(res, 500, error.message, error);
    }
  }
}