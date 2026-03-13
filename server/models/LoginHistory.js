import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["login", "logout"],
      required: true,
    },
    ip_address: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

loginHistorySchema.index({ user_id: 1, createdAt: -1 });
loginHistorySchema.index({ createdAt: -1 });

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);

export default LoginHistory;
