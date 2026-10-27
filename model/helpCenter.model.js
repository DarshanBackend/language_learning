import mongoose from "mongoose";

const helpcenterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    points: {
      type: [String],
      required: [true, "Points are required"],
      default: [],
    },
  },
  { timestamps: true }
);

const helpcenterModel = mongoose.model("helpcenter", helpcenterSchema);
export default helpcenterModel;