import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to strip HTML tags and decode entities
const cleanText = (text) => {
  if (!text) return "";

  // 1. Handle arrays (e.g. claims)
  if (Array.isArray(text)) {
    return text.map((item) => cleanText(item)).join("\n\n");
  }

  let str = String(text);

  // 2. Replace <br> and </p> with newlines to preserve formatting
  str = str.replace(/<br\s*\/?>/gi, "\n");
  str = str.replace(/<\/p>/gi, "\n\n");
  str = str.replace(/<\/li>/gi, "\n");

  // 3. Strip all other HTML tags
  str = str.replace(/<[^>]+>/g, "");

  // 4. Decode common HTML entities
  str = str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 5. Clean up extra whitespace and non-printable characters
  // Keep basic punctuation and text, remove weird control chars
  return str.replace(/[^\x20-\x7E\n\r\t]/g, "").trim();
};

export const generatePatentPDF = async (patent) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: cleanText(patent.sections?.title?.content) || "Patent Draft",
          Author: "PatDots.ai",
        },
      });

      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filename = `patent-${patent._id}-${Date.now()}.pdf`;
      const filepath = path.join(tempDir, filename);
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      // --- Title Page ---
      doc.moveDown(4);
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .text(cleanText(patent.sections?.title?.content), {
          align: "center",
        });

      doc.moveDown(2);
      doc
        .font("Helvetica")
        .fontSize(12)
        .text("PROVISIONAL PATENT APPLICATION", {
          align: "center",
        });

      doc.moveDown(4);
      doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, {
        align: "center",
      });

      doc.addPage();

      // Helper to add sections
      const addSection = (heading, content) => {
        if (!content) return;

        doc.font("Helvetica-Bold").fontSize(14).text(heading.toUpperCase(), {
          align: "center",
        });
        doc.moveDown(0.5);

        // Use cleanText to remove HTML from the content
        doc.font("Helvetica").fontSize(12).text(cleanText(content), {
          align: "justify",
          lineGap: 4,
          paragraphGap: 10,
        });

        doc.moveDown(2);
      };

      // Add Sections
      if (patent.sections?.abstract?.content) {
        addSection("Abstract", patent.sections.abstract.content);
      }

      if (patent.sections?.field?.content) {
        addSection("Field of the Invention", patent.sections.field.content);
      }

      if (patent.sections?.background) {
        const bgContent =
          patent.sections.background.content ||
          patent.sections.background.paragraphs;
        addSection("Background", bgContent);
      }

      if (patent.sections?.summary?.content) {
        addSection("Summary of the Invention", patent.sections.summary.content);
      }

      if (patent.sections?.description?.content) {
        doc.addPage();
        addSection("Detailed Description", patent.sections.description.content);
      }

      if (patent.sections?.advantages?.content) {
        addSection("Advantages", patent.sections.advantages.content);
      }

      if (patent.sections?.claims?.content) {
        doc.addPage();
        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .text("CLAIMS", { align: "center" });
        doc.moveDown();

        const claims = Array.isArray(patent.sections.claims.content)
          ? patent.sections.claims.content
          : [patent.sections.claims.content];

        doc.font("Helvetica").fontSize(12);

        claims.forEach((claim, index) => {
          if (!claim) return;
          // Clean text for each claim
          doc.text(`${index + 1}. ${cleanText(claim)}`, {
            align: "justify",
            lineGap: 4,
            paragraphGap: 8,
          });
        });
      }

      doc.end();

      stream.on("finish", () => {
        resolve(filepath);
      });

      stream.on("error", (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const cleanupTempFiles = async (filepath) => {
  try {
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  } catch (error) {
    console.error("Error cleaning up temp file:", error);
  }
};
