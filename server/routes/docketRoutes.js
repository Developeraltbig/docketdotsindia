import express from "express";
import Docket from "../models/Docket.js";
import Task from "../models/Task.js";
import Application from "../models/Application.js";
import Deadline from "../models/Deadline.js";
import auth from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";
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

// --- 1. AWS S3 CONFIGURATION ---
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Start Multipart Upload
router.post("/s3/multipart/start", auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const key = `dockets/${Date.now()}-${filename.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    )}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "application/octet-stream", // Fallback
      ChecksumAlgorithm: undefined, // Add this line to prevent AWS SDK errors
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

// Presigned URL (For small files/Simple Uploads)
router.post("/s3/presigned-url", auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    const key = `dockets/${Date.now()}-${filename.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    )}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "application/octet-stream", // Fallback
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

// Download/View URL Route
router.get("/download-url", auth, async (req, res) => {
  try {
    const { fileKey } = req.query;
    if (!fileKey)
      return res.status(400).json({ message: "File key is required" });

    // Check if file exists in S3
    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey }),
      );
    } catch (error) {
      return res.status(404).json({ message: "File not found or deleted" });
    }

    // Generate signed URL
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });
    res.json({ downloadUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- HELPER FUNCTION ---
const parseJSONField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return [];
  }
};

// --- 3. DOCKET CRUD ROUTES ---

// @route   POST /api/dockets
// @desc    Create a new docket with S3 files (Metadata)
router.post("/", auth, checkPermission, async (req, res) => {
  try {
    // 1. Receive file metadata from frontend (JSON)
    // Expects array: [{ key, filename, fileType, fileSize, ... }]
    const filesData = req.body.files || [];

    // 2. Parse dynamic array fields
    const applicants = parseJSONField(req.body.applicants);
    const inventors = parseJSONField(req.body.inventors);
    const priorities = parseJSONField(req.body.priorities);

    if (!req.body.docket_no || !req.body.instruction_date) {
      return res
        .status(400)
        .json({ message: "Docket Number and Date are required." });
    }

    // 3. Check for duplicates
    const existingDocket = await Docket.findOne({
      docket_no: req.body.docket_no.trim(),
    });

    if (existingDocket) {
      return res.status(409).json({ message: "Docket Number already exists." });
    }

    // 4. Create Docket
    const newDocket = new Docket({
      // Services
      instruction_date: req.body.instruction_date,
      docket_no: req.body.docket_no,
      client_id: req.body.client_id,
      service_name: req.body.service_name,
      client_ref: req.body.client_ref,
      currency: req.body.currency,
      anovipfee: req.body.anovipfee,
      associatefee: req.body.associatefee,
      officialfee: req.body.officialfee,
      fee: req.body.fee,
      created_by: req.user._id,

      // Client Details
      spoc_name: req.body.spoc_name,
      phone_no: req.body.phone_no,
      firm_name: req.body.firm_name,
      country: req.body.country,
      email: req.body.email,
      address: req.body.address,

      // Associate Details
      associate_ref_no: req.body.associate_ref_no || null,
      associate_spoc_name: req.body.associate_spoc_name || null,
      associate_phone_no: req.body.associate_phone_no || null,
      associate_firm_name: req.body.associate_firm_name || null,
      associate_country: req.body.associate_country || null,
      associate_email: req.body.associate_email || null,
      associate_address: req.body.associate_address || null,

      // Status
      application_status: req.body.application_status,
      due_date: req.body.due_date,
      application_number: req.body.application_number || null,

      // Application Details
      application_type: req.body.application_type,
      filling_country: req.body.filling_country,
      filling_date: req.body.filling_date,
      application_no: req.body.application_no,
      corresponding_application_no:
        req.body.corresponding_application_no || null,
      applicant_type: req.body.applicant_type,
      title: req.body.title,
      pct_application_date: req.body.pct_application_date || null,
      field_of_invention: req.body.field_of_invention || null,

      // Files (S3 Metadata)
      files: filesData,
      file_images: [], // Deprecated legacy field, keeping empty for schema compatibility

      status: req.body.status || "docket",

      // Dynamic Arrays
      applicants,
      inventors,
      priorities,
    });

    const { userId, userName } = getUserMeta(req); // ← add this before the try or at top of handler

    const savedDocket = await newDocket.save();
    await savedDocket.populate("created_by", "name email");

    await logActivity({
      type: "docket_created",
      description: `Docket ${savedDocket.docket_no} created for ${savedDocket.firm_name || "client"}`,
      userId,
      userName,
      entityId: savedDocket._id, // ← was docket._id
      entityType: "docket",
      metadata: {
        docket_no: savedDocket.docket_no,
        service: savedDocket.service_name,
      },
    });
    res.status(201).json({
      status: "success",
      message: "Docket created successfully",
      data: savedDocket,
    });
  } catch (err) {
    console.error("Creating Docket error:", err);
    res.status(400).json({ status: "error", message: err.message });
  }
});

