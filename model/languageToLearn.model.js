import mongoose from "mongoose";

const LanguageToLearnSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Language title is required"],
      unique: true,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    }
  },
  { timestamps: true }
);

const LanguageToLearnModel = mongoose.model("LanguageToLearn", LanguageToLearnSchema);
export default LanguageToLearnModel;
