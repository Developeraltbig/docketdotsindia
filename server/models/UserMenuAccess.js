import mongoose from "mongoose";
const userMenuAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      required: true
    },
    canView: {
      type: Boolean,
      default: true
    },
    canCreate: {
      type: Boolean,
      default: false
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

userMenuAccessSchema.index({ userId: 1, menuId: 1 }, { unique: true });

export default mongoose.model("UserMenuAccess", userMenuAccessSchema);
