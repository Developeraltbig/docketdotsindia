import express from "express";
import ForeignAssociate from "../models/Foreignassociate.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

// GET all foreign associates
router.get("/", auth, checkPermission, async (req, res, next) => {
  try {
    const { status, country, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (country) query.country = { $regex: country, $options: "i" };
    if (search) {
      query.$or = [
        { firm_name: { $regex: search, $options: "i" } },
        { contact_person: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ForeignAssociate.countDocuments(query);
    const associates = await ForeignAssociate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      associates,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET single foreign associate
router.get("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const associate = await ForeignAssociate.findById(req.params.id);
    if (!associate) return res.status(404).json({ message: "Not found" });
    res.json(associate);
  } catch (err) {
    next(err);
  }
});

// CREATE foreign associate
router.post("/", auth, checkPermission, async (req, res, next) => {
  try {
    const {
      firm_name,
      country,
      city,
      contact_person,
      email,
      phone,
      reference_format,
      notes,
      status,
    } = req.body;

    if (!firm_name || !country) {
      return res
        .status(400)
        .json({ message: "Firm name and country are required" });
    }

    const associate = await ForeignAssociate.create({
      firm_name,
      country,
      city,
      contact_person,
      email,
      phone,
      reference_format,
      notes,
      status,
    });

    res
      .status(201)
      .json({ message: "Foreign associate created", data: associate });
  } catch (err) {
    next(err);
  }
});

// UPDATE foreign associate
router.put("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    const associate = await ForeignAssociate.findById(req.params.id);
    if (!associate) return res.status(404).json({ message: "Not found" });

    const fields = [
      "firm_name",
      "country",
      "city",
      "contact_person",
      "email",
      "phone",
      "reference_format",
      "notes",
      "status",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) associate[f] = req.body[f];
    });

    await associate.save();
    res.json({ message: "Updated", data: associate });
  } catch (err) {
    next(err);
  }
});

// DELETE foreign associate
router.delete("/:id", auth, checkPermission, async (req, res, next) => {
  try {
    await ForeignAssociate.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

router.post("/bulk-import", auth, checkPermission, async (req, res, next) => {
  try {
    const { associates } = req.body;
    if (!Array.isArray(associates) || associates.length === 0) {
      return res.status(400).json({ message: "Associates data required" });
    }

    let imported = 0,
      failed = 0;
    const errors = [];

    for (let i = 0; i < associates.length; i++) {
      const row = associates[i];
      try {
        if (!row.firm_name || !row.country)
          throw new Error("firm_name and country are required");
        await ForeignAssociate.create(row);
        imported++;
      } catch (err) {
        failed++;
        errors.push({
          row: i + 2,
          firm_name: row.firm_name || "N/A",
          error: err.message,
        });
      }
    }

    res.json({ message: "Import complete", imported, failed, errors });
  } catch (err) {
    next(err);
  }
});

export default router;
