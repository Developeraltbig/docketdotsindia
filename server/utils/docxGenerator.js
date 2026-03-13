import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Footer,
  PageNumber,
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// NUCLEAR SANITIZATION FOR WORD/XML
// =========================================================

const cleanTextForDocx = (input) => {
  if (!input) return "";
  let text = String(input);

  // 1. Structure: Convert HTML blocks to Newlines
  text = text
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n");

  // 2. Strip ALL HTML Tags
  text = text.replace(/<[^>]+>/g, "");

  // 3. Decode HTML Entities (Manual map to avoid external dependencies)
  const entities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&rsquo;": "'",
    "&lsquo;": "'",
    "&rdquo;": '"',
    "&ldquo;": '"',
    "&ndash;": "-",
    "&mdash;": "--",
    "&copy;": "(c)",
    "&reg;": "(r)",
  };
  text = text.replace(/&[a-z0-9]+;/gi, (match) => entities[match] || "");

  // 4. CRITICAL: XML 1.0 VALID CHARACTERS ONLY
  // This regex removes control characters that crash Word (like vertical tabs, nulls, etc)
  // It allows: Tab (\x09), Line Feed (\x0A), Carriage Return (\x0D), and valid text ranges
  // eslint-disable-next-line no-control-regex
  text = text.replace(
    /[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]/g,
    ""
  );

  return text.trim();
};

// Helper to convert text content into DOCX Paragraphs
const processContent = (content) => {
  if (!content) return [];

  let cleanString = "";

  // Flatten array (like claims) or use string
  if (Array.isArray(content)) {
    cleanString = content.map((item) => cleanTextForDocx(item)).join("\n\n");
  } else {
    cleanString = cleanTextForDocx(content);
  }

  // Split by newlines to create separate paragraphs
  // This handles the \n we added during HTML cleaning
  const lines = cleanString.split(/\n+/);

  return lines
    .map((line) => {
      const safeText = line.trim();
      if (!safeText) return null;

      return new Paragraph({
        children: [
          new TextRun({
            text: safeText,
            size: 24, // 12pt
            font: "Times New Roman", // Safe standard font
          }),
        ],
        spacing: {
          after: 200, // Space after paragraph
          line: 360, // 1.5 line spacing
        },
        alignment: AlignmentType.JUSTIFIED,
      });
    })
    .filter(Boolean); // Remove empty paragraphs
};

export const generatePatentDOCX = async (patent) => {
  try {
    const sections = [];

    // --- 1. TITLE PAGE ---
    sections.push(
      new Paragraph({
        text: cleanTextForDocx(
          patent.sections?.title?.content || "Patent Draft"
        ).toUpperCase(),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 800, after: 400 },
      }),
      new Paragraph({
        text: "PROVISIONAL PATENT APPLICATION",
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      })
      // new PageBreak()
    );

    // --- Helper to Add Patent Sections ---
    const addDocSection = (heading, content) => {
      // Skip if empty
      if (!content || (Array.isArray(content) && content.length === 0)) return;

      // Heading
      sections.push(
        new Paragraph({
          text: heading.toUpperCase(),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 300 },
        })
      );

      // Body
      sections.push(...processContent(content));

      // Spacer
      sections.push(new Paragraph({ text: "" }));
    };

    // --- 2. ADD SECTIONS ---
    if (patent.sections?.abstract?.content) {
      addDocSection("Abstract", patent.sections.abstract.content);
    }
    if (patent.sections?.field?.content) {
      addDocSection("Field of the Invention", patent.sections.field.content);
    }
    if (patent.sections?.background) {
      const bg =
        patent.sections.background.content ||
        patent.sections.background.paragraphs;
      addDocSection("Background", bg);
    }
    if (patent.sections?.summary?.content) {
      addDocSection("Summary", patent.sections.summary.content);
    }
    if (patent.sections?.description?.content) {
      // sections.push(new PageBreak());
      addDocSection(
        "Detailed Description",
        patent.sections.description.content
      );
    }
    if (patent.sections?.advantages?.content) {
      addDocSection("Advantages", patent.sections.advantages.content);
    }

    // --- 4. BUILD DOCUMENT ---
    const doc = new Document({
      creator: "PatDots.ai",
      description: "Provisional Patent Application",
      title: "Patent Draft",
      sections: [
        {
          properties: {},
          children: sections,
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      children: [PageNumber.CURRENT],
                    }),
                  ],
                }),
              ],
            }),
          },
        },
      ],
    });

    // --- 5. WRITE FILE ---
    const buffer = await Packer.toBuffer(doc);

    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `patent-${patent._id}-${Date.now()}.docx`;
    const filepath = path.join(tempDir, filename);

    await fs.promises.writeFile(filepath, buffer);

    return filepath;
  } catch (error) {
    console.error("DOCX Gen Error:", error);
    throw error;
  }
};
