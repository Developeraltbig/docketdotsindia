import express from "express";
import Task from "../models/Task.js";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Application from "../models/Application.js";
import mongoose from "mongoose";
import { logActivity } from "../utils/activityLogger.js";
import { emitTaskUpdated } from "../socket.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

const getUserMeta = (req) => ({
  userId: req.user?._id || req.user?.id || null,
  userName: req.user?.name || req.user?.email || "System",
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// ============================================
// S3 SIGNING ROUTES (For Uppy)
// ============================================

// Start Multipart Upload
router.post("/s3/multipart/start", auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const key = `tasks/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    const response = await s3Client.send(command);
    res.json({ uploadId: response.UploadId, key });
  } catch (err) {
    console.error("S3 Start Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Sign Part
router.post("/s3/multipart/sign-part", auth, async (req, res) => {
  try {
    const { uploadId, key, partNumber } = req.body;
    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Complete Multipart Upload
router.post("/s3/multipart/complete", auth, async (req, res) => {
  try {
    const { uploadId, key, parts } = req.body;
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    const response = await s3Client.send(command);
    res.json({ location: response.Location, key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Abort Multipart Upload
router.post("/s3/multipart/abort", auth, async (req, res) => {
  try {
    const { uploadId, key } = req.body;
    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    });
    await s3Client.send(command);
    res.json({ message: "Upload aborted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Presigned URL (Simple Upload)
router.post("/s3/presigned-url", auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const key = `tasks/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ChecksumAlgorithm: undefined,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });
    res.json({ uploadUrl, key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Download/View URL
router.get("/download-url", auth, async (req, res) => {
  try {
    const { fileKey } = req.query;
    if (!fileKey) return res.status(400).json({ message: "Key required" });

    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey }),
      );
    } catch (error) {
      return res.status(404).json({ message: "File not found or deleted" });
    }

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });
    res.json({ downloadUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET task status counts
router.get("/status-counts", auth, checkPermission, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdue = await Task.countDocuments({
      internal_deadline: { $lt: today },
      task_status: { $nin: ["Completed", "Cancelled"] },
    });

    const dueToday = await Task.countDocuments({
      internal_deadline: { $gte: today, $lt: tomorrow },
      task_status: { $nin: ["Completed", "Cancelled"] },
    });

    const inProgress = await Task.countDocuments({
      task_status: "In Progress",
    });

    const completedToday = await Task.countDocuments({
      task_status: "Completed",
      updatedAt: { $gte: today, $lt: tomorrow },
    });

    res.json({ overdue, dueToday, inProgress, completedToday });
  } catch (err) {
    console.error("Error fetching task stats:", err);
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// ============================================
// STAFF SPECIFIC ROUTES
// ============================================

// GET staff dashboard stats
router.get("/staff/stats", auth, checkPermission, async (req, res) => {
  try {
    const userId = req.user._id;

    const myWorkCount = await Task.countDocuments({
      $or: [
        { prepared_by: userId },
        { review_by: userId },
        { final_review_by: userId },
      ],
    });

    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const deadlinesCount = await Task.countDocuments({
      $or: [
        { prepared_by: userId },
        { review_by: userId },
        { final_review_by: userId },
      ],
      internal_deadline: { $gte: today, $lte: nextWeek },
      task_status: { $nin: ["Completed", "Cancelled"] },
    });

    const applicationCount = await Application.countDocuments({
      created_by: userId,
    });

    res.json({
      myWork: myWorkCount,
      deadlines: deadlinesCount,
      application: applicationCount,
    });
  } catch (err) {
    console.error("Error fetching staff stats:", err);
    res
      .status(500)
      .json({ message: "Error fetching stats", error: err.message });
  }
});

// GET staff tasks with filter
router.get("/staff/tasks", auth, checkPermission, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, filter = "prepare" } = req.query;

    let query = {};
    switch (filter.toLowerCase()) {
      case "prepare":
        query.prepared_by = userId;
        break;
      case "review":
        query.review_by = userId;
        break;
      case "final review":
      case "final_review":
      case "finalreview":
        query.final_review_by = userId;
        break;
      case "all":
      default:
        query.$or = [
          { prepared_by: userId },
          { review_by: userId },
          { final_review_by: userId },
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate("prepared_by", "name email")
        .populate("review_by", "name email")
        .populate("final_review_by", "name email")
        .populate("territory_manager", "name email")
        .populate("docket_id")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(query),
    ]);

    const formattedTasks = tasks.map((task) => ({
      _id: task._id,
      date: task.createdAt,
      tm: task.territory_manager?.name || "",
      anovip_reference: task.docket_no || "",
      client: task.client_name || "",
      worktype: task.work_type || "",
      deadline: task.internal_deadline,
      prepared: task.prepared_by?.name || "",
      review: task.review_by?.name || "",
      final_review: task.final_review_by?.name || "",
      status: task.task_status || "Pending",
      ...task.toObject(),
      prepared_by_name: task.prepared_by?.name || "",
      review_by_name: task.review_by?.name || "",
      final_review_by_name: task.final_review_by?.name || "",
    }));

    res.json({
      tasks: formattedTasks,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("Error fetching staff tasks:", err);
    res
      .status(500)
      .json({ message: "Error fetching tasks", error: err.message });
  }
});

// GET staff upcoming deadlines
router.get("/staff/deadlines", auth, checkPermission, async (req, res) => {
  try {
    const userId = req.user._id;
    const { days = 7 } = req.query;

    const today = new Date();
    const futureDate = new Date(
      today.getTime() + parseInt(days) * 24 * 60 * 60 * 1000,
    );

    const tasks = await Task.find({
      $or: [
        { prepared_by: userId },
        { review_by: userId },
        { final_review_by: userId },
      ],
      internal_deadline: { $gte: today, $lte: futureDate },
      task_status: { $nin: ["Completed", "Cancelled"] },
    })
      .populate("docket_id")
      .sort({ internal_deadline: 1 })
      .limit(10);

    const deadlines = tasks.map((task) => ({
      _id: task._id,
      title: task.work_type || "Task",
      reference: task.docket_no,
      deadline: task.internal_deadline,
      status: task.task_status,
      client: task.client_name,
    }));

    res.json(deadlines);
  } catch (err) {
    console.error("Error fetching staff deadlines:", err);
    res
      .status(500)
      .json({ message: "Error fetching deadlines", error: err.message });
  }
});

// GET staff users only (for task assignment dropdowns)
router.get("/staff-users", auth, checkPermission, async (req, res) => {
  try {
    // Step 1: Find the Role document where name is "staff"
    const staffRole = await Role.findOne({ name: { $regex: /^staff$/i } });

    if (!staffRole) {
      return res.status(404).json({ message: "Staff role not found" });
    }

    // Step 2: Find users with that role_id
    const staffUsers = await User.find({ role_id: staffRole._id })
      .select("_id name email role_id")
      .populate("role_id", "name")
      .lean();

    res.json({ users: staffUsers });
  } catch (err) {
    console.error("Error fetching staff users:", err);
    res
      .status(500)
      .json({ message: "Error fetching staff users", error: err.message });
  }
});
// ============================================
// GENERAL CRUD ROUTES
// ============================================

// GET all tasks with filters
router.get("/", auth, checkPermission, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      start_date,
      end_date,
      docket_no,
      task_status,
      country,
      sortBy = "createdAt",
      sortOrder = "desc",
      special_filter,
    } = req.query;

    const query = {};

    if (special_filter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      switch (special_filter) {
        case "overdue":
          query.internal_deadline = { $lt: today };
          query.task_status = { $nin: ["Completed", "Cancelled"] };
          break;
        case "dueToday":
          query.internal_deadline = { $gte: today, $lt: tomorrow };
          query.task_status = { $nin: ["Completed", "Cancelled"] };
          break;
        case "completedToday":
          query.task_status = "Completed";
          query.updatedAt = { $gte: today, $lt: tomorrow };
          break;
      }
    }

    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) {
        const end = new Date(end_date);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (docket_no) query.docket_no = { $regex: docket_no, $options: "i" };
    if (task_status) query.task_status = task_status;
    if (country) query.country = { $regex: country, $options: "i" };

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate("prepared_by", "name email")
        .populate("review_by", "name email")
        .populate("final_review_by", "name email")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Task.countDocuments(query),
    ]);

    const tasksWithNames = tasks.map((task) => ({
      ...task.toObject(),
      prepared_by_name: task.prepared_by?.name || "",
      review_by_name: task.review_by?.name || "",
      final_review_by_name: task.final_review_by?.name || "",
    }));

    res.json({
      tasks: tasksWithNames,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching tasks" });
  }
});

