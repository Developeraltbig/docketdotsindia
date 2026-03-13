import mongoose from "mongoose";

// File schema for S3 stored files
const fileSchema = new mongoose.Schema(
  {
    // S3 object key (e.g., "chat/1736850000-document.pdf")
    key: {
      type: String,
      required: true,
    },
    // Original filename for display
    filename: {
      type: String,
      required: true,
    },
    // MIME type
    fileType: {
      type: String,
      required: true,
    },
    // File size in bytes
    fileSize: {
      type: Number,
      required: true,
    },
    // S3 ETag for file integrity verification
    etag: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    // Array of S3 file objects
    files: [fileSchema],
    // Track who has read this message
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Index for efficient querying
messageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
