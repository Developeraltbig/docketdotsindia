import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    // Linked Docket
    docket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Docket",
    },
    docket_no: {
      type: String,
      required: true,
    },

    // Basic Info
    work_type: {
      type: String,
      enum: [
        "Ordinary",
        "Ordinary+F18",
        "Provisional",
        "Conventional",
        "PCT-NP",
        "Annuity Fee",
        "N/A",
        "",
      ],
      default: "",
    },
    task_status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "On Hold", ""],
      default: "Pending",
    },
    sub_status: {
      type: String,
      enum: ["Prepared", "Reviewed", "Final Reviewed", ""],
      default: "",
    },
    territory_manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      set: (val) => (val === "" ? null : val),
    },

    // Examinations - User References
    prepared_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    review_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    final_review_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Additional Info
    country: String,
    remarks: String,

    // Application Details
    client_ref_no: String,
    client_name: String,
    pct_application_no: String,
    title: String,
    application_type: String,

    // Application Dates
    instruction_date: Date,
    internal_deadline: Date,
    official_deadline: Date,
    filling_date: Date,
    filling_country: String,
    reporting_date: Date,

    // --- CHANGED: Replaced 'docket_doc' with 'files' array for S3 ---
    files: [
      {
        key: String, // S3 Key
        filename: String, // Original Name
        fileType: String, // Mime Type
        fileSize: Number, // Size in bytes
        documentType: {
          type: String,
          enum: ["Input", "Internal", "Output", ""],
          default: "",
        },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Kept for legacy support if needed, otherwise safe to ignore
    docket_doc: {
      filename: String,
      path: String,
      mimetype: String,
    },

    // Metadata
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Virtual populate for user names
TaskSchema.virtual("prepared_by_name", {
  ref: "User",
  localField: "prepared_by",
  foreignField: "_id",
  justOne: true,
});

TaskSchema.virtual("review_by_name", {
  ref: "User",
  localField: "review_by",
  foreignField: "_id",
  justOne: true,
});

TaskSchema.virtual("final_review_by_name", {
  ref: "User",
  localField: "final_review_by",
  foreignField: "_id",
  justOne: true,
});

TaskSchema.set("toJSON", { virtuals: true });
TaskSchema.set("toObject", { virtuals: true });

TaskSchema.index({ docket_no: 1 });
TaskSchema.index({ task_status: 1 });
TaskSchema.index({ prepared_by: 1 });
TaskSchema.index({ createdAt: -1 });

const Task = mongoose.model("Task", TaskSchema);
export default Task;
