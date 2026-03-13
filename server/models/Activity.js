import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "docket_created",
        "docket_updated",
        "docket_deleted",
        "task_created",
        "task_updated",
        "task_deleted",
        "deadline_created",
        "deadline_updated",
        "deadline_deleted",
        "application_created",
        "application_updated",
        "application_deleted",
        "invoice_created",
        "invoice_updated",
        "invoice_deleted",
        "deadline_reminder_sent",
        "user_login",
        "user_logout",
        "user_action",
      ],
    },
    description: {
      type: String,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    done_by: {
      type: String,
      default: "System",
    },
    entity_id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    entity_type: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// Index for fast recent-activity queries
activitySchema.index({ createdAt: -1 });
activitySchema.index({ user_id: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
