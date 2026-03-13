import mongoose from "mongoose";

const DeadlineSchema = new mongoose.Schema(
  {
    docket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Docket",
      required: true,
    },
    application_no: {
      type: String,
      required: true,
      trim: true,
    },
    app_number: {
      type: String,
      trim: true,
    },
    worktype: {
      type: String,
      required: true,
      enum: [
        "Provisional",
        "Ordinary",
        "Ordinary+F18",
        "NP",
        "NP+F18",
        "Convention",
        "Convention+F18",
        "Form 3",
        "Form 4",
        "Form 6",
        "Form 8",
        "Form 9",
        "Form 13",
        "Form 18",
        "Form 25",
        "Form 26",
        "Form 27",
        "Form 28",
        "Form 29",
        "Response to Hearing",
        "Proof of Right",
        "Certificate for Translation Verification",
        "Priority Document",
        "Response to FER",
        "Annuity Fee",
        "Others",
      ],
    },
    deadline_date: {
      type: Date,
      required: true,
    },
    remainder1: { type: Date },
    remainder2: { type: Date },
    remainder3: { type: Date },
    remainder4: { type: Date },
    remainder5: { type: Date },
    remainder6: { type: Date },
    remarks: {
      type: String,
      trim: true,
    },
    emails: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["ON", "OFF", "COMPLETED", "PENDING"],
      default: "ON",
    },
    insertby: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Index for faster queries
DeadlineSchema.index({ docket_number: 1 });
DeadlineSchema.index({ deadline_date: 1 });
DeadlineSchema.index({ application_no: 1 });

export default mongoose.model("Deadline", DeadlineSchema);
