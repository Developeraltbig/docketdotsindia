import mongoose from "mongoose";
const roleMenuAccessSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
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

roleMenuAccessSchema.index({ roleId: 1, menuId: 1 }, { unique: true });

export default mongoose.model("RoleMenuAccess", roleMenuAccessSchema);
