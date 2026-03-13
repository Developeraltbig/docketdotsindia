import fs from "fs";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import Patent from "../models/Patent.js";
import auth from "../middleware/auth.js";
import { AI_PROMPTS } from "../utils/aiPrompts.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generatePatentPDF } from "../utils/pdfGenerator.js";
import { generatePatentDOCX } from "../utils/docxGenerator.js";

dotenv.config({ quiet: true });
const router = express.Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

// 1. GENERATE DRAFT
router.post("/generate", auth, async (req, res) => {
  try {
    const user = req.user;
    const { inventionText } = req.body;

    if (!inventionText) {
      return res.status(400).json({ message: "Invention text is required" });
    }

    console.log("Starting parallel generation...");

    const sectionKeys = Object.keys(AI_PROMPTS);

    // Create promises for all sections
    const generationPromises = sectionKeys.map(async (key) => {
      try {
        const prompt = AI_PROMPTS[key].prompt(inventionText);
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        return { key, content: text };
      } catch (error) {
        console.error(`Error generating ${key}:`, error.message);
        throw error;
      }
    });

    // Wait for all
    const results = await Promise.all(generationPromises);

    // Parse results
    const sections = {};
    results.forEach((result) => {
      let cleanContent = result.content;

      // Try to parse JSON if the prompt requested it
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Handle various response formats from prompts
          cleanContent =
            parsed.content ||
            parsed.titleOfInvention ||
            parsed.background?.paragraphs?.join("\n") ||
            parsed.summary?.content?.join("\n") ||
            result.content;

          if (Array.isArray(cleanContent)) {
            cleanContent = cleanContent.join("\n\n");
          }
        }
      } catch (e) {
        throw new Error(`Parsing failed for ${result.key}:`, e);
      }
      sections[result.key] = { content: cleanContent };
    });

    // Save to DB
    const newPatent = new Patent({
      user: user._id,
      inventionText,
      sections,
    });

    await newPatent.save();
    console.log("Draft generated and saved");

    // REMOVED: Truncation logic block was here.
    // Now sending full content immediately.

    res.status(200).json({
      success: true,
      data: newPatent,
    });
  } catch (error) {
    console.error("Generation failed:", error);
    res
      .status(500)
      .json({ message: "Internal server error during generation" });
  }
});

// 2. GET DRAFT
router.get("/:id", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Populate user to get email for form pre-filling
    const patent = await Patent.findOne({
      publicId: id,
      user: userId,
    }).populate("user", "email");

    if (!patent) {
      return res.status(404).json({ message: "Draft not found" });
    }

    const patentObj = patent.toObject();

    // REMOVED: isPaid check and text truncation loop.
    // Always returning full content now.

    res.json({
      success: true,
      isPaid: true, // Force true to satisfy frontend checks if any remain
      status: patent.status,
      draftId: patent.publicId,
      payment: patent.payment,
      sections: patentObj.sections,
      usptoForm: patentObj.usptoForm || {},
      targetCountry: patentObj.targetCountry || "US",
      userEmail: patent.user ? patent.user.email : "",
    });
  } catch (error) {
    console.error("Get draft error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. GET USER DRAFTS (Protected)
router.get("/user/all", auth, async (req, res) => {
  try {
    console.log("Fetching drafts for User ID:", req.user._id);
    const patents = await Patent.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    console.log(`Found ${patents.length} drafts.`);
    res.json({ success: true, patents });
  } catch (error) {
    console.error("Error fetching user drafts:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// REGENERATE SPECIFIC SECTION
router.post("/:id/regenerate", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionKey, inventionText } = req.body;

    if (!sectionKey || !inventionText) {
      return res.status(400).json({ message: "Missing required data" });
    }

    // Check if prompt exists for this section
    if (!AI_PROMPTS[sectionKey]) {
      return res.status(400).json({ message: "Invalid section key" });
    }

    const patent = await Patent.findOne({ publicId: id, user: req.user._id });
    if (!patent) {
      return res.status(404).json({ message: "Draft not found" });
    }

    // Generate new content using the AI prompt
    const prompt = AI_PROMPTS[sectionKey].prompt(inventionText);
    const result = await model.generateContent(prompt);
    const response = result.response;
    let newContent = response.text();

    // Parse JSON response if needed
    try {
      const jsonMatch = newContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        newContent =
          parsed.content ||
          parsed.titleOfInvention ||
          parsed.background?.paragraphs?.join("\n") ||
          parsed.summary?.content?.join("\n") ||
          newContent;

        if (Array.isArray(newContent)) {
          newContent = newContent.join("\n\n");
        }
      }
    } catch (e) {
      console.log("Using raw content (no JSON parsing needed)");
    }

    // Update the section
    if (!patent.sections[sectionKey]) {
      patent.sections[sectionKey] = {};
    }

    patent.sections[sectionKey].content = newContent;
    patent.sections[sectionKey].regenerated = true;
    patent.sections[sectionKey].regeneratedAt = new Date();

    await patent.save();

    res.json({
      success: true,
      message: "Section regenerated successfully",
      content: newContent,
    });
  } catch (error) {
    console.error("Regenerate section error:", error);
    res.status(500).json({
      message: "Failed to regenerate section",
      error: error.message,
    });
  }
});

// 4. UPDATE SPECIFIC SECTION (Editor)
router.put("/:id/section", async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionKey, content } = req.body;

    if (!sectionKey || !content) {
      return res.status(400).json({ message: "Missing data" });
    }

    const patent = await Patent.findOne({ publicId: id });
    if (!patent) return res.status(404).json({ message: "Not found" });

    if (!patent.sections[sectionKey]) {
      patent.sections[sectionKey] = {};
    }

    patent.sections[sectionKey].content = content;
    patent.sections[sectionKey].edited = true;

    if (!patent.metadata) patent.metadata = {};

    await patent.save();

    res.json({
      success: true,
      message: "Section updated",
      updatedSection: patent.sections[sectionKey],
    });
  } catch (error) {
    console.error("Update section error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- EXPORT PDF ---
router.get("/:id/export/pdf", async (req, res) => {
  try {
    const patent = await Patent.findOne({ publicId: req.params.id });
    if (!patent) return res.status(404).json({ message: "Not found" });

    // REMOVED: Payment check (403 Forbidden)

    const pdfPath = await generatePatentPDF(patent);

    res.download(pdfPath, `Patent-Draft-${patent._id}.pdf`, (err) => {
      if (err) console.error(err);
      try {
        fs.unlinkSync(pdfPath);
      } catch (e) {}
    });
  } catch (error) {
    console.error("PDF Export Error:", error);
    res.status(500).json({ message: "Failed to export PDF" });
  }
});

// --- EXPORT DOCX ---
router.get("/:id/export/docx", async (req, res) => {
  try {
    const patent = await Patent.findOne({ publicId: req.params.id });
    if (!patent) return res.status(404).json({ message: "Not found" });

    // REMOVED: Payment check (403 Forbidden)

    const docxPath = await generatePatentDOCX(patent);

    res.download(docxPath, `Patent-Draft-${patent._id}.docx`, (err) => {
      if (err) console.error(err);
      try {
        fs.unlinkSync(docxPath);
      } catch (e) {}
    });
  } catch (error) {
    console.error("DOCX Export Error:", error);
    res.status(500).json({ message: "Failed to export DOCX" });
  }
});

export default router;
