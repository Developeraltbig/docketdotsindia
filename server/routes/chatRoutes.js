import express from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import auth from "../middleware/auth.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// 1. Start Multipart Upload (for large files > 5MB)
router.post("/s3/multipart/start", auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res
        .status(400)
        .json({ message: "Filename and contentType are required" });
    }

    const key = `chat/${Date.now()}-${filename.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    )}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const response = await s3Client.send(command);

    res.json({
      uploadId: response.UploadId,
      key: key,
    });
  } catch (err) {
    console.error("Start multipart upload error:", err);
    res
      .status(500)
      .json({ message: "Failed to start upload", error: err.message });
  }
});

// 2. Sign Part for Multipart Upload
router.post("/s3/multipart/sign-part", auth, async (req, res) => {
  try {
    const { uploadId, key, partNumber } = req.body;

    if (!uploadId || !key || !partNumber) {
      return res
        .status(400)
        .json({ message: "uploadId, key, and partNumber are required" });
    }

    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({ url });
  } catch (err) {
    console.error("Sign part error:", err);
    res
      .status(500)
      .json({ message: "Failed to sign part", error: err.message });
  }
});

// 3. Complete Multipart Upload
router.post("/s3/multipart/complete", auth, async (req, res) => {
  try {
    const { uploadId, key, parts } = req.body;

    if (!uploadId || !key || !parts || !Array.isArray(parts)) {
      return res
        .status(400)
        .json({ message: "uploadId, key, and parts array are required" });
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    const response = await s3Client.send(command);

    res.json({
      location: response.Location,
      key: key,
      etag: response.ETag,
    });
  } catch (err) {
    console.error("Complete multipart upload error:", err);
    res
      .status(500)
      .json({ message: "Failed to complete upload", error: err.message });
  }
});

// 4. Abort Multipart Upload (cleanup on failure)
router.post("/s3/multipart/abort", auth, async (req, res) => {
  try {
    const { uploadId, key } = req.body;

    if (!uploadId || !key) {
      return res.status(400).json({ message: "uploadId and key are required" });
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    });

    await s3Client.send(command);

    res.json({ message: "Upload aborted successfully" });
  } catch (err) {
    console.error("Abort multipart upload error:", err);
    res
      .status(500)
      .json({ message: "Failed to abort upload", error: err.message });
  }
});

// 5. Get Presigned URL for Simple Upload (small files < 5MB)
// 5. Get Presigned URL for Simple Upload (small files < 5MB)
router.post("/s3/presigned-url", auth, async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res
        .status(400)
        .json({ message: "Filename and contentType are required" });
    }

    const key = `chat/${Date.now()}-${filename.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    )}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // --- ADD THIS LINE ---
      ChecksumAlgorithm: undefined,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.json({
      uploadUrl,
      key,
      fileUrl: `/${key}`,
    });
  } catch (err) {
    console.error("Get presigned URL error:", err);
    res
      .status(500)
      .json({ message: "Failed to generate upload URL", error: err.message });
  }
});
// 6. Get Presigned URL for Download (secure file access)
// 6. Get Presigned URL for Download (Secure file access with existence check)
router.get("/download-url", auth, checkPermission, async (req, res) => {
  try {
    // 1. ADD 'filename' and 'download' to req.query extraction
    const { fileKey, filename, download } = req.query;

    if (!fileKey) {
      return res.status(400).json({ message: "fileKey is required" });
    }

    // Clean the key
    const cleanKey = fileKey.startsWith("/") ? fileKey.substring(1) : fileKey;

    // --- STEP 1: CHECK IF FILE EXISTS ---
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: cleanKey,
        }),
      );
    } catch (error) {
      if (
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return res.status(404).json({ message: "This file has been deleted!" });
      }
      throw error;
    }

    // --- STEP 2: GENERATE URL ---
    // 2. CREATE base parameters
    const commandParams = {
      Bucket: BUCKET_NAME,
      Key: cleanKey,
    };

    // 3. IF it's a download request, force the browser to download it with the correct filename
    if (download === "true") {
      const safeFilename = filename
        ? filename.replace(/"/g, "")
        : "downloaded_file";
      commandParams.ResponseContentDisposition = `attachment; filename="${safeFilename}"`;
    }

    const command = new GetObjectCommand(commandParams);

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });

    res.json({ downloadUrl });
  } catch (err) {
    console.error("Get download URL error:", err);
    res
      .status(500)
      .json({ message: "Failed to generate download URL", error: err.message });
  }
});

/* ============================================
   CONVERSATION ROUTES
============================================ */

// Create or Get 1-1 Chat
router.post("/conversation", auth, checkPermission, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "UserId is required" });
    }

    let convo = await Conversation.findOne({
      isGroup: false,
      members: { $all: [req.user.id, userId] },
    }).populate("members", "name email");

    if (!convo) {
      convo = await Conversation.create({
        members: [req.user.id, userId],
      });
      convo = await convo.populate("members", "name email");
    }

    res.json(convo);
  } catch (err) {
    console.error("Create conversation error:", err);
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// Create Group
router.post("/group", auth, checkPermission, async (req, res) => {
  try {
    const { name, members } = req.body;

    if (!name || !members || members.length < 1) {
      return res.status(400).json({
        message: "Group name and at least 1 member required",
      });
    }

    const convo = await Conversation.create({
      isGroup: true,
      name,
      members: [...members, req.user.id],
      admins: [req.user.id],
    });

    const populated = await convo.populate("members", "name email");

    res.json(populated);
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ message: "Group creation failed" });
  }
});

