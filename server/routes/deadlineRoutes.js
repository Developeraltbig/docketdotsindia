// routes/deadlineRoutes.js
import express from "express";
import mongoose from "mongoose";
import Deadline from "../models/Deadline.js";
import Docket from "../models/Docket.js";
import auth from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";
import checkPermission from "../middleware/checkPermission.js";
import { sendDeadlineReminder } from "../utils/emailService.js";
import { checkAndSendReminders } from "../jobs/deadlineReminderCron.js";
const router = express.Router();
const getUserMeta = (req) => ({
  userId: req.user?._id || req.user?.id || null,
  userName: req.user?.name || req.user?.email || "System",
});

router.post("/test-email/:id", auth, checkPermission, async (req, res) => {
  try {
    const deadline = await Deadline.findById(req.params.id).populate(
      "docket_id",
      "docket_no title",
    );

    if (!deadline) {
      return res.status(404).json({
        status: "error",
        message: "Deadline not found",
      });
    }

    // 1. Get the array (default to empty if undefined)
    const rawEmails = deadline.emails || [];

    // 2. Filter out nulls, undefined, and empty strings (including whitespace)
    const validEmails = rawEmails.filter(
      (email) => email && email.trim() !== "",
    );

    // 3. Check if any valid emails remain
    if (validEmails.length === 0) {
      return res.status(400).json({
        status: "error",
        message:
          "No valid email addresses configured. Please edit the deadline to add an email.",
      });
    }

    // 4. Temporarily update the object in memory so the helper function uses the clean list
    // (We are not calling deadline.save(), so this doesn't change the DB, just this request)
    deadline.emails = validEmails;

    // --- UPDATED VALIDATION LOGIC END ---

    // Send test email for remainder 1
    const result = await sendDeadlineReminder(deadline, 1);

    if (result.success) {
      res.json({
        status: "success",
        message: `Test email sent to ${deadline.emails.join(", ")}`,
        messageId: result.messageId,
      });
    } else {
      res.status(500).json({
        status: "error",
        message: "Failed to send email",
        error: result.error,
      });
    }
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// @route   POST /api/deadlines/send-all-reminders
// @desc    Manually trigger reminder check (admin only)
router.post("/send-all-reminders", auth, checkPermission, async (req, res) => {
  try {
    // Run the cron job function manually
    await checkAndSendReminders();

    res.json({
      status: "success",
      message: "Reminder check completed. Check server logs for details.",
    });
  } catch (err) {
    console.error("Manual reminder trigger error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// @route   GET /api/deadlines/upcoming-reminders
// @desc    Get all upcoming reminders for the next 7 days
router.get("/upcoming-reminders", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const deadlines = await Deadline.find({
      status: { $in: ["ON", "PENDING"] },
      deadline_date: { $gte: today },
    }).populate("docket_id", "docket_no title");

    const upcomingReminders = [];

    deadlines.forEach((deadline) => {
      for (let i = 1; i <= 6; i++) {
        const remainderDate = deadline[`remainder${i}`];

        if (remainderDate) {
          const reminderDay = new Date(remainderDate);
          reminderDay.setHours(0, 0, 0, 0);

          if (reminderDay >= today && reminderDay <= sevenDaysLater) {
            upcomingReminders.push({
              deadline_id: deadline._id,
              docket_number: deadline.docket_id?.docket_no || "N/A",
              application_no: deadline.application_no,
              worktype: deadline.worktype,
              deadline_date: deadline.deadline_date,
              reminder_number: i,
              reminder_date: remainderDate,
              emails: deadline.emails,
              days_until_reminder: Math.ceil(
                (reminderDay - today) / (1000 * 60 * 60 * 24),
              ),
            });
          }
        }
      }
    });

    // Sort by reminder date
    upcomingReminders.sort(
      (a, b) => new Date(a.reminder_date) - new Date(b.reminder_date),
    );

    res.json({
      status: "success",
      count: upcomingReminders.length,
      reminders: upcomingReminders,
    });
  } catch (err) {
    console.error("Fetching upcoming reminders error:", err);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// @route   GET /api/deadlines/lookup-docket/:query
// @desc    Autocomplete search for docket numbers (returns _id for reference)
router.get("/lookup-docket/:query", auth, checkPermission, async (req, res) => {
  try {
    const query = req.params.query;
    const dockets = await Docket.find({
      docket_no: { $regex: query, $options: "i" },
    })
      .limit(10)
      .select(
        "_id docket_no application_no title service_name applicant_type officialfee anovipfee associatefee currency",
      );

    res.json(dockets);
  } catch (err) {
    console.error("Docket Fetching error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/deadlines/export/excel
// @desc    Export deadlines to Excel (returns JSON for client-side export)
router.get("/export/excel", auth, checkPermission, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      docket_number,
      docket_id,
      application_no,
      worktype,
      deadline_date,
      selected_field,
      dynamic_search,
    } = req.query;

    let query = {};

    // Apply same filters as main listing
    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    if (docket_id && mongoose.Types.ObjectId.isValid(docket_id)) {
      query.docket_id = docket_id;
    }

    if (docket_number) {
      query.docket_number = { $regex: docket_number, $options: "i" };
    }

    if (application_no) {
      query.application_no = { $regex: application_no, $options: "i" };
    }

    if (worktype) {
      query.worktype = { $regex: worktype, $options: "i" };
    }

    if (deadline_date) {
      const deadlineStart = new Date(deadline_date);
      const deadlineEnd = new Date(deadline_date);
      deadlineEnd.setHours(23, 59, 59, 999);
      query.deadline_date = { $gte: deadlineStart, $lte: deadlineEnd };
    }

    if (selected_field && dynamic_search) {
      if (
        selected_field === "docket_id" &&
        mongoose.Types.ObjectId.isValid(dynamic_search)
      ) {
        query.docket_id = dynamic_search;
      } else {
        query[selected_field] = { $regex: dynamic_search, $options: "i" };
      }
    }

    const deadlines = await Deadline.find(query)
      .populate("docket_id", "docket_no application_no title")
      .sort({ createdAt: -1 });

    // Transform for export
    const transformedDeadlines = deadlines.map((d) => {
      const obj = d.toObject();
      if (obj.docket_id && typeof obj.docket_id === "object") {
        obj.docket = obj.docket_id;
        obj.docket_number = obj.docket_number || obj.docket_id.docket_no;
      }
      return obj;
    });

    res.json(transformedDeadlines);
  } catch (err) {
    console.error("Exporting Deadline error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/deadlines/bulk-import
// @desc    Bulk import deadlines from Excel
router.post("/bulk-import", auth, checkPermission, async (req, res) => {
  try {
    const { deadlines } = req.body;

    if (!deadlines || !Array.isArray(deadlines) || deadlines.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid data format. Expected array of deadlines.",
      });
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < deadlines.length; i++) {
      const deadline = deadlines[i];
      const rowNum = i + 2; // Excel row number (1-indexed + header)

      try {
        // Validate required fields
        if (!deadline.docket_number) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            docket_number: deadline.docket_number || "N/A",
            error: "Docket Number is required",
          });
          continue;
        }

        if (!deadline.deadline_date) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            docket_number: deadline.docket_number,
            error: "Deadline Date is required",
          });
          continue;
        }

        // Look up docket by docket_number to get docket_id
        const docket = await Docket.findOne({
          docket_no: { $regex: `^${deadline.docket_number}$`, $options: "i" },
        });

        if (!docket) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            docket_number: deadline.docket_number,
            error: "Docket not found in database",
          });
          continue;
        }

        // Calculate remainders if not provided
        let remainders = {};
        if (deadline.deadline_date && !deadline.remainder1) {
          remainders = calculateRemainders(deadline.deadline_date);
        }

        // Create new deadline
        const newDeadline = new Deadline({
          docket_id: docket._id,
          docket_number: docket.docket_no,
          application_no:
            deadline.application_no || docket.application_no || "",
          app_number: deadline.app_number || "",
          worktype: deadline.worktype || "",
          deadline_date: new Date(deadline.deadline_date),
          status: deadline.status || "ON",
          remarks: deadline.remarks || "",
          emails: Array.isArray(deadline.emails)
            ? deadline.emails.filter((e) => e && e.trim())
            : [],
          remainder1: deadline.remainder1 || remainders.remainder1 || null,
          remainder2: deadline.remainder2 || remainders.remainder2 || null,
          remainder3: deadline.remainder3 || remainders.remainder3 || null,
          remainder4: deadline.remainder4 || remainders.remainder4 || null,
          remainder5: deadline.remainder5 || remainders.remainder5 || null,
          remainder6: deadline.remainder6 || remainders.remainder6 || null,
          insertby: req.user?.email || "bulk-import",
        });

        await newDeadline.save();
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          docket_number: deadline.docket_number || "N/A",
          error: err.message,
        });
      }
    }

    // Return appropriate status based on results
    const statusCode = results.imported > 0 ? 200 : 400;
    const status = results.imported > 0 ? "success" : "error";

    res.status(statusCode).json({
      status,
      message: `Imported ${results.imported} of ${deadlines.length} records`,
      imported: results.imported,
      failed: results.failed,
      total: deadlines.length,
      errors: results.errors.slice(0, 50), // Limit errors to first 50
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({
      status: "error",
      message: "Bulk import failed: " + err.message,
    });
  }
});

// Helper function to calculate remainder dates
function calculateRemainders(deadlineDateStr) {
  if (!deadlineDateStr) return {};

  const deadlineDate = new Date(deadlineDateStr);
  const today = new Date();
  const timeDiff = deadlineDate.getTime() - today.getTime();
  const totalDays = Math.floor(timeDiff / (1000 * 3600 * 24));

  if (totalDays <= 0) return {};

  const remainder6 = new Date(deadlineDate);
  const remainder5 = new Date(remainder6);
  remainder5.setDate(remainder6.getDate() - 1);

  const remainder1 = new Date(today);
  remainder1.setDate(today.getDate() + Math.floor(totalDays / 2));

  const totalDaysBetween = Math.floor(
    (remainder6.getTime() - remainder1.getTime()) / (1000 * 3600 * 24),
  );
  const avgStep = Math.floor(totalDaysBetween / 4);

  const remainder2 = new Date(remainder1);
  remainder2.setDate(remainder1.getDate() + avgStep);

  const remainder3 = new Date(remainder2);
  remainder3.setDate(remainder2.getDate() + avgStep);

  const remainder4 = new Date(remainder3);
  remainder4.setDate(remainder3.getDate() + avgStep);

  const formatDate = (date) => date.toISOString().split("T")[0];

  return {
    remainder1: formatDate(remainder1),
    remainder2: formatDate(remainder2),
    remainder3: formatDate(remainder3),
    remainder4: formatDate(remainder4),
    remainder5: formatDate(remainder5),
    remainder6: formatDate(remainder6),
  };
}

// @route   GET /api/deadlines/stats
// @desc    Get dashboard statistics with specific breakdowns
router.get("/stats", auth, checkPermission, async (req, res) => {
  try {
    const now = new Date();

    // 1. Calculate Time Ranges

    // 72 Hours from now
    const next72Hours = new Date(now);
    next72Hours.setHours(now.getHours() + 72);

    // Start/End of Current Week (assuming Sunday start)
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Start/End of Current Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Define "Active" statuses (exclude Completed/OFF)
    const activeStatuses = ["ON", "PENDING"];

    // 2. Run Queries in Parallel
    const [due72Hours, thisWeek, thisMonth, overdue] = await Promise.all([
      // Due within 72 Hours (Active Only)
      Deadline.countDocuments({
        deadline_date: { $gte: now, $lte: next72Hours },
        status: { $in: activeStatuses },
      }),

      // This Week (Active Only)
      Deadline.countDocuments({
        deadline_date: { $gte: startOfWeek, $lte: endOfWeek },
        status: { $in: activeStatuses },
      }),

      // This Month (Active Only)
      Deadline.countDocuments({
        deadline_date: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $in: activeStatuses },
      }),

      // Overdue (Past date & Active)
      Deadline.countDocuments({
        deadline_date: { $lt: now },
        status: { $in: activeStatuses },
      }),
    ]);

    // 3. Return mapped keys matching frontend state
    res.json({
      Due_within_72_Hours: due72Hours,
      This_Week: thisWeek,
      This_Month: thisMonth,
      Overdue: overdue,
    });
  } catch (err) {
    console.error("Fetching Stats error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/deadlines/by-docket/:docketId
// @desc    Get all deadlines for a specific docket
router.get("/by-docket/:docketId", auth, checkPermission, async (req, res) => {
  try {
    const { docketId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(docketId)) {
      return res.status(400).json({ message: "Invalid Docket ID format" });
    }

    const deadlines = await Deadline.find({ docket_id: docketId })
      .populate("docket_id", "docket_no application_no title")
      .sort({ deadline_date: 1 });

    res.json(deadlines);
  } catch (err) {
    console.error("Fetching deadlines by docket error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/deadlines
// @desc    Create a new deadline
// @route   POST /api/deadlines
// @desc    Create a new deadline
router.post("/", auth, checkPermission, async (req, res) => {
  try {
    const { docket_id, docket_number, ...rest } = req.body;

    // 1. Basic Validation
    if (!docket_id) {
      return res
        .status(400)
        .json({ status: "error", message: "Docket ID is required" });
    }
    if (!rest.deadline_date) {
      return res
        .status(400)
        .json({ status: "error", message: "Deadline date is required" });
    }

    // 2. Verify docket exists to get the docket number
    const docketExists = await Docket.findById(docket_id);
    if (!docketExists) {
      return res.status(400).json({
        status: "error",
        message: "Invalid Docket ID. Docket not found.",
      });
    }

    // 3. Create and Save
    const newDeadline = new Deadline({
      ...rest,
      docket_id,
      docket_number: docket_number || docketExists.docket_no,
    });

    const savedDeadline = await newDeadline.save();
    const { userId, userName } = getUserMeta(req);
    // 4. Fetch populated record for the response
    const populatedDeadline = await Deadline.findById(
      savedDeadline._id,
    ).populate("docket_id", "docket_no application_no title");

    // 5. Transform for backward compatibility (root level docket_number)
    const obj = populatedDeadline.toObject();
    if (obj.docket_id && typeof obj.docket_id === "object") {
      obj.docket = obj.docket_id;
      obj.docket_number = obj.docket_number || obj.docket_id.docket_no;
    }
    await logActivity({
      type: "deadline_created",
      // Use 'savedDeadline' instead of 'deadline'
      description: `Deadline set for ${savedDeadline.docket_number} — ${savedDeadline.worktype}`,
      userId,
      userName,
      entityId: savedDeadline._id,
      entityType: "deadline",
      metadata: {
        docket_number: savedDeadline.docket_number,
        deadline_date: savedDeadline.deadline_date,
        worktype: savedDeadline.worktype,
      },
    });
    res.status(201).json({
      status: "success",
      message: "Deadline Created Successfully",
      data: obj,
    });
  } catch (err) {
    console.error("Creating Deadline error:", err);
    res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
});

// @route   GET /api/deadlines
// @desc    Get all deadlines with filters and pagination
// @route   GET /api/deadlines
// @desc    Get all deadlines with filters (Fixes Docket/App ID referencing)

// @route   GET /api/deadlines
// @desc    Get all deadlines with filters
router.get("/", auth, checkPermission, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      docket_number,
      docket_id,
      application_no,
      application_status,
      worktype,
      deadline_date,
      // specific dynamic fields from frontend dropdown
      emails,
      status,
      insertby,
      remainder1,
      remainder2,
      remainder3,
      remainder4,
      remainder5,
      remainder6,
      page = 1,
      limit = 10,
      sortBy = "deadline_date",
      sortOrder = "asc",
    } = req.query;

    let query = {};
    let andConditions = [];

    if (application_status) {
      const matchingDockets = await Docket.find({
        application_status: application_status,
      }).select("_id");

      const docketIds = matchingDockets.map((d) => d._id);

      // Only add the condition if we found dockets, otherwise the query should return nothing
      andConditions.push({ docket_id: { $in: docketIds } });
    }
    // --- 1. DOCKET NUMBER ---
    if (docket_number) {
      const matchingDockets = await Docket.find({
        docket_no: { $regex: docket_number, $options: "i" },
      }).select("_id");
      const docketIds = matchingDockets.map((d) => d._id);
      andConditions.push({
        $or: [
          { docket_id: { $in: docketIds } },
          { docket_number: { $regex: docket_number, $options: "i" } },
        ],
      });
    }

    // --- 2. APPLICATION NUMBER ---
    if (application_no) {
      const matchingDockets = await Docket.find({
        application_no: { $regex: application_no, $options: "i" },
      }).select("_id");
      const docketIds = matchingDockets.map((d) => d._id);
      andConditions.push({
        $or: [
          { docket_id: { $in: docketIds } },
          { application_no: { $regex: application_no, $options: "i" } },
        ],
      });
    }

    // --- 3. STANDARD FILTERS ---
    if (worktype) query.worktype = { $regex: worktype, $options: "i" };

    // Docket ID exact match
    if (docket_id && mongoose.Types.ObjectId.isValid(docket_id)) {
      query.docket_id = docket_id;
    }

    // --- 4. DATE RANGES ---
    // Start/End Range
    if (start_date || end_date) {
      query.deadline_date = {};
      if (start_date) query.deadline_date.$gte = new Date(start_date);
      if (end_date) {
        const endDateObj = new Date(end_date);
        endDateObj.setHours(23, 59, 59, 999);
        query.deadline_date.$lte = endDateObj;
      }
    }

    // Exact Deadline Date
    if (deadline_date) {
      const dStart = new Date(deadline_date);
      const dEnd = new Date(deadline_date);
      dEnd.setHours(23, 59, 59, 999);
      query.deadline_date = { $gte: dStart, $lte: dEnd };
    }

    // --- 5. DYNAMIC FIELDS (Emails, Status, InsertBy) ---

    // ✅ Emails (Array of strings) - Regex works directly
    if (emails) {
      query.emails = { $regex: emails, $options: "i" };
    }

    // ✅ Status
    if (status) {
      // Use regex for flexible search, or exact match if preferred
      query.status = { $regex: status, $options: "i" };
    }

    // ✅ Insert By
    if (insertby) {
      query.insertby = { $regex: insertby, $options: "i" };
    }

    // --- 6. REMAINDER DATES ---
    // Helper to add date range for specific day
    const addDateFilter = (field, value) => {
      if (!value) return;
      const dStart = new Date(value);
      if (!isNaN(dStart.getTime())) {
        const dEnd = new Date(value);
        dEnd.setHours(23, 59, 59, 999);
        query[field] = { $gte: dStart, $lte: dEnd };
      }
    };

    addDateFilter("remainder1", remainder1);
    addDateFilter("remainder2", remainder2);
    addDateFilter("remainder3", remainder3);
    addDateFilter("remainder4", remainder4);
    addDateFilter("remainder5", remainder5);
    addDateFilter("remainder6", remainder6);

    // --- COMBINE CONDITIONS ---
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }
    const sortOptions = {};
    if (sortBy) {
      // Convert 'asc'/'desc' string to 1/-1
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
    } else {
      // Default fallback
      sortOptions.deadline_date = 1;
    }
    // --- EXECUTE QUERY ---
    const skip = (Number(page) - 1) * Number(limit);

    const deadlines = await Deadline.find(query)
      .populate(
        "docket_id",
        "docket_no application_no title application_status",
      )
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(skip);

    const total = await Deadline.countDocuments(query);

    // Transform for frontend
    const transformedDeadlines = deadlines.map((d) => {
      const obj = d.toObject();
      if (obj.docket_id && typeof obj.docket_id === "object") {
        obj.docket = obj.docket_id;
        obj.docket_number = obj.docket_number || obj.docket_id.docket_no;
        obj.application_no = obj.application_no || obj.docket_id.application_no;
      }
      return obj;
    });

    res.json({
      deadlines: transformedDeadlines,
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    console.error("Fetching Deadline error:", err);
    res.status(500).json({ message: err.message });
  }
});
// @route   GET /api/deadlines/:id
// @desc    Get single deadline by ID
router.get("/:id", auth, checkPermission, checkPermission, async (req, res) => {
  try {
    const deadline = await Deadline.findById(req.params.id).populate(
      "docket_id",
      "docket_no application_no title",
    );

    if (!deadline) {
      return res.status(404).json({ message: "Deadline not found" });
    }

    // Transform response
    const obj = deadline.toObject();
    if (obj.docket_id && typeof obj.docket_id === "object") {
      obj.docket = obj.docket_id;
      obj.docket_number = obj.docket_number || obj.docket_id.docket_no;
    }

    res.json(obj);
  } catch (err) {
    console.error("Fetching Deadline error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/deadlines/:id
// @desc    Update a deadline
router.put("/:id", auth, checkPermission, checkPermission, async (req, res) => {
  try {
    const { docket_id, docket_number, ...rest } = req.body;

    // If docket_id is being updated, validate it
    if (docket_id) {
      if (!mongoose.Types.ObjectId.isValid(docket_id)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid Docket ID format",
        });
      }

      const docketExists = await Docket.findById(docket_id);
      if (!docketExists) {
        return res.status(400).json({
          status: "error",
          message: "Invalid Docket ID. Docket not found.",
        });
      }
    }

    const updateData = {
      ...rest,
      updatedAt: new Date(),
    };

    // Only update docket_id if provided
    if (docket_id) {
      updateData.docket_id = docket_id;
      // Update docket_number if provided, otherwise fetch from docket
      if (docket_number) {
        updateData.docket_number = docket_number;
      } else {
        const docket = await Docket.findById(docket_id);
        if (docket) {
          updateData.docket_number = docket.docket_no;
        }
      }
    }

    const updatedDeadline = await Deadline.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    ).populate("docket_id", "docket_no application_no title");

    if (!updatedDeadline) {
      return res.status(404).json({
        status: "error",
        message: "Deadline not found",
      });
    }
    const { userId, userName } = getUserMeta(req);
    // Transform response
    const obj = updatedDeadline.toObject();
    if (obj.docket_id && typeof obj.docket_id === "object") {
      obj.docket = obj.docket_id;
      obj.docket_number = obj.docket_number || obj.docket_id.docket_no;
    }
    await logActivity({
      type: "deadline_updated",
      // Use 'updatedDeadline' instead of 'deadline'
      description: `Deadline reminder R3/6 sent for ${updatedDeadline.docket_number}`,
      userId,
      userName,
      entityId: updatedDeadline._id,
      entityType: "deadline",
    });
    res.json({
      status: "success",
      message: "Deadline Updated Successfully",
      data: obj,
    });
  } catch (err) {
    console.error("Updating Deadline error:", err);
    res.status(400).json({
      status: "error",
      message: err.message,
    });
  }
});

// @route   DELETE /api/deadlines/:id
// @desc    Delete a deadline
router.delete(
  "/:id",
  auth,
  checkPermission,
  checkPermission,
  async (req, res) => {
    try {
      const deletedDeadline = await Deadline.findByIdAndDelete(req.params.id);

      if (!deletedDeadline) {
        return res.status(404).json({
          status: "error",
          message: "Deadline not found",
        });
      }

      res.json({
        status: "success",
        message: "Deadline Deleted Successfully",
      });
    } catch (err) {
      console.error("Deleting Deadline error:", err);
      res.status(500).json({
        status: "error",
        message: err.message,
      });
    }
  },
);

export default router;
