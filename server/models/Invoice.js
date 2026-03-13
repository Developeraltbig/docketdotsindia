import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    // Invoice Meta
    invoice_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    invoice_date: {
      type: Date,
      default: Date.now,
    },
    due_date: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"],
      default: "Draft",
    },

    // Linked Docket
    docket_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Docket",
      required: true,
    },
    docket_no: { type: String },

    // Client Details (pre-filled from docket)
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    client_ref: { type: String },
    spoc_name: { type: String },
    phone_no: { type: String },
    firm_name: { type: String },
    country: { type: String },
    email: { type: String },
    address: { type: String },

    // Application Details (pre-filled from docket)
    application_type: { type: String },
    application_number: { type: String },
    application_no: { type: String },
    corresponding_application_no: { type: String },
    title: { type: String },
    filling_country: { type: String },
    worktype: { type: String },

    // Fee Details (pre-filled from docket)
    currency: { type: String, default: "INR" },
    anovipfee: { type: Number, default: 0 },
    associatefee: { type: Number, default: 0 },
    officialfee: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },

    // GST
    gst_percentage: { type: Number, default: 18 },
    gst_amount: { type: Number, default: 0 },
    total_with_gst: { type: Number, default: 0 },

    // Bank Details (manual entry)
    bank_name: { type: String },
    bank_address: { type: String },
    beneficiary_account_name: { type: String },
    account_no: { type: String },
    swift_code: { type: String },
    ifsc_code: { type: String },
    paypal: { type: String },

    // Notes
    notes: { type: String },

    // Created By
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Auto-calculate GST and total before saving
invoiceSchema.pre("save", async function () {
  const fee = this.fee || 0;
  const gstPct = this.gst_percentage || 0;
  this.gst_amount = Math.round(fee * (gstPct / 100));
  this.total_with_gst = fee + this.gst_amount;
});

// Also handle on findOneAndUpdate
invoiceSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();
  if (update && update.$set) {
    const fee = update.$set.fee || 0;
    const gstPct =
      update.$set.gst_percentage !== undefined
        ? update.$set.gst_percentage
        : 18;

    update.$set.gst_amount = Math.round(fee * (gstPct / 100));
    update.$set.total_with_gst = fee + update.$set.gst_amount;
  }
});

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
