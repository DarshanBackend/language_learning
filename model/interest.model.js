import mongoose from "mongoose";

const InterestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Interest title is required"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const InterestModel = mongoose.model("Interest", InterestSchema);
export default InterestModel;
