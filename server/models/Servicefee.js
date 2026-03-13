import mongoose from "mongoose";

const serviceFeeSchema = new mongoose.Schema(
  {
    service_name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      unique: true,
    },
    // Official fee for: Natural person, Start-up, Small entity, Educational institution
    official_fee_small: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Official fee for: Others (Large Entity)
    official_fee_large: {
      type: Number,
      default: 0,
      min: 0,
    },
    our_fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

export default mongoose.model("ServiceFee", serviceFeeSchema);
