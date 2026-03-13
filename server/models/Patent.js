import { nanoid } from "nanoid";
import mongoose from "mongoose";

const patentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(25),
      index: true,
    },
    inventionText: {
      type: String,
      required: true,
    },
    sections: {
      title: {
        content: String,
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
      abstract: {
        content: String,
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
      field: {
        heading: String,
        content: String,
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
      background: {
        heading: String,
        content: [String],
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
      summary: {
        heading: String,
        content: [String],
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
      description: {
        heading: String,
        content: [String],
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
      advantages: {
        heading: String,
        content: [String],
        generatedAt: Date,
        edited: Boolean,
        editedContent: String,
      },
    },
  },

  { timestamps: true }
);

const Patent = mongoose.model("Patent", patentSchema);

export default Patent;
