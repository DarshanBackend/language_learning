import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
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
        price: {
            type: Number,
            required: [true, "Price is required"],
        },
        monthlyPrice: {
            type: Number,
            required: [true, "Monthly price is required"],
        },
        members: {
            type: Number,
            default: 1,
        },
    },
    { timestamps: true }
);

const subcriptionPlanModel = mongoose.model("subcriptionPlan", subscriptionSchema);
export default subcriptionPlanModel;