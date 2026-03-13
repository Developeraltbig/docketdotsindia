// routes/dashboardRoutes.js
import express from "express";
import mongoose from "mongoose";
import Docket from "../models/Docket.js";
import Task from "../models/Task.js";
import Deadline from "../models/Deadline.js";
import Invoice from "../models/Invoice.js";
import Activity from "../models/Activity.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/stats
// Returns all top-card numbers in one shot
// ─────────────────────────────────────────────────────────────
router.get("/stats", auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(startOfToday.getTime() + 86400000);
    const in72h = new Date(now.getTime() + 72 * 3600000);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      docketTotal,
      docketInProcess,
      docketGranted,
      docketInactive,
      docketFiled,
    ] = await Promise.all([
      Docket.countDocuments(),
      Docket.countDocuments({
        application_status: { $nin: ["Filed", "Granted", "Inactive"] },
      }),
      Docket.countDocuments({ application_status: "Granted" }),
      Docket.countDocuments({ application_status: "Inactive" }),
      Docket.countDocuments({ application_status: "Filed" }),
    ]);

    // ── Deadlines ──
    const [dlWithin72h, dlThisWeek, dlThisMonth, dlOverdue] = await Promise.all(
      [
        Deadline.countDocuments({
          deadline_date: { $gte: now, $lte: in72h },
          status: "ON",
        }),
        Deadline.countDocuments({
          deadline_date: { $gte: startOfWeek, $lte: endOfWeek },
          status: "ON",
        }),
        Deadline.countDocuments({
          deadline_date: { $gte: startOfMonth, $lte: endOfMonth },
          status: "ON",
        }),
        Deadline.countDocuments({ deadline_date: { $lt: now }, status: "ON" }),
      ],
    );

    // ── Tasks ──
    const [taskOverdue, taskDueToday, taskInProgress, taskCompleted] =
      await Promise.all([
        Task.countDocuments({
          official_deadline: { $lt: startOfToday },
          task_status: { $nin: ["Completed"] },
        }),
        Task.countDocuments({
          official_deadline: { $gte: startOfToday, $lt: endOfToday },
        }),
        Task.countDocuments({ task_status: "In Progress" }),
        Task.countDocuments({
          task_status: "Completed",
          updatedAt: { $gte: startOfToday, $lt: endOfToday },
        }),
      ]);

    // ── Invoices ──
    const [invDraft, invSent, invPaid, invOverdue] = await Promise.all([
      Invoice.countDocuments({ status: "Draft" }),
      Invoice.countDocuments({ status: "Sent" }),
      Invoice.countDocuments({ status: "Paid" }),
      Invoice.countDocuments({ status: "Overdue" }),
    ]);

    res.json({
      dockets: {
        total: docketTotal,
        inProcess: docketInProcess,
        granted: docketGranted,
        inactive: docketInactive,
        filed: docketFiled,
      },
      deadlines: {
        within72h: dlWithin72h,
        thisWeek: dlThisWeek,
        thisMonth: dlThisMonth,
        overdue: dlOverdue,
      },
      tasks: {
        overdue: taskOverdue,
        dueToday: taskDueToday,
        inProgress: taskInProgress,
        completed: taskCompleted,
      },
      invoices: {
        draft: invDraft,
        sent: invSent,
        paid: invPaid,
        overdue: invOverdue,
      },
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Error fetching dashboard stats" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/filings-chart
// Returns monthly filed vs granted counts for last 12 months
// ─────────────────────────────────────────────────────────────
router.get("/filings-chart", auth, async (req, res) => {
  try {
    const now = new Date();
    const months = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(), // 0-indexed
        label: d.toLocaleString("default", { month: "short" }),
      });
    }

    const filedAgg = await Docket.aggregate([
      {
        $match: {
          filling_date: { $gte: new Date(months[0].year, months[0].month, 1) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$filling_date" },
            month: { $subtract: [{ $month: "$filling_date" }, 1] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const grantedAgg = await Docket.aggregate([
      {
        $match: {
          application_status: "Granted",
          updatedAt: { $gte: new Date(months[0].year, months[0].month, 1) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $subtract: [{ $month: "$updatedAt" }, 1] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const filedMap = {};
    filedAgg.forEach((a) => {
      filedMap[`${a._id.year}-${a._id.month}`] = a.count;
    });

    const grantedMap = {};
    grantedAgg.forEach((a) => {
      grantedMap[`${a._id.year}-${a._id.month}`] = a.count;
    });

    const result = months.map((m) => ({
      month: m.label,
      filed: filedMap[`${m.year}-${m.month}`] || 0,
      granted: grantedMap[`${m.year}-${m.month}`] || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error("Filings chart error:", err);
    res.status(500).json({ message: "Error fetching chart data" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/status-distribution
// Returns docket counts grouped by application_status
// ─────────────────────────────────────────────────────────────
router.get("/status-distribution", auth, async (req, res) => {
  try {
    const agg = await Docket.aggregate([
      { $group: { _id: "$application_status", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 6 },
    ]);

    const result = agg.map((a) => ({
      name: a._id || "Unknown",
      value: a.value,
    }));

    res.json(result);
  } catch (err) {
    console.error("Status distribution error:", err);
    res.status(500).json({ message: "Error fetching status distribution" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/urgent-actions
// Returns deadlines that are overdue or due within 7 days
// ─────────────────────────────────────────────────────────────
router.get("/urgent-actions", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const cutoff = new Date();
    const lookahead = new Date(cutoff.getTime() + 7 * 24 * 3600000);

    const filter = {
      status: "ON",
      deadline_date: { $lte: lookahead },
    };

    const [results, total] = await Promise.all([
      Deadline.find(filter)
        .populate("docket_id", "docket_no title application_no") // <--- Added Populate
        .sort({ deadline_date: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Deadline.countDocuments(filter),
    ]);

    // Transform data to ensure docket_number exists (handling .lean() objects)
    const records = results.map((doc) => {
      // Check if docket_id is populated and is an object
      if (doc.docket_id && typeof doc.docket_id === "object") {
        // Assign docket_number from the populated docket if it's missing at the root
        doc.docket_number = doc.docket_number || doc.docket_id.docket_no;
        doc.application_no = doc.application_no || doc.docket_id.application_no;
      }
      return doc;
    });

    res.json({ records, total });
  } catch (err) {
    console.error("Urgent actions error:", err);
    res.status(500).json({ message: "Error fetching urgent actions" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/recent-activity
// Returns paginated activity log
// ─────────────────────────────────────────────────────────────
router.get("/recent-activity", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Activity.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Activity.countDocuments(),
    ]);

    res.json({ records, total });
  } catch (err) {
    console.error("Recent activity error:", err);
    res.status(500).json({ message: "Error fetching activity" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/activity  (full list page)
// ─────────────────────────────────────────────────────────────
router.get("/activity", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Activity.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Activity.countDocuments(),
    ]);

    res.json({ records, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Error fetching activity log" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/urgent-actions/export
// Returns all urgent actions for Excel Export
// ─────────────────────────────────────────────────────────────
router.get("/urgent-actions/export", auth, async (req, res) => {
  try {
    const cutoff = new Date();
    const lookahead = new Date(cutoff.getTime() + 7 * 24 * 3600000);

    const filter = {
      status: "ON",
      deadline_date: { $lte: lookahead },
    };

    const results = await Deadline.find(filter)
      .populate("docket_id", "docket_no title application_no")
      .sort({ deadline_date: 1 })
      .lean();

    const records = results.map((doc) => {
      if (doc.docket_id && typeof doc.docket_id === "object") {
        doc.docket_number = doc.docket_number || doc.docket_id.docket_no;
        doc.application_no = doc.application_no || doc.docket_id.application_no;
      }
      return doc;
    });

    res.json(records);
  } catch (err) {
    console.error("Urgent actions export error:", err);
    res.status(500).json({ message: "Error exporting urgent actions" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/recent-activity/export
// Returns all recent activity for Excel Export
// ─────────────────────────────────────────────────────────────
router.get("/recent-activity/export", auth, async (req, res) => {
  try {
    const records = await Activity.find().sort({ createdAt: -1 }).lean();
    res.json(records);
  } catch (err) {
    console.error("Recent activity export error:", err);
    res.status(500).json({ message: "Error exporting activity" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/staff/recent-activity
// Returns paginated activity log ONLY for the logged-in user
// ─────────────────────────────────────────────────────────────
router.get("/staff/recent-activity", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Filter by logged-in user. (Adjust 'user_id' if your schema uses 'user' or 'done_by')
    const filter = { user_id: req.user.id };

    const [records, total] = await Promise.all([
      Activity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments(filter),
    ]);

    res.json({ records, total });
  } catch (err) {
    console.error("Staff recent activity error:", err);
    res.status(500).json({ message: "Error fetching activity" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/staff/recent-activity/export
// Returns all recent activity for the logged-in user for Excel Export
// ─────────────────────────────────────────────────────────────
router.get("/staff/recent-activity/export", auth, async (req, res) => {
  try {
    // Make sure 'user_id' matches the reference field in your Activity schema
    const filter = { user_id: req.user.id };
    const records = await Activity.find(filter).sort({ createdAt: -1 }).lean();
    res.json(records);
  } catch (err) {
    console.error("Staff recent activity export error:", err);
    res.status(500).json({ message: "Error exporting activity" });
  }
});

export default router;
