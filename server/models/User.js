import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    department: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    // Auto-generated employee ID (required)
    e_id: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    phone_no: { type: String },
    firm_name: { type: String },
    country: { type: String },
    address: { type: String },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
export default User;
