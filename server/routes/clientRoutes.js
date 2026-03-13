import express from "express";
import mongoose from "mongoose";
import Deadline from "../models/Deadline.js";
import Docket from "../models/Docket.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";

const router = express.Router();

// Helper function
function formatDate(dateStr) {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// @route   GET /api/client/stats
// @desc    Dashboard summary (Counts and Recent Data)
router.get("/stats", auth, checkPermission, async (req, res) => {
  try {
    const clientId = req.user._id;

    // 1. Get client's dockets first
    const clientDockets = await Docket.find({ client_id: clientId }).select(
      "_id"
    );
    const docketIds = clientDockets.map((d) => d._id);

    // 2. Calculate date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);
    const next3Days = new Date();
    next3Days.setDate(today.getDate() + 3);
    next3Days.setHours(23, 59, 59, 999);

    // 3. Parallel counts
    const [
      activeCount,
      overdueCount,
      dueThisWeekCount,
      dueTodayCount,
      totalDeadlines,
    ] = await Promise.all([
      // Active dockets (not closed/completed)
      Docket.countDocuments({
        client_id: clientId,
        status: { $nin: ["Closed", "Completed"] },
      }),
      // Overdue deadlines (past deadline_date but not completed)
      Deadline.countDocuments({
        docket_id: { $in: docketIds },
        deadline_date: { $lt: today },
        status: { $nin: ["COMPLETED", "OFF"] },
      }),
      // Due this week
      Deadline.countDocuments({
        docket_id: { $in: docketIds },
        deadline_date: { $gte: today, $lte: nextWeek },
        status: { $nin: ["COMPLETED", "OFF"] },
      }),
      // Due today
      Deadline.countDocuments({
        docket_id: { $in: docketIds },
        deadline_date: { $gte: today, $lte: endOfToday },
        status: { $nin: ["COMPLETED", "OFF"] },
      }),
      // Total deadlines
      Deadline.countDocuments({ docket_id: { $in: docketIds } }),
    ]);

    // 4. Get upcoming deadlines (Next 7 days)
    const upcomingDeadlines = await Deadline.find({
      docket_id: { $in: docketIds },
      deadline_date: { $gte: today, $lte: nextWeek },
      status: { $ne: "COMPLETED" },
    })
      .populate("docket_id", "docket_no title application_no client_ref")
      .sort({ deadline_date: 1 })
      .limit(5);

    // 4. Get recent dockets
    const recentDockets = await Docket.find({ client_id: clientId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      stats: {
        activeDockets: activeCount,
        deadlines: totalDeadlines,
        overdueDeadlines: overdueCount,
        dueThisWeek: dueThisWeekCount,
        dueToday: dueTodayCount,
      },
      upcomingDeadlines: upcomingDeadlines.map((d) => ({
        _id: d._id,
        title: d.worktype || "Action Required",
        reference: d.docket_id?.docket_no || "--",
        docketTitle: d.docket_id?.title || "--",
        date: formatDate(d.deadline_date),
        status: d.status,
      })),
      recentDockets,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/client/upcoming-deadlines
// @desc    Get upcoming deadlines for logged-in client's dockets
router.get("/upcoming-deadlines", auth, checkPermission, async (req, res) => {
  try {
    const clientId = req.user._id;

    // Get all Docket IDs belonging to this client
    const clientDockets = await Docket.find({ client_id: clientId }).select(
      "_id"
    );
    const docketIds = clientDockets.map((d) => d._id);

    // Calculate date range (This Week)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Find deadlines linked to those dockets
    const deadlines = await Deadline.find({
      docket_id: { $in: docketIds },
      deadline_date: { $gte: startOfWeek, $lte: endOfWeek },
      status: { $ne: "COMPLETED" },
    })
      .populate("docket_id", "docket_no title application_no client_ref")
      .sort({ deadline_date: 1 });

    // Format for Frontend
    const formatted = deadlines.map((d) => ({
      _id: d._id,
      title: d.worktype || "Action Required",
      reference: d.docket_id?.docket_no || "--",
      docketTitle: d.docket_id?.title || "--",
      applicationNo: d.docket_id?.application_no || "--",
      date: formatDate(d.deadline_date),
      status: d.status,
      type: "deadline",
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Upcoming deadlines error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/client
// @desc    Get all dockets for client with filters and pagination
router.get("/", auth, checkPermission, async (req, res) => {
  try {
    const clientId = req.user._id;
    const {
      search,
      status,
      application_status,
      start_date,
      end_date,
      page = 1,
      limit = 10,
    } = req.query;

    let query = { client_id: clientId };

    // Search filter (docket_no, title, application_no)
    if (search) {
      query.$or = [
        { docket_no: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { application_no: { $regex: search, $options: "i" } },
        { client_ref: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Application status filter
    if (application_status) {
      query.application_status = application_status;
    }

    // Date range filter
    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [dockets, total] = await Promise.all([
      Docket.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip),
      Docket.countDocuments(query),
    ]);

    res.json({
      dockets,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    console.error("Fetching client dockets error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/client/docket/:id
// @desc    Get single docket with all its deadlines
router.get("/docket/:id", auth, checkPermission, async (req, res) => {
  try {
    const clientId = req.user._id;
    const docketId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(docketId)) {
      return res.status(400).json({ message: "Invalid Docket ID" });
    }

    // Get docket (verify it belongs to client)
    const docket = await Docket.findOne({
      _id: docketId,
      client_id: clientId,
    });

    if (!docket) {
      return res.status(404).json({ message: "Docket not found" });
    }

    // Get all deadlines for this docket
    const deadlines = await Deadline.find({ docket_id: docketId }).sort({
      deadline_date: 1,
    });

    res.json({
      docket,
      deadlines,
    });
  } catch (err) {
    console.error("Fetching docket details error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/client/deadlines
// @desc    Get all deadlines for client with filters and pagination
router.get("/deadlines", auth, checkPermission, async (req, res) => {
  try {
    const clientId = req.user._id;
    const {
      search,
      status,
      worktype,
      start_date,
      end_date,
      page = 1,
      limit = 10,
    } = req.query;

    // Get client's docket IDs
    const clientDockets = await Docket.find({ client_id: clientId }).select(
      "_id"
    );
    const docketIds = clientDockets.map((d) => d._id);

    let query = { docket_id: { $in: docketIds } };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Worktype filter
    if (worktype) {
      query.worktype = { $regex: worktype, $options: "i" };
    }

    // Date range filter for deadline_date
    if (start_date || end_date) {
      query.deadline_date = {};
      if (start_date) query.deadline_date.$gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.deadline_date.$lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [deadlines, total] = await Promise.all([
      Deadline.find(query)
        .populate("docket_id", "docket_no title application_no client_ref")
        .sort({ deadline_date: 1 })
        .limit(Number(limit))
        .skip(skip),
      Deadline.countDocuments(query),
    ]);

    // If search is provided, filter by populated docket fields
    let filteredDeadlines = deadlines;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredDeadlines = deadlines.filter((d) => {
        const docketNo = d.docket_id?.docket_no?.toLowerCase() || "";
        const title = d.docket_id?.title?.toLowerCase() || "";
        const appNo = d.docket_id?.application_no?.toLowerCase() || "";
        const workType = d.worktype?.toLowerCase() || "";
        return (
          docketNo.includes(searchLower) ||
          title.includes(searchLower) ||
          appNo.includes(searchLower) ||
          workType.includes(searchLower)
        );
      });
    }

    res.json({
      deadlines: filteredDeadlines,
      total: search ? filteredDeadlines.length : total,
      totalPages: Math.ceil(
        (search ? filteredDeadlines.length : total) / limit
      ),
      currentPage: Number(page),
    });
  } catch (err) {
    console.error("Fetching client deadlines error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/client/deadline/:id
// @desc    Get single deadline with docket details
router.get("/deadline/:id", auth, checkPermission, async (req, res) => {
  try {
    const clientId = req.user._id;
    const deadlineId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(deadlineId)) {
      return res.status(400).json({ message: "Invalid Deadline ID" });
    }

    const deadline = await Deadline.findById(deadlineId).populate("docket_id");

    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Verify deadline belongs to client's docket
    if (deadline.docket_id?.client_id?.toString() !== clientId.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(deadline);
  } catch (err) {
    console.error("Fetching deadline details error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
