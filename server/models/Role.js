import mongoose from "mongoose";
const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // admin, manager, user
      lowercase: true,
      trim: true
    },
    description: {
      type: String
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Role", roleSchema);
