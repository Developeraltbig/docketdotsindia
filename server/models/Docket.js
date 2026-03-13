import mongoose from "mongoose";

const DocketSchema = new mongoose.Schema(
  {
    instruction_date: { type: Date, required: true },
    docket_no: { type: String, required: true, unique: true },
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ... other fields remain the same ...
    service_name: String,
    client_ref: String,
    currency: { type: String, default: "USD" },
    anovipfee: { type: Number, default: 0 },
    associatefee: { type: Number, default: 0 },
    officialfee: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },

    spoc_name: String,
    phone_no: String,
    firm_name: String,
    country: String,
    email: String,
    address: String,

    foreign_associate_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ForeignAssociate",
      default: null,
    },

    associate_ref_no: { type: String, default: null },
    associate_spoc_name: { type: String, default: null },
    associate_phone_no: { type: String, default: null },
    associate_firm_name: { type: String, default: null },
    associate_country: { type: String, default: null },
    associate_email: { type: String, default: null },
    associate_address: { type: String, default: null },

    application_status: String,
    due_date: Date,
    application_number: { type: String, default: null },

    application_type: String,
    filling_country: String,
    filling_date: Date,
    application_no: String,
    corresponding_application_no: { type: String, default: null },
    applicant_type: String,
    title: String,
    pct_application_date: { type: Date, default: null },
    field_of_invention: { type: String, default: null },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming your admin/employee users are in the 'User' collection
      required: false, // False for backward compatibility with old records
    },
    // --- CHANGED: Updated to store S3 metadata instead of just strings ---
    files: [
      {
        key: String, // S3 Key
        filename: String, // Original Name
        fileType: String, // Mime Type
        fileSize: Number, // Size in bytes
        documentType: {
          type: String,
          enum: ["Input", "Internal", "Output"],
          required: true,
        },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    status: { type: String, default: "docket" },

    applicants: [
      {
        name: { type: String, default: null },
        nationality: { type: String, default: null },
        country_residence: { type: String, default: null },
        address: { type: String, default: null },
      },
    ],
    inventors: [
      {
        name: { type: String, default: null },
        country: { type: String, default: null },
        nationality: { type: String, default: null },
        address: { type: String, default: null },
      },
    ],
    priorities: [
      {
        country: { type: String, default: null },
        number: { type: String, default: null },
        date: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true },
);

DocketSchema.pre("save", async function () {
  const anovip = Number(this.anovipfee) || 0;
  const associate = Number(this.associatefee) || 0;
  const official = Number(this.officialfee) || 0;
  this.fee = Math.round(anovip + associate + official);
});

const Docket = mongoose.model("Docket", DocketSchema);
export default Docket;
