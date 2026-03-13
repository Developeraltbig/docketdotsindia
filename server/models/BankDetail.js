import mongoose from "mongoose";

const bankDetailSchema = new mongoose.Schema(
  {
    bank_name: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
    },
    bank_address: {
      type: String,
      trim: true,
      default: "",
    },
    beneficiary_account_name: {
      type: String,
      trim: true,
      default: "",
    },
    account_no: {
      type: String,
      trim: true,
      default: "",
    },
    swift_code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    ifsc_code: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    paypal: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Index for search
bankDetailSchema.index({
  bank_name: "text",
  beneficiary_account_name: "text",
  account_no: "text",
});

const BankDetail = mongoose.model("BankDetail", bankDetailSchema);

export default BankDetail;