// @route   GET /api/dockets
// @desc    Get all dockets with Filtering, Pagination, and Global Search
router.get("/", auth, checkPermission, async (req, res) => {
  try {
    let query = {};
    const {
      start_date,
      end_date,
      docket_no,
      service_name,
      filling_country,
      country,
      application_status,
      field_selector,
      dynamic_search,
      page = 1,
      limit = 10,
      sortBy = "createdAt", // Default sort field
      sortOrder = "desc",
    } = req.query;

    // 1. Date Range Filtering
    if (start_date || end_date) {
      query.instruction_date = {};
      if (start_date) query.instruction_date.$gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.instruction_date.$lte = endDate;
      }
    }

    // 2. Specific Field Filters
    if (docket_no) query.docket_no = { $regex: docket_no, $options: "i" };
    if (service_name)
      query.service_name = { $regex: service_name, $options: "i" };
    if (filling_country)
      query.filling_country = { $regex: filling_country, $options: "i" };
    if (country) query.country = { $regex: country, $options: "i" };

    // 3. Global Dynamic Search
    if (field_selector && dynamic_search) {
      query[field_selector] = { $regex: dynamic_search, $options: "i" };
    }

    if (application_status) {
      if (
        application_status === "Pending" ||
        application_status === "In-Process"
      ) {
        // For "Pending/In-Process", show everything EXCEPT these finalized states
        query.application_status = {
          $nin: ["Filed", "Granted", "Inactive"],
        };
      } else {
        // For exact matches like "Granted", "Inactive", "Published", etc.
        query.application_status = application_status;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const dockets = await Docket.find(query)
      .populate("client_id", "name firm_name email phone_no country address")
      .populate(
        "foreign_associate_id",
        "firm_name associate_ref_no country contact_person email phone notes",
      )
      .populate("created_by", "name email") // Fetch only name and email
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 });

    const count = await Docket.countDocuments(query);

    res.json({
      dockets,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalRecords: count,
    });
  } catch (err) {
    console.error("Fetching Docket error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/dockets/stats
// @desc    Get counts for dashboard cards
router.get("/stats", auth, async (req, res) => {
  try {
    const docketCount = await Docket.countDocuments();
    const taskCount = await Task.countDocuments();
    const appCount = await Application.countDocuments();
    const deadCount = await Deadline.countDocuments();
    res.json({
      dockets: docketCount,
      tasks: taskCount,
      applications: appCount,
      deadlines: deadCount,
    });
  } catch (err) {
    console.error("Fetching stats error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/dockets/bulk-import
// @desc    Bulk import dockets from Excel
router.post("/bulk-import", auth, checkPermission, async (req, res) => {
  try {
    const { dockets } = req.body;

    if (!dockets || !Array.isArray(dockets) || dockets.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid data format. Expected array of dockets.",
      });
    }

    // Import Client model
    const Client = (await import("../models/User.js")).default;
    const mongoose = (await import("mongoose")).default;

    const results = {
      imported: 0,
      failed: 0,
      errors: [],
    };

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return !isNaN(date.getTime()) ? date : null;
    };

    for (let i = 0; i < dockets.length; i++) {
      const docket = dockets[i];
      const rowNum = i + 2;

      try {
        if (!docket.docket_no) {
          throw new Error("Docket Number is required");
        }
        if (!parseDate(docket.instruction_date)) {
          throw new Error("Instruction Date is required");
        }

        // ===== CLIENT LOOKUP =====
        let clientId = null;

        if (
          docket.client_id &&
          mongoose.Types.ObjectId.isValid(docket.client_id)
        ) {
          const clientExists = await Client.findById(docket.client_id);
          if (clientExists) clientId = docket.client_id;
        }

        if (!clientId && docket.client_name) {
          const client = await Client.findOne({
            name: { $regex: `^${docket.client_name.trim()}$`, $options: "i" },
          });
          if (client) clientId = client._id;
        }

        if (!clientId && docket.client_email) {
          const client = await Client.findOne({
            email: { $regex: `^${docket.client_email.trim()}$`, $options: "i" },
          });
          if (client) clientId = client._id;
        }

        if (!clientId) {
          throw new Error(
            `Client not found for name: ${docket.client_name} or email: ${docket.client_email}`,
          );
        }

        const existingDocket = await Docket.findOne({
          docket_no: docket.docket_no,
        });
        if (existingDocket) {
          throw new Error("Docket number already exists");
        }

        const totalFee =
          docket.fee ||
          Math.round(
            (parseFloat(docket.anovipfee) || 0) +
              (parseFloat(docket.associatefee) || 0) +
              (parseFloat(docket.officialfee) || 0),
          );

        const newDocket = new Docket({
          ...docket,
          instruction_date: parseDate(docket.instruction_date),
          due_date: parseDate(docket.due_date),
          filling_date: parseDate(docket.filling_date),
          pct_application_date: parseDate(docket.pct_application_date),
          client_id: clientId,
          fee: totalFee,
          files: [], // Init empty array for bulk imports
          file_images: [],
          status: docket.status || "docket",
        });

        await newDocket.save();
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          docket_no: docket.docket_no || "N/A",
          error: err.message,
        });
      }
    }

    const statusCode = results.imported > 0 ? 200 : 400;

    res.status(statusCode).json({
      status: results.imported > 0 ? "success" : "error",
      message: `Imported ${results.imported} of ${dockets.length} records`,
      imported: results.imported,
      failed: results.failed,
      total: dockets.length,
      errors: results.errors.slice(0, 50),
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({
      status: "error",
      message: "Bulk import failed: " + err.message,
    });
  }
});

// @route   GET /api/dockets/export/excel
// @desc    Export dockets to Excel (returns JSON for client-side export)
router.get("/export/excel", auth, checkPermission, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      docket_no,
      service_name,
      filling_country,
      application_type,
      field_selector,
      dynamic_search,
    } = req.query;

    let query = {};

    if (start_date || end_date) {
      query.instruction_date = {};
      if (start_date) query.instruction_date.$gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.instruction_date.$lte = endDate;
      }
    }

    if (docket_no) query.docket_no = { $regex: docket_no, $options: "i" };
    if (service_name)
      query.service_name = { $regex: service_name, $options: "i" };
    if (filling_country)
      query.filling_country = { $regex: filling_country, $options: "i" };
    if (application_type)
      query.application_type = { $regex: application_type, $options: "i" };

    if (field_selector && dynamic_search) {
      query[field_selector] = { $regex: dynamic_search, $options: "i" };
    }

    const dockets = await Docket.find(query).sort({ createdAt: -1 });
    res.json(dockets);
  } catch (err) {
    console.error("Exporting Docket error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   PUT /api/dockets/:id
// @desc    Update a record with S3 file support
router.put("/:id", auth, checkPermission, async (req, res) => {
  try {
    const existingDocket = await Docket.findById(req.params.id);
    if (!existingDocket) {
      return res
        .status(404)
        .json({ status: "error", message: "Record not found" });
    }

    // --- 1. HANDLE FILE MERGING ---
    let finalFiles = [];

    // Step A: Determine the base list of files (Existing Files)
    // If the frontend sent 'files', it means the user might have deleted some files in the UI.
    // We trust req.body.files IF it exists. If not, we keep DB files.
    if (req.body.files && Array.isArray(req.body.files)) {
      finalFiles = req.body.files.map((f) => ({
        // Ensure we keep existing metadata if passed back, or fallback
        key: f.key,
        filename: f.filename,
        fileType: f.fileType,
        fileSize: f.fileSize,
        documentType: f.documentType,
        uploadedAt: f.uploadedAt || new Date(),
      }));
    } else {
      // If frontend didn't send 'files' array, preserve what is in DB
      finalFiles = existingDocket.files ? existingDocket.files.toObject() : [];
    }

    // Step B: Append newly uploaded files (from Uppy)
    if (
      req.body.newFiles &&
      Array.isArray(req.body.newFiles) &&
      req.body.newFiles.length > 0
    ) {
      const sanitizedNewFiles = req.body.newFiles.map((f) => ({
        key: f.key,
        filename: f.filename || f.name,
        fileType: f.fileType || f.type || "application/octet-stream",
        fileSize: f.fileSize || f.size || 0,
        documentType: f.documentType,
        uploadedAt: new Date(),
      }));

      finalFiles = [...finalFiles, ...sanitizedNewFiles];
    }

    // --- 2. PREPARE UPDATE OBJECT ---
    const updateData = {
      ...req.body,
      files: finalFiles, // Apply the merged file list

      // Parse JSON strings back to arrays if they were sent as strings
      applicants:
        typeof req.body.applicants === "string"
          ? JSON.parse(req.body.applicants)
          : (req.body.applicants ?? existingDocket.applicants),

      inventors:
        typeof req.body.inventors === "string"
          ? JSON.parse(req.body.inventors)
          : (req.body.inventors ?? existingDocket.inventors),

      priorities:
        typeof req.body.priorities === "string"
          ? JSON.parse(req.body.priorities)
          : (req.body.priorities ?? existingDocket.priorities),
    };

    // Cleanup: Remove temp fields used for logic but not in Schema
    delete updateData.newFiles;

    // Remove undefined fields to prevent overwriting with nulls
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });
    const { userId, userName } = getUserMeta(req);
    // --- 3. SAVE ---
    const updated = await Docket.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    await logActivity({
      type: "docket_updated",
      description: `Docket ${updated.docket_no} updated`, // ← was docket.docket_no
      userId,
      userName,
      entityId: updated._id, // ← was docket._id
      entityType: "docket",
      metadata: {
        docket_no: updated.docket_no,
        status: updated.application_status,
      },
    });
    res.json({
      status: "success",
      message: "Updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Updating Docket error:", err);
    res.status(400).json({ status: "error", message: err.message });
  }
});
// @route   DELETE /api/dockets/:id
// @desc    Delete a record and its S3 files
// @route   DELETE /api/dockets/:id
router.delete("/:id", auth, checkPermission, async (req, res) => {
  try {
    const docket = await Docket.findById(req.params.id);
    if (!docket) {
      return res
        .status(404)
        .json({ status: "error", message: "Record not found" });
    }

    // --- OPTIMIZATION: Run S3 deletes in parallel ---
    if (docket.files && docket.files.length > 0) {
      const deletePromises = docket.files
        .filter((file) => file.key)
        .map((file) =>
          s3Client
            .send(
              new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: file.key }),
            )
            .catch((e) => console.warn(`Failed to delete ${file.key}`, e)),
        );

      // Wait for all to finish parallelly (much faster)
      await Promise.all(deletePromises);
    }
    const { userId, userName } = getUserMeta(req);
    await Docket.findByIdAndDelete(req.params.id);
    await logActivity({
      type: "docket_deleted",
      description: `Docket ${docket.docket_no} deleted`,
      userId,
      userName,
      entityId: docket._id,
      entityType: "docket",
    });
    res.json({ status: "success", message: "Record deleted successfully" });
  } catch (err) {
    console.error("Deleting Docket error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// @route   DELETE /api/dockets/:id/file/:fileId
// @desc    Delete a specific file from a docket (S3)
router.delete("/:id/file/:fileId", auth, checkPermission, async (req, res) => {
  try {
    const { id, fileId } = req.params;

    const docket = await Docket.findById(id);
    if (!docket) {
      return res
        .status(404)
        .json({ status: "error", message: "Record not found" });
    }

    // Find file by _id or key
    const fileToDelete = docket.files.find(
      (f) => f._id?.toString() === fileId || f.key === fileId,
    );

    if (fileToDelete) {
      // 1. Delete from S3
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

      // 2. Remove from DB array
      docket.files = docket.files.filter((f) => f !== fileToDelete);
      await docket.save();
    } else {
      return res.status(404).json({ message: "File not found in docket" });
    }

    res.json({
      status: "success",
      message: "File deleted successfully",
      data: docket,
    });
  } catch (err) {
    console.error("Deleting Docket File error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// @route   GET /api/dockets/performance
// @desc    Get monthly performance data for charts
router.get("/performance", auth, checkPermission, async (req, res) => {
  try {
    const { filter = "1Y" } = req.query;

    const now = new Date();
    let startDate;
    let groupByFormat;

    // Determine date range based on filter
    switch (filter.toUpperCase()) {
      case "1M":
        startDate = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          now.getDate(),
        );
        groupByFormat = {
          year: { $year: "$instruction_date" },
          month: { $month: "$instruction_date" },
          day: { $dayOfMonth: "$instruction_date" },
        };
        break;
      case "6M":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        groupByFormat = {
          year: { $year: "$instruction_date" },
          month: { $month: "$instruction_date" },
        };
        break;
      case "1Y":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        groupByFormat = {
          year: { $year: "$instruction_date" },
          month: { $month: "$instruction_date" },
        };
        break;
      case "ALL":
      default:
        startDate = null;
        groupByFormat = {
          year: { $year: "$instruction_date" },
          month: { $month: "$instruction_date" },
        };
        break;
    }

    const matchStage = startDate
      ? { instruction_date: { $gte: startDate, $lte: now } }
      : {};

    const performanceData = await Docket.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupByFormat,
          totalDockets: { $sum: 1 },
          completedDockets: {
            $sum: {
              $cond: [{ $eq: ["$application_status", "completed"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          month:
            filter.toUpperCase() === "1M"
              ? {
                  $concat: [
                    { $toString: "$_id.day" },
                    " ",
                    {
                      $arrayElemAt: [
                        [
                          "",
                          "Jan",
                          "Feb",
                          "Mar",
                          "Apr",
                          "May",
                          "Jun",
                          "Jul",
                          "Aug",
                          "Sep",
                          "Oct",
                          "Nov",
                          "Dec",
                        ],
                        "$_id.month",
                      ],
                    },
                  ],
                }
              : {
                  $arrayElemAt: [
                    [
                      "",
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ],
                    "$_id.month",
                  ],
                },
          bar: "$totalDockets",
          area: "$completedDockets",
        },
      },
    ]);

    if (performanceData.length === 0) {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const emptyData = months.map((month) => ({ month, bar: 0, area: 0 }));
      return res.json(emptyData);
    }

    res.json(performanceData);
  } catch (err) {
    console.error("Fetching performance data error:", err);
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/dockets/status-counts
// @desc    Get breakdown of docket statuses for the top cards
router.get("/status-counts", auth, async (req, res) => {
  try {
    // 1. Total Dockets
    const total = await Docket.countDocuments({});

    // 2. Granted
    const granted = await Docket.countDocuments({
      application_status: "Granted",
    });

    // 3. Inactive
    const inactive = await Docket.countDocuments({
      application_status: "Inactive",
    });

    // 4. Pending (NOT Granted, NOT Inactive)
    const pending = await Docket.countDocuments({
      application_status: { $nin: ["Granted", "Inactive", "Filed"] },
    });

    res.json({
      total,
      granted,
      inactive,
      pending,
    });
  } catch (err) {
    console.error("Status counts error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
