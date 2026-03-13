import express from "express";
import Application from "../models/Application.js";
import Docket from "../models/Docket.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

// @route   GET /api/applications/lookup-docket/:docketNo
// @desc    Used by the React form (onBlur) to auto-fill title/applicant info
router.get(
  "/lookup-docket/:docketNo",
  auth,
  checkPermission,
  async (req, res) => {
    try {
      const query = req.params.docketNo;
      const dockets = await Docket.find({
        docket_no: { $regex: query, $options: "i" },
      }).limit(10);
      res.json(dockets);
    } catch (err) {
      console.error("Lookup Docket error:", err);
      res.status(500).json({ message: err.message });
    }
  },
);

// @route   POST /api/applications
// @desc    Save the Master Form data
router.post("/", auth, checkPermission, async (req, res) => {
  try {
    const newApp = new Application({
      ...req.body,
      created_by: req.user._id || req.user.id,
      created_by_name: req.user.name || req.user.email,
    });

    if (!newApp.DOC_NO) {
      return res.status(400).json({ message: "Docket Number is required." });
    }

    const savedApp = await newApp.save();
    res.status(201).json({
      success: true,
      message: "Application Created",
      application: savedApp,
    });
  } catch (err) {
    console.error("Save Application error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/applications/:id
// @desc    Update an existing application
router.put("/:id", auth, checkPermission, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the application first to check if it exists
    const existingApp = await Application.findById(id);
    if (!existingApp) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Check if staff user is trying to edit someone else's application
    if (
      req.user.role === "staff" &&
      existingApp.created_by?.toString() !==
        (req.user._id || req.user.id).toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit applications created by you",
      });
    }

    // Update the application with new data
    const updatedApp = await Application.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updated_by: req.user._id || req.user.id,
        updated_by_name: req.user.name || req.user.email,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      },
    );

    res.json({
      success: true,
      message: "Application Updated Successfully",
      application: updatedApp,
    });
  } catch (err) {
    console.error("Update Application error:", err);
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID format",
      });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// @route   PATCH /api/applications/:id
// @desc    Partially update an application (update only specific fields)
router.patch("/:id", auth, checkPermission, async (req, res) => {
  try {
    const { id } = req.params;

    const existingApp = await Application.findById(id);
    if (!existingApp) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Check if staff user is trying to edit someone else's application
    if (
      req.user.role === "staff" &&
      existingApp.created_by?.toString() !==
        (req.user._id || req.user.id).toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only edit applications created by you",
      });
    }

    // Merge existing data with new data (partial update)
    const updatedApp = await Application.findByIdAndUpdate(
      id,
      {
        $set: {
          ...req.body,
          updated_by: req.user._id || req.user.id,
          updated_by_name: req.user.name || req.user.email,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    res.json({
      success: true,
      message: "Application Updated Successfully",
      application: updatedApp,
    });
  } catch (err) {
    console.error("Update Application Field error:", err);
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID format",
      });
    }
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// @route   DELETE /api/applications/:id
// @desc    Delete an application
router.delete("/:id", auth, checkPermission, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the application first
    const existingApp = await Application.findById(id);
    if (!existingApp) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Check if staff user is trying to delete someone else's application
    if (
      req.user.role === "staff" &&
      existingApp.created_by?.toString() !==
        (req.user._id || req.user.id).toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only delete applications created by you",
      });
    }

    const deletedApp = await Application.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Application Deleted Successfully",
      application: deletedApp,
    });
  } catch (err) {
    console.error("Delete Application error:", err);
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID format",
      });
    }
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// @route   GET /api/applications
// @desc    Fetch applications with pagination & filters (filtered by role)
router.get("/", auth, checkPermission, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      doc_number,
      appli_type,
      created_by,
      sortBy = "createdAt", // Add this
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    let query = {};

    // If user is staff, only show their own applications
    if (req.user.role === "staff") {
      query.created_by = req.user._id || req.user.id;
    } else if (created_by) {
      // For admin/other roles, allow filtering by created_by if provided
      query.created_by = created_by;
    }

    // Date range filter
    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) {
        // Set end_date to end of day
        const endOfDay = new Date(end_date);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endOfDay;
      }
    }

    // Docket number filter
    if (doc_number) {
      query.DOC_NO = { $regex: doc_number, $options: "i" };
    }

    // Application type filter
    if (appli_type) {
      query.application_type = { $regex: appli_type, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const apps = await Application.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(); // Use lean() for better performance

    const total = await Application.countDocuments(query);

    res.json({
      applications: apps,
      totalRecords: total,
      total: total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Get Application error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/applications/:id
// @desc    Get detailed view for the Detail Card
router.get("/:id", auth, checkPermission, async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Check if staff user is trying to view someone else's application
    if (
      req.user.role === "staff" &&
      app.created_by?.toString() !== (req.user._id || req.user.id).toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only view applications created by you",
      });
    }

    res.json(app);
  } catch (err) {
    console.error("Detailed View Application error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
