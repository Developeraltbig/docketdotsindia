import express from "express";
import BankDetail from "../models/BankDetail.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   GET /api/bank-details
   Query params: page, limit, search
───────────────────────────────────────────────────────────── */
router.get("/", auth, checkPermission, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim() || "";
    const skip = (page - 1) * limit;

    // Build filter
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { bank_name: { $regex: search, $options: "i" } },
          { beneficiary_account_name: { $regex: search, $options: "i" } },
          { account_no: { $regex: search, $options: "i" } },
          { swift_code: { $regex: search, $options: "i" } },
          { ifsc_code: { $regex: search, $options: "i" } },
        ],
      };
    }

    const [bankDetails, total] = await Promise.all([
      BankDetail.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      BankDetail.countDocuments(filter),
    ]);

    res.json({ bankDetails, total, page, limit });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/bank-details/all
   Returns all bank details (no pagination) — for dropdowns
───────────────────────────────────────────────────────────── */
router.get("/all", auth, async (req, res, next) => {
  try {
    const bankDetails = await BankDetail.find().sort({ bank_name: 1 });
    res.json(bankDetails);
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/bank-details/:id
───────────────────────────────────────────────────────────── */
router.get("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const bankDetail = await BankDetail.findById(req.params.id);
    if (!bankDetail) {
      return res.status(404).json({ message: "Bank detail not found" });
    }
    res.json(bankDetail);
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/bank-details
───────────────────────────────────────────────────────────── */
router.post("/", auth, checkPermission, async (req, res, next) => {
  try {
    const {
      bank_name,
      bank_address,
      beneficiary_account_name,
      account_no,
      swift_code,
      ifsc_code,
      paypal,
      notes,
    } = req.body;

    if (!bank_name) {
      return res.status(400).json({ message: "Bank name is required" });
    }

    const bankDetail = await BankDetail.create({
      bank_name,
      bank_address,
      beneficiary_account_name,
      account_no,
      swift_code,
      ifsc_code,
      paypal,
      notes,
    });

    await logActivity({
      type: "bank_detail_action",
      description: `Bank detail "${bankDetail.bank_name}" created`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: bankDetail._id,
      entityType: "bank_detail",
      metadata: {
        bank_name: bankDetail.bank_name,
        account_no: bankDetail.account_no,
      },
    });

    res.status(201).json({
      message: "Bank detail created successfully",
      data: bankDetail,
    });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────
   PUT /api/bank-details/:id
───────────────────────────────────────────────────────────── */
router.put("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const {
      bank_name,
      bank_address,
      beneficiary_account_name,
      account_no,
      swift_code,
      ifsc_code,
      paypal,
      notes,
    } = req.body;

    const bankDetail = await BankDetail.findById(req.params.id);
    if (!bankDetail) {
      return res.status(404).json({ message: "Bank detail not found" });
    }

    // Update only provided fields
    if (bank_name !== undefined) bankDetail.bank_name = bank_name;
    if (bank_address !== undefined) bankDetail.bank_address = bank_address;
    if (beneficiary_account_name !== undefined)
      bankDetail.beneficiary_account_name = beneficiary_account_name;
    if (account_no !== undefined) bankDetail.account_no = account_no;
    if (swift_code !== undefined) bankDetail.swift_code = swift_code;
    if (ifsc_code !== undefined) bankDetail.ifsc_code = ifsc_code;
    if (paypal !== undefined) bankDetail.paypal = paypal;
    if (notes !== undefined) bankDetail.notes = notes;

    await bankDetail.save();

    await logActivity({
      type: "bank_detail_action",
      description: `Bank detail "${bankDetail.bank_name}" updated`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: bankDetail._id,
      entityType: "bank_detail",
      metadata: {
        bank_name: bankDetail.bank_name,
        account_no: bankDetail.account_no,
      },
    });

    res.json({
      message: "Bank detail updated successfully",
      data: bankDetail,
    });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/bank-details/:id
───────────────────────────────────────────────────────────── */
router.delete("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const bankDetail = await BankDetail.findById(req.params.id);
    if (!bankDetail) {
      return res.status(404).json({ message: "Bank detail not found" });
    }

    await BankDetail.findByIdAndDelete(req.params.id);

    await logActivity({
      type: "bank_detail_action",
      description: `Bank detail "${bankDetail.bank_name}" deleted`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: bankDetail._id,
      entityType: "bank_detail",
      metadata: {
        bank_name: bankDetail.bank_name,
        account_no: bankDetail.account_no,
      },
    });

    res.json({ message: "Bank detail deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
