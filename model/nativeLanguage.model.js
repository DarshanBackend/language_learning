import mongoose from "mongoose";

const NativeLanguageSchema = new mongoose.Schema(
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
    },
  },
  { timestamps: true }
);

const NativeLanguageModel = mongoose.model("NativeLanguage", NativeLanguageSchema);
export default NativeLanguageModel;
