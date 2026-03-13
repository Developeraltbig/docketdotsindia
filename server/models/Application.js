import mongoose from "mongoose";

// Sub-schema for Applicants
const ApplicantSchema = new mongoose.Schema({
  name: String,
  nationality: String,
  residence_country: String,
  address: String,
});

// Sub-schema for Inventors
const InventorSchema = new mongoose.Schema({
  name: String,
  citizen_country: String,
  residence_country: String,
  address: String,
});

// Sub-schema for Priorities
const PrioritySchema = new mongoose.Schema({
  country: String,
  priority_no: String,
  priority_date: Date,
  applicant_name: String,
  title_in_priority: String,
});

const ApplicationSchema = new mongoose.Schema(
  {
    DOC_NO: { type: String, required: true }, // References Docket Number
    jurisdiction: String,
    application_type: String,
    applicant_category: String,
    inter_appli_no: String,
    inter_filing_date: Date,
    title: String,

    // Dynamic Row Arrays
    applicants: [ApplicantSchema],
    inventors_same_as_applicant: String,
    inventors: [InventorSchema],
    claiming_priority: String,
    priorities: [PrioritySchema],

    // Specification details
    descrip_of_page: Number,
    claims_page: Number,
    drawing_page: Number,
    abstract_page: { type: Number, default: 1 },
    form_2_page: { type: Number, default: 1 },
    sum_number_of_page: Number,
    number_of_drawing: Number,
    number_of_claims: Number,
    number_of_priorities: Number,
    total_pages: Number,

    // Fee Details
    basic_fee: Number,
    no_of_extra_page: Number,
    extra_page_charge: Number,
    no_of_extra_claims: Number,
    extra_claims_charge: Number,
    no_of_extra_priorities: Number,
    extra_priorities_charge: Number,

    request_examination: String,
    examination_charge: Number,
    sequence_listing: String,
    sequence_page: Number,
    sequence_charge: Number,

    deposit_date: Date,
    deposit_fee: Number,

    status: { type: String, default: "application" },

    // Created by tracking
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true, // Index for faster queries when filtering by user
    },
    created_by_name: {
      type: String,
    },

    // Updated by tracking
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updated_by_name: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound index for common queries
ApplicationSchema.index({ created_by: 1, createdAt: -1 });
ApplicationSchema.index({ DOC_NO: 1 });
ApplicationSchema.index({ application_type: 1 });

const Application = mongoose.model("Application", ApplicationSchema);
export default Application;
