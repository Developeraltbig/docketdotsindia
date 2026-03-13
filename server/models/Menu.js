import mongoose from "mongoose"; 
const menuSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    route: {
      type: String,
      required: true
    },
    icon: {
      type: String
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      default: null
    },
    order: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Menu", menuSchema);
