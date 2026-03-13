import express from "express";
import ServiceFee from "../models/Servicefee.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

/* ────────────────────────────────────────────────────────────────────────────
   GET ALL SERVICE FEES  (with pagination + search)
   GET /api/service-fees?page=1&limit=10&search=patent
   ──────────────────────────────────────────────────────────────────────────── */
router.get("/", auth, checkPermission, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) {
      filter.service_name = new RegExp(req.query.search, "i");
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [serviceFees, total] = await Promise.all([
      ServiceFee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      ServiceFee.countDocuments(filter),
    ]);

    res.json({
      serviceFees,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   GET ALL ACTIVE SERVICE FEES (no pagination — for dropdowns)
   GET /api/service-fees/active
   ──────────────────────────────────────────────────────────────────────────── */
router.get("/active", auth, async (req, res, next) => {
  try {
    const serviceFees = await ServiceFee.find({ status: "active" }).sort({
      service_name: 1,
    });
    res.json(serviceFees);
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   GET SINGLE SERVICE FEE
   GET /api/service-fees/:id
   ──────────────────────────────────────────────────────────────────────────── */
router.get("/:id", auth, async (req, res, next) => {
  try {
    const serviceFee = await ServiceFee.findById(req.params.id);
    if (!serviceFee)
      return res.status(404).json({ message: "Service fee not found" });
    res.json(serviceFee);
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   CREATE SERVICE FEE
   POST /api/service-fees
   ──────────────────────────────────────────────────────────────────────────── */
router.post("/", auth, checkPermission, async (req, res, next) => {
  try {
    const {
      service_name,
      official_fee_small,
      official_fee_large,
      our_fee,
      description,
      status,
    } = req.body;

    if (!service_name || !service_name.trim()) {
      return res.status(400).json({ message: "Service name is required" });
    }

    // Check duplicate
    const existing = await ServiceFee.findOne({
      service_name: new RegExp(`^${service_name.trim()}$`, "i"),
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Service with this name already exists" });
    }

    const serviceFee = await ServiceFee.create({
      service_name: service_name.trim(),
      official_fee_small: parseFloat(official_fee_small) || 0,
      official_fee_large: parseFloat(official_fee_large) || 0,
      our_fee: parseFloat(our_fee) || 0,
      description: description || "",
      status: status || "active",
    });

    await logActivity({
      type: "service_fee",
      description: `Service fee "${serviceFee.service_name}" created`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: serviceFee._id,
      entityType: "service_fee",
      metadata: {
        service_name: serviceFee.service_name,
        official_fee_small: serviceFee.official_fee_small,
        official_fee_large: serviceFee.official_fee_large,
        our_fee: serviceFee.our_fee,
      },
    });

    res.status(201).json({ message: "Service fee created", data: serviceFee });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   UPDATE SERVICE FEE
   PUT /api/service-fees/:id
   ──────────────────────────────────────────────────────────────────────────── */
router.put("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const {
      service_name,
      official_fee_small,
      official_fee_large,
      our_fee,
      description,
      status,
    } = req.body;

    const serviceFee = await ServiceFee.findById(req.params.id);
    if (!serviceFee)
      return res.status(404).json({ message: "Service fee not found" });

    // Check duplicate name (exclude current)
    if (service_name && service_name.trim() !== serviceFee.service_name) {
      const existing = await ServiceFee.findOne({
        service_name: new RegExp(`^${service_name.trim()}$`, "i"),
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Service with this name already exists" });
      }
    }

    serviceFee.service_name = service_name?.trim() ?? serviceFee.service_name;
    serviceFee.official_fee_small =
      official_fee_small !== undefined
        ? parseFloat(official_fee_small) || 0
        : serviceFee.official_fee_small;
    serviceFee.official_fee_large =
      official_fee_large !== undefined
        ? parseFloat(official_fee_large) || 0
        : serviceFee.official_fee_large;
    serviceFee.our_fee =
      our_fee !== undefined ? parseFloat(our_fee) || 0 : serviceFee.our_fee;
    serviceFee.description = description ?? serviceFee.description;
    serviceFee.status = status ?? serviceFee.status;

    await serviceFee.save();

    await logActivity({
      type: "service_fee",
      description: `Service fee "${serviceFee.service_name}" updated`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: serviceFee._id,
      entityType: "service_fee",
      metadata: {
        service_name: serviceFee.service_name,
        official_fee_small: serviceFee.official_fee_small,
        official_fee_large: serviceFee.official_fee_large,
        our_fee: serviceFee.our_fee,
      },
    });

    res.json({ message: "Updated", data: serviceFee });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   DELETE SERVICE FEE
   DELETE /api/service-fees/:id
   ──────────────────────────────────────────────────────────────────────────── */
router.delete("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const serviceFee = await ServiceFee.findById(req.params.id);
    if (!serviceFee)
      return res.status(404).json({ message: "Service fee not found" });

    await ServiceFee.findByIdAndDelete(req.params.id);

    await logActivity({
      type: "service_fee",
      description: `Service fee "${serviceFee.service_name}" deleted`,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      entityId: serviceFee._id,
      entityType: "service_fee",
      metadata: { service_name: serviceFee.service_name },
    });

    res.json({ message: "Deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
