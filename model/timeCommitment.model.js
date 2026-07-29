import mongoose from "mongoose";

const TimeCommitmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Commitment title is required"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const TimeCommitmentModel = mongoose.model("TimeCommitment", TimeCommitmentSchema);
export default TimeCommitmentModel;