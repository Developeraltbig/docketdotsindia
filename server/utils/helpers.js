import mongoose from "mongoose";

export const generatePassword = () => {
  const random = Math.random().toString(36).slice(-8);
  return random + "@A1";
};


export const generateEmployeeId = async (type = "user") => {
  // Prefix mapping (update as needed)
  const prefixMap = {
    patent: "PAT",
    trademark: "TRA",
    admin: "ADM",
    manager: "MGR",
    user: "EMP"
  };

  const prefix = prefixMap[type] || "EMP";

  // Counter schema (defined once)
  const counterSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    seq: { type: Number, default: 0 }
  });

  // Prevent model re-declaration
  const Counter =
    mongoose.models.Counter ||
    mongoose.model("Counter", counterSchema);

  // Atomic increment (NO duplicates, NO race condition)
  const counter = await Counter.findOneAndUpdate(
    { key: prefix },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true
    }
  );

  return `${prefix}-${String(counter.seq).padStart(3, "0")}`;
};