// GET single task
router.get("/:id", auth, checkPermission, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate(
        "prepared_by review_by final_review_by territory_manager",
        "name email",
      )
      .populate("docket_id");
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (err) {
    console.error("Fetching Task error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CREATE task
// KEY CHANGE: files array now includes documentType — no changes needed here
// since frontend sends complete file objects with documentType already attached
router.post("/", auth, checkPermission, async (req, res) => {
  try {
    const taskData = { ...req.body };

    // KEY CHANGE: files from frontend already have documentType field included
    const filesData = req.body.files || [];

    if (!taskData.docket_id) {
      return res.status(400).json({ message: "Docket number is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(taskData.docket_id)) {
      return res.status(400).json({
        message: "Invalid docket number. Select a valid docket No.",
      });
    }

    const { userId, userName } = getUserMeta(req);

    const task = new Task({
      ...taskData,
      files: filesData, // documentType is already part of each file object
      docket_doc: {},
    });
    await task.save();

    emitTaskUpdated(
      req.io,
      task,
      "created",
      req.user,
      [
        task.prepared_by?.toString(),
        task.review_by?.toString(),
        task.final_review_by?.toString(),
      ].filter(Boolean),
    );

    await logActivity({
      type: "task_created",
      description: `Task #${task._id.toString().slice(-4)} created for docket ${task.docket_no}`,
      userId,
      userName,
      entityId: task._id,
      entityType: "task",
      metadata: { docket_no: task.docket_no, work_type: task.work_type },
    });

    res.status(201).json({ message: "Task created successfully", task });
  } catch (err) {
    console.error("Task Creation Error:", err);
    res
      .status(500)
      .json({ message: "Error creating task", error: err.message });
  }
});

// UPDATE task
// KEY CHANGE: newFiles now carry documentType; merging preserves documentType on all files
router.put("/:id", auth, checkPermission, async (req, res) => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ✅ Extract only the fields we want to update explicitly
    const { task_status, sub_status, remarks, newFiles, files } = req.body;

    // ✅ Sequential stage validation (non-admin only)
    if (sub_status !== undefined && req.user?.role !== "admin") {
      const currentSubStatus = existingTask.sub_status || "";

      if (sub_status === "Reviewed" && currentSubStatus !== "Prepared") {
        return res.status(400).json({
          message: "Task must be Prepared before it can be marked as Reviewed.",
        });
      }

      if (sub_status === "Final Reviewed" && currentSubStatus !== "Reviewed") {
        return res.status(400).json({
          message:
            "Task must be Reviewed before it can be marked as Final Reviewed.",
        });
      }

      // ✅ Reject validation — reviewer can only reject if task is Prepared
      if (sub_status === "" && currentSubStatus !== "Prepared") {
        return res.status(400).json({
          message: "Cannot reject: task is not in Prepared stage.",
        });
      }

      // ✅ Final reviewer reject — can only reject back to Prepared if currently Reviewed
      if (sub_status === "Prepared" && currentSubStatus !== "Reviewed") {
        return res.status(400).json({
          message: "Cannot reject: task is not in Reviewed stage.",
        });
      }
    }

    // ✅ Build updated files array
    let updatedFiles = existingTask.files || [];
    if (newFiles && Array.isArray(newFiles)) {
      updatedFiles = [...updatedFiles, ...newFiles];
    } else if (files && Array.isArray(files)) {
      updatedFiles = files;
    }

    // ✅ Build a clean update object — only include defined fields
    const updateFields = { files: updatedFiles };
    if (task_status !== undefined) updateFields.task_status = task_status;
    if (sub_status !== undefined) updateFields.sub_status = sub_status; // allows "" for rejection
    if (remarks !== undefined) updateFields.remarks = remarks;

    const { userId, userName } = getUserMeta(req);

    // ✅ Use $set so empty string sub_status ("") is persisted correctly
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: false },
    );

    emitTaskUpdated(
      req.io,
      task,
      "updated",
      req.user,
      [
        task.prepared_by?.toString(),
        task.review_by?.toString(),
        task.final_review_by?.toString(),
      ].filter(Boolean),
    );

    await logActivity({
      type: "task_updated",
      description: `Task #${task._id.toString().slice(-4)} stage updated to "${sub_status !== undefined ? sub_status || "Pending" : task.task_status}"`,
      userId,
      userName,
      entityId: task._id,
      entityType: "task",
      metadata: {
        docket_no: task.docket_no,
        task_status: task.task_status,
        sub_status: task.sub_status,
      },
    });

    res.json({ message: "Task updated successfully", task });
  } catch (err) {
    console.error("Updating Task error:", err);
    res
      .status(500)
      .json({ message: "Error updating task", error: err.message });
  }
});

// DELETE task
router.delete("/:id", auth, checkPermission, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.files && task.files.length > 0) {
      for (const file of task.files) {
        if (file.key) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: file.key }),
            );
          } catch (e) {
            console.warn(`Failed to delete S3 file ${file.key}:`, e.message);
          }
        }
      }
    }

    const { userId, userName } = getUserMeta(req);
    await Task.findByIdAndDelete(req.params.id);

    await logActivity({
      type: "task_deleted",
      description: `Task for docket ${task.docket_no} deleted`,
      userId,
      userName,
      entityId: task._id,
      entityType: "task",
    });

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    console.error("Deleting Task error:", err);
    res
      .status(500)
      .json({ message: "Error deleting task", error: err.message });
  }
});

// DELETE SPECIFIC FILE
// KEY CHANGE: no changes needed — file deletion by key works regardless of documentType
router.delete("/:id/file/:fileId", auth, checkPermission, async (req, res) => {
  try {
    const { id, fileId } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const fileToDelete = task.files.find(
      (f) => f._id?.toString() === fileId || f.key === fileId,
    );

    if (fileToDelete) {
      if (fileToDelete.key) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileToDelete.key,
            }),
          );
        } catch (e) {
          console.warn(
            `Failed to delete S3 file ${fileToDelete.key}:`,
            e.message,
          );
        }
      }

      task.files = task.files.filter((f) => f !== fileToDelete);
      await task.save();
    } else {
      return res.status(404).json({ message: "File not found" });
    }

    res.json({ status: "success", message: "File deleted", data: task });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
