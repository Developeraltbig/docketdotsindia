import mongoose from "mongoose";
// --- Master table ---
const foreignAssociateSchema = new mongoose.Schema(
  {
    firm_name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    city: { type: String, trim: true, default: "" },
    contact_person: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    reference_format: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

export default mongoose.model("ForeignAssociate", foreignAssociateSchema);