// Get All Users
// Ensure you import the Role model

router.get("/users", auth, checkPermission, async (req, res) => {
  try {
    // 1. Find the ID of the 'client' role first
    // Since your Role schema has lowercase: true, 'client' will always match
    const clientRole = await Role.findOne({ name: "client" });

    // 2. Build the query object
    const query = {
      _id: { $ne: req.user.id }, // Exclude current user
    };

    // 3. If the client role exists, exclude users who have this role_id
    if (clientRole) {
      query.role_id = { $ne: clientRole._id };
    }

    // 4. Fetch users and also include role_id (populated if you want to verify on frontend)
    const users = await User.find(query)
      .select("name email role_id")
      .populate("role_id", "name"); // Optional: populates role name for frontend use

    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Failed to load users" });
  }
});

// Get My Conversations
router.get("/conversations", auth, checkPermission, async (req, res) => {
  try {
    const convos = await Conversation.find({
      members: req.user.id,
    })
      .populate("members", "name email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email" },
      })
      .sort({ updatedAt: -1 });

    res.json(convos);
  } catch (err) {
    console.error("Get conversations error:", err);
    res.status(500).json({ message: "Failed to load conversations" });
  }
});

/* ============================================
   MESSAGE ROUTES
============================================ */

// Get Messages
router.get(
  "/messages/:conversationId",
  auth,
  checkPermission,
  async (req, res) => {
    try {
      const msgs = await Message.find({
        conversation: req.params.conversationId,
      })
        .populate("sender", "name email")
        .populate("readBy", "_id")
        .sort({ createdAt: 1 });

      res.json(msgs);
    } catch (err) {
      console.error("Get messages error:", err);
      res.status(500).json({ message: "Failed to load messages" });
    }
  },
);

// Send Message
router.post("/message", auth, checkPermission, async (req, res) => {
  try {
    const { conversationId, text, files } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasFiles = Array.isArray(files) && files.length > 0;

    if (!hasText && !hasFiles) {
      return res
        .status(400)
        .json({ message: "Message must have text or files" });
    }

    const messageData = {
      conversation: conversationId,
      sender: req.user.id,
      text: hasText ? text.trim() : "",
      readBy: [req.user.id],
    };

    if (hasFiles) {
      messageData.files = files.map((file) => ({
        key: file.key,
        filename: file.filename || "file",
        fileType: file.fileType || "application/octet-stream",
        fileSize: file.fileSize || 0,
        etag: file.etag || "",
      }));
    }

    const msg = await Message.create(messageData);

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: msg._id,
      updatedAt: Date.now(),
    });

    const populatedMsg = await msg.populate("sender", "name email");

    res.json(populatedMsg);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({
      message: "Message send failed",
      error: err.message,
    });
  }
});

// Search Users
router.get("/search", auth, checkPermission, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query?.trim()) return res.json([]);

    // 1. Find the 'client' role ID
    const clientRole = await Role.findOne({ name: "client" });

    // 2. Build the query
    const queryObj = {
      _id: { $ne: req.user.id }, // Exclude current user at DB level
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    };

    // 3. Exclude the client role if it exists
    if (clientRole) {
      queryObj.role_id = { $ne: clientRole._id };
    }

    // 4. Fetch users
    const users = await User.find(queryObj)
      .select("name email role_id")
      .populate("role_id", "name") // Optional: populates role name
      .limit(10);

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

// Delete Message
router.delete("/message/:id", auth, checkPermission, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);

    if (!msg) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (msg.sender.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Delete associated files from S3
    if (msg.files && msg.files.length > 0) {
      for (const file of msg.files) {
        try {
          const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.key,
          });
          await s3Client.send(command);
        } catch (fileErr) {
          console.error("Error deleting file from S3:", fileErr);
        }
      }
    }

    await msg.deleteOne();
    res.sendStatus(200);
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ message: "Delete failed" });
  }
});

// Mark Messages as Read
router.post("/messages/read", auth, checkPermission, async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID required" });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user.id },
        readBy: { $nin: [req.user.id] },
      },
      {
        $addToSet: { readBy: req.user.id },
      },
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
});

// Get Total Unread Count
router.get("/unread-count", auth, checkPermission, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({ members: userId }).select(
      "_id",
    );

    if (!conversations.length) {
      return res.json({ total: 0 });
    }

    const conversationIds = conversations.map((c) => c._id);

    const unreadCount = await Message.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: userId },
      readBy: { $nin: [userId] },
    });

    res.json({ total: unreadCount });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ message: "Failed to get unread count" });
  }
});

export default router;
