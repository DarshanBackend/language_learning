import mongoose from "mongoose";

const TermsConditionsSectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Section title is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  points: {
    type: [String],
    default: [],
  },
});

const TermsConditionsSchema = new mongoose.Schema(
  {
    lastUpdated: {
      type: String,
      required: [true, "Last updated date is required"],
      trim: true,
    },
    introduction: {
      type: String,
      required: [true, "Introduction text is required"],
      trim: true,
    },
    sections: {
      type: [TermsConditionsSectionSchema],
      required: [true, "Sections are required"],
      default: [],
    },
  },
  { timestamps: true }
);

const TermsConditionsModel = mongoose.model("TermsConditions", TermsConditionsSchema);
export default TermsConditionsModel;
