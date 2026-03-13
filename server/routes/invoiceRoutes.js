import express from "express";
import Invoice from "../models/Invoice.js";
import Docket from "../models/Docket.js";
import auth from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";
import checkPermission from "../middleware/checkPermission.js";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
} from "docx";
const router = express.Router();
const getUserMeta = (req) => ({
  userId: req.user?._id || req.user?.id || null,
  userName: req.user?.name || req.user?.email || "System",
});

function numberToWords(num) {
  if (num === 0) return "ZERO";
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  if (num < 0) return "MINUS " + numberToWords(Math.abs(num));
  if (num < 20) return ones[num];
  if (num < 100)
    return (
      tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + ones[num % 10] : "")
    );
  if (num < 1000) {
    return (
      ones[Math.floor(num / 100)] +
      " HUNDRED" +
      (num % 100 !== 0 ? " AND " + numberToWords(num % 100) : "")
    );
  }
  if (num < 100000) {
    return (
      numberToWords(Math.floor(num / 1000)) +
      " THOUSAND" +
      (num % 1000 !== 0 ? " " + numberToWords(num % 1000) : "")
    );
  }
  if (num < 10000000) {
    return (
      numberToWords(Math.floor(num / 100000)) +
      " LAKH" +
      (num % 100000 !== 0 ? " " + numberToWords(num % 100000) : "")
    );
  }
  return (
    numberToWords(Math.floor(num / 10000000)) +
    " CRORE" +
    (num % 10000000 !== 0 ? " " + numberToWords(num % 10000000) : "")
  );
}

// ============================================================
// HELPER: Generate Invoice PDF HTML (matches PHP template exactly)
// ============================================================
function generateInvoiceHTML(invoice) {
  const feeWords =
    numberToWords(Math.round(invoice.fee || 0)) +
    " " +
    (invoice.currency || "INR").toUpperCase() +
    " ONLY";

  const invoiceDate = invoice.invoice_date
    ? new Date(invoice.invoice_date)
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        })
        .toUpperCase()
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_no || ""}</title>
  <style>
    @page { margin: 0; size: 595.28pt 785.27pt; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 40px 50px; font-size: 8pt; color: #000; }
    .blue-text { color: #2F4D84; }
    .blue-texta { color: #3333CC; }
    .gold-text { color: #E6B830; }
    .grey-text { color: #808080; }
    .bold { font-weight: bold; }

    #header-table { width: 100%; border-collapse: collapse; height: 110px; }
    #header-table td { vertical-align: top; padding: 0; }
    .logo-cell { width: 250px; vertical-align: middle !important; }
    .logo-anov { display: inline-block; vertical-align: middle; font-size: 50px; font-weight: bold; letter-spacing: -2px; padding-right: 6px; }
    .logo-right-part { display: inline-block; vertical-align: middle; border-left: 1.5px solid #E6B830; padding-left: 8px; position: relative; }
    .logo-right-part::before { content: ''; position: absolute; left: 0; top: 52px; width: 100%; height: 1.5px; background-color: #E6B830; }
    .logo-ip { font-size: 40pt; font-weight: bold; display: block; line-height: 1; padding-bottom: 5px; }
    .logo-subtext { font-size: 6pt; letter-spacing: 1.5px; line-height: 1.2; display: block; padding-top: 5px; }
    .company-info { font-size: 7.5pt; line-height: 1.4; text-align: right; }
    .company-name { font-size: 11pt; font-weight: bold; margin-bottom: 8px; }

    #recipient { margin-top: 5px; font-size: 10pt; line-height: 1.5; }
    #invoice-meta { text-align: center; font-weight: bold; font-size: 8.5pt; margin-top: 20px; line-height: 1.5; font-family: Calibri, sans-serif; }

    #main-content { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 25px; font-family: Calibri, sans-serif; }
    #main-content > tbody > tr > td { padding: 8px 10px; vertical-align: top; font-size: 8pt; }
    .col-1 { width: 25%; border-right: 1px solid #000; font-size: 10pt; }
    .col-2 { width: 50%; border-right: 1px solid #000; font-size: 10pt; }
    .col-3 { width: 25%; }
    .section-title { font-size: 7pt; margin-bottom: 4px; }
    .ref-separator { margin: 43px 0 10px; border-top: 1px solid black; }
    .matter-details { line-height: 1.6; }
    .fee-breakdown { width: 60%; border-collapse: collapse; margin-top: 15px; }
    .fee-breakdown td { padding: 1.5px 0; }

    #footer { width: 85%; margin-top: 15px; font-size: 10pt; line-height: 1.5; font-family: Calibri, sans-serif; }
    #bank-details { width: 100%; border-collapse: collapse; border: none; table-layout: auto; font-family: Calibri, sans-serif; }
    #bank-details td { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 8px; vertical-align: top; }
    #bank-details tr:first-child td { border-top: none; }
    #bank-details tr:last-child td { border-bottom: none; }
    #bank-details td.label { border-left: none; border-right: 1px solid #000; white-space: nowrap; padding-right: 80px; font-weight: bold; width: 1%; }
    #bank-details td.value { border-left: none; border-right: none; width: auto; }
    #page-footer { text-align: center; font-size: 9pt; font-weight: bold; }
  </style>
</head>
<body>
  <table id="header-table">
    <tr>
      <td class="logo-cell">
        <span class="logo-anov blue-text">anov</span><div class="logo-right-part">
          <span class="logo-ip gold-text">IP</span>
          <div class="logo-subtext grey-text">ATTORNEYS<br>AGENTS &amp;<br>ASSOCIATES</div>
        </div>
      </td>
      <td>
        <div class="company-name blue-text" style="margin-right: 18px;">anovIP Asia</div>
      </td>
      <td>
        <div class="company-info blue-text" style="text-align: justify;">
          45/1, Floor No: 3, Corner<br> Market, Malviya Nagar,<br>
          New Delhi - 110 017, INDIA
          <div style="margin-top: 8px;">Ph: +91-11- 4183 5550<br>Fax: +91-11- 4183 5551</div>
        </div>
      </td>
      <td>
        <div class="company-info blue-text" style="text-align: justify;">
          161-B/4, 6th Floor, Gulmohar House,<br>
          Yusuf Sarai Community Center Gautam Nagar,<br>
          Green Park New Delhi – 110049, INDIA
          <div style="margin-top: 12px;">Email: info@anovip.com<br>Website: www.anovip.com</div>
        </div>
      </td>
    </tr>
  </table>

  <div id="recipient">
    <span class="gold-text bold">TO,</span><br>
    <div style="padding-left: 1.5em; width:250px;">
      ${invoice.spoc_name || ""}<br>
      <b>${invoice.firm_name || ""}</b><br>
      ${(invoice.address || "").replace(/\n/g, "<br>")}<br>
      ${invoice.country || ""}<br>
      TEL.: ${invoice.phone_no || ""}<br>
      EMAIL: ${invoice.email || ""}
    </div>
  </div>

  <div id="invoice-meta">
    ${invoiceDate} | NEW DELHI, INDIA<br>
    <span class="gold-text">INVOICE NO: ${invoice.invoice_no || ""}</span>
  </div>
  <br><br>

  <table id="main-content" style="border: none; border-collapse: collapse;">
    <tr>
      <td class="col-1">
        <div class="section-title blue-texta">YOUR REF:</div>
        <div class="bold">${invoice.client_ref || ""}</div>
        <div class="ref-separator"></div>
        <div class="section-title blue-texta">OUR REF:</div>
        <div class="bold">${invoice.docket_no || ""}</div>
      </td>
      <td class="col-2">
        <div class="section-title blue-texta">IN MATTER OF:</div>
        <div class="matter-details">
          ${(invoice.application_type || "").toUpperCase()} PATENT APPLICATION – ${(invoice.country || "").toUpperCase()}<br>
          ${invoice.corresponding_application_no ? `CORRESPONDING APPLICATION NO. <span class="bold">${invoice.corresponding_application_no.toUpperCase()}</span><br>` : ""}
          TITLE: "${(invoice.title || "").toUpperCase()}"<br>
          INDIAN PATENT APPLICATION NUMBER: <span class="bold">${invoice.application_number || ""}</span>
        </div>
        <div class="section-title blue-texta" style="margin-top: 15px;">FEE FOR PREPARING AND FILING OF <span class="bold">${invoice.worktype || ""}</span></div>
        <table class="fee-breakdown">
          <tr>
            <td><span class="bold">OFFICIAL FEE:</span></td>
            <td style="text-align: right;">${(invoice.currency || "").toUpperCase()} ${Number(invoice.officialfee || 0).toLocaleString()}</td>
          </tr>
          <tr>
            <td><span class="bold">PROFESSIONAL FEE:</span></td>
            <td style="text-align: right;">${(invoice.currency || "").toUpperCase()} ${Number(invoice.associatefee || 0).toLocaleString()}</td>
          </tr>
          <tr>
            <td><span class="bold">DISBURSEMENTS:</span></td>
            <td style="text-align: right;">${(invoice.currency || "").toUpperCase()} ${Number(invoice.anovipfee || 0).toLocaleString()}</td>
          </tr>
        </table>
      </td>
      <td class="col-3">
        <div class="section-title blue-texta">NET PAYABLE</div>
        <div class="bold" style="font-size: 9pt;">${(invoice.currency || "").toUpperCase()} ${Number(invoice.fee || 0).toLocaleString()}</div>
        <div class="ref-separator"></div>
        <div class="section-title blue-texta">NET PAYABLE (WORDS)</div>
        <div class="bold">${feeWords}</div>
      </td>
    </tr>
  </table>

  <div id="footer">
    <div class="thank-you">
      Thank you for your business. We look forward to working with you again soon.<br>
      Kindly remit the above calculated amount (net of bank charges) to below mentioned account:
    </div>
    <br>
    <table id="bank-details">
      <tr><td class="label blue-texta">BANK NAME</td><td class="value"><b>${invoice.bank_name || ""}</b></td></tr>
      <tr><td class="label blue-texta">BANK ADDRESS</td><td class="value"><b>${(invoice.bank_address || "").replace(/\n/g, "<br>")}</b></td></tr>
      <tr><td class="label blue-texta">BENEFICIARY ACCOUNT NAME</td><td class="value"><b>${invoice.beneficiary_account_name || ""}</b></td></tr>
      <tr><td class="label blue-texta">ACCOUNT NO.</td><td class="value"><b>${invoice.account_no || ""}</b></td></tr>
      <tr><td class="label blue-texta">SWIFT CODE</td><td class="value"><b>${invoice.swift_code || ""}</b></td></tr>
      <tr><td class="label blue-texta">IFSC CODE</td><td class="value"><b>${invoice.ifsc_code || ""}</b></td></tr>
      <tr><td class="label blue-texta">PAYPAL</td><td class="value"><b>${invoice.paypal || ""}</b></td></tr>
    </table>
    <br><br>
    <div id="page-footer" class="blue-text">
      PATENTS <span class="gold-text">|</span> TRADEMARKS <span class="gold-text">|</span> COPYRIGHTS <span class="gold-text">|</span> DESIGNS <span class="gold-text">|</span> DOMAIN NAMES
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// @route   GET /api/invoices/status-counts
// @desc    Get invoice status counts for stats cards
// ============================================================
router.get("/status-counts", auth, async (req, res) => {
  try {
    const total = await Invoice.countDocuments({});
    const draft = await Invoice.countDocuments({ status: "Draft" });
    const sent = await Invoice.countDocuments({ status: "Sent" });
    const paid = await Invoice.countDocuments({ status: "Paid" });
    const overdue = await Invoice.countDocuments({ status: "Overdue" });

    // Calculate total revenue (sum of paid invoices total_with_gst)
    const revenueResult = await Invoice.aggregate([
      { $match: { status: "Paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total_with_gst" } } },
    ]);
    const revenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.json({ total, draft, sent, paid, overdue, revenue });
  } catch (err) {
    console.error("Invoice status counts error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// @route   GET /api/invoices/next-number
// @desc    Get next invoice number
// ============================================================
router.get("/next-number", auth, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const lastInvoice = await Invoice.findOne({
      invoice_no: { $regex: `^INV-${year}-` },
    }).sort({ createdAt: -1 });

    let nextNum = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoice_no.split("-");
      nextNum = parseInt(parts[2] || "0") + 1;
    }

    const nextInvoiceNo = `INV-${year}-${String(nextNum).padStart(3, "0")}`;
    res.json({ invoice_no: nextInvoiceNo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// @route   GET /api/invoices/docket-lookup/:docketId
// @desc    Fetch docket data for pre-filling invoice
// ============================================================
router.get("/docket-lookup/:docketId", auth, async (req, res) => {
  try {
    const docket = await Docket.findById(req.params.docketId).populate(
      "client_id",
      "name email",
    );
    if (!docket) {
      return res.status(404).json({ message: "Docket not found" });
    }
    res.json(docket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// @route   POST /api/invoices
// @desc    Create new invoice
// ============================================================
router.post("/", auth, checkPermission, async (req, res) => {
  try {
    if (!req.body.invoice_no || !req.body.docket_id) {
      return res
        .status(400)
        .json({ message: "Invoice number and docket are required." });
    }

    // Check for duplicate invoice_no
    const existing = await Invoice.findOne({
      invoice_no: req.body.invoice_no.trim(),
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Invoice number already exists." });
    }

    const newInvoice = new Invoice({
      ...req.body,
      created_by: req.user._id,
    });

    const saved = await newInvoice.save();
    await saved.populate("created_by", "name email");
    await saved.populate("client_id", "name email");
    const { userId, userName } = getUserMeta(req); // ← add before res.json

    await logActivity({
      type: "invoice_created",
      description: `Invoice ${saved.invoice_no} created for ${saved.firm_name || saved.docket_no || "client"}`,
      userId,
      userName,
      entityId: saved._id,
      entityType: "invoice",
      metadata: {
        invoice_no: saved.invoice_no,
        fee: saved.fee,
        currency: saved.currency,
        status: saved.status,
      },
    });
    res.status(201).json({
      status: "success",
      message: "Invoice created successfully",
      data: saved,
    });
  } catch (err) {
    console.error("Creating Invoice error:", err);
    res.status(400).json({ status: "error", message: err.message });
  }
});

// ============================================================
// @route   GET /api/invoices
// @desc    Get all invoices with filtering, pagination, sorting
// ============================================================
router.get("/", auth, checkPermission, async (req, res) => {
  try {
    let query = {};
    const {
      start_date,
      end_date,
      invoice_no,
      client_id,
      status,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    if (start_date || end_date) {
      query.invoice_date = {};
      if (start_date) query.invoice_date.$gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        query.invoice_date.$lte = endDate;
      }
    }

    if (invoice_no) query.invoice_no = { $regex: invoice_no, $options: "i" };
    if (client_id) query.client_id = client_id;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(query)
      .populate("created_by", "name email")
      .populate("client_id", "name email")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 });

    const count = await Invoice.countDocuments(query);

    res.json({
      invoices,
      totalPages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      totalRecords: count,
    });
  } catch (err) {
    console.error("Fetching Invoices error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// @route   GET /api/invoices/:id
// @desc    Get single invoice
// ============================================================
router.get("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("created_by", "name email")
      .populate("client_id", "name email")
      .populate("docket_id");

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.json({ status: "success", data: invoice });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// @route   PUT /api/invoices/:id
// @desc    Update invoice
// ============================================================
router.put("/:id", auth, checkPermission, async (req, res) => {
  try {
    const existing = await Invoice.findById(req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ status: "error", message: "Invoice not found" });

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.__v;

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const updated = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .populate("created_by", "name email")
      .populate("client_id", "name email");
    const { userId, userName } = getUserMeta(req);

    await logActivity({
      type: "invoice_updated",
      description: `Invoice ${updated.invoice_no} updated — status: ${updated.status}`,
      userId,
      userName,
      entityId: updated._id,
      entityType: "invoice",
      metadata: {
        invoice_no: updated.invoice_no,
        status: updated.status,
        fee: updated.fee,
      },
    });

    res.json({
      status: "success",
      message: "Invoice updated successfully",
      data: updated,
    });
    res.json({
      status: "success",
      message: "Invoice updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Updating Invoice error:", err);
    res.status(400).json({ status: "error", message: err.message });
  }
});

// ============================================================
// @route   DELETE /api/invoices/:id
// @desc    Delete invoice
// ============================================================
router.delete("/:id", auth, checkPermission, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice)
      return res
        .status(404)
        .json({ status: "error", message: "Invoice not found" });

    await Invoice.findByIdAndDelete(req.params.id);

    const { userId, userName } = getUserMeta(req);

    await logActivity({
      type: "invoice_deleted",
      description: `Invoice ${invoice.invoice_no} deleted`,
      userId,
      userName,
      entityId: invoice._id,
      entityType: "invoice",
      metadata: {
        invoice_no: invoice.invoice_no,
        fee: invoice.fee,
        status: invoice.status,
      },
    });

    res.json({ status: "success", message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("Deleting Invoice error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ============================================================
// @route   GET /api/invoices/:id/pdf
// @desc    Generate PDF for invoice (returns HTML for client-side PDF)
// ============================================================
router.get("/:id/pdf", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const html = generateInvoiceHTML(invoice.toObject());

    // Return HTML so frontend can generate PDF using window.print() or a library
    res.json({ status: "success", html });
  } catch (err) {
    console.error("Generating PDF error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// @route   GET /api/invoices/:id/pdf-download
// @desc    Generate and stream PDF using puppeteer (server-side)
// ============================================================
router.get("/:id/pdf-download", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const html = generateInvoiceHTML(invoice.toObject());

    // Try puppeteer first, fallback to HTML response
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        width: "595.28pt",
        height: "785.27pt",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      await browser.close();

      const filename = `Invoice_${invoice.invoice_no || "NA"}.pdf`;
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length,
      });
      res.send(pdfBuffer);
    } catch (puppeteerErr) {
      // Fallback: return HTML for client-side rendering
      console.warn(
        "Puppeteer not available, returning HTML:",
        puppeteerErr.message,
      );
      res.json({ status: "fallback", html });
    }
  } catch (err) {
    console.error("PDF Download error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/word", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("client_id", "name email") // Ensure client name is fetched
      .populate("docket_id");

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    // Helper for colors
    const COLOR_BLUE = "2F4D84";
    const COLOR_GOLD = "E6B830";
    const COLOR_GREY = "808080";

    // Prepare Data
    const feeWords =
      numberToWords(Math.round(invoice.fee || 0)) +
      " " +
      (invoice.currency || "INR").toUpperCase() +
      " ONLY";
    const invoiceDate = invoice.invoice_date
      ? new Date(invoice.invoice_date)
          .toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "2-digit",
          })
          .toUpperCase()
      : "";

    // Create Document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // --- HEADER TABLE (Simulated) ---
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
              },
              rows: [
                new TableRow({
                  children: [
                    // Logo / Brand Column
                    new TableCell({
                      width: { size: 40, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "anov",
                              font: "Arial",
                              size: 60,
                              bold: true,
                              color: COLOR_BLUE,
                            }),
                            new TextRun({
                              text: "IP",
                              font: "Arial",
                              size: 60,
                              bold: true,
                              color: COLOR_GOLD,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "ATTORNEYS, AGENTS & ASSOCIATES",
                              size: 14,
                              color: COLOR_GREY,
                            }),
                          ],
                        }),
                      ],
                    }),
                    // Address Column
                    new TableCell({
                      width: { size: 60, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: "anovIP Asia",
                              bold: true,
                              color: COLOR_BLUE,
                              size: 22,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: "45/1, Floor No: 3, Corner Market, Malviya Nagar, New Delhi - 110 017, INDIA",
                              size: 16,
                              color: COLOR_BLUE,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: "Email: info@anovip.com | Website: www.anovip.com",
                              size: 16,
                              color: COLOR_BLUE,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: "" }), // Spacer

            // --- RECIPIENT ---
            new Paragraph({
              children: [
                new TextRun({
                  text: "TO,",
                  bold: true,
                  color: COLOR_GOLD,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 720 }, // Indent
              children: [
                new TextRun({
                  text: (invoice.spoc_name || "") + "\n",
                  size: 20,
                }),
                new TextRun({
                  text: (invoice.firm_name || "") + "\n",
                  bold: true,
                  size: 20,
                }),
                new TextRun({ text: (invoice.address || "") + "\n", size: 20 }),
                new TextRun({
                  text: (invoice.country || "").toUpperCase(),
                  size: 20,
                }),
              ],
            }),

            new Paragraph({ text: "" }), // Spacer

            // --- INVOICE META ---
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${invoiceDate} | NEW DELHI, INDIA`,
                  bold: true,
                  size: 18,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `INVOICE NO: ${invoice.invoice_no}`,
                  bold: true,
                  color: COLOR_GOLD,
                  size: 20,
                }),
              ],
            }),

            new Paragraph({ text: "" }), // Spacer

            // --- MAIN BODY TABLE ---
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    // Col 1: Refs
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "YOUR REF:",
                              color: "3333CC",
                              size: 16,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: invoice.client_ref || "-",
                              bold: true,
                              size: 18,
                            }),
                          ],
                        }),
                        new Paragraph({ text: "" }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "OUR REF:",
                              color: "3333CC",
                              size: 16,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: invoice.docket_no || "-",
                              bold: true,
                              size: 18,
                            }),
                          ],
                        }),
                      ],
                    }),
                    // Col 2: Details
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "IN MATTER OF:",
                              color: "3333CC",
                              size: 16,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `${invoice.application_type} - ${invoice.country}`,
                              size: 18,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `App No: ${invoice.application_number || "-"}`,
                              bold: true,
                              size: 18,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `Title: ${invoice.title || "-"}`,
                              size: 18,
                            }),
                          ],
                        }),
                        new Paragraph({ text: "" }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "FEE BREAKDOWN:",
                              color: "3333CC",
                              size: 16,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `Professional Fee: ${invoice.currency} ${invoice.associatefee}`,
                              size: 18,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `Official Fee: ${invoice.currency} ${invoice.officialfee}`,
                              size: 18,
                            }),
                          ],
                        }),
                      ],
                    }),
                    // Col 3: Totals
                    new TableCell({
                      width: { size: 25, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "NET PAYABLE",
                              color: "3333CC",
                              size: 16,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `${invoice.currency} ${invoice.fee}`,
                              bold: true,
                              size: 20,
                            }),
                          ],
                        }),
                        new Paragraph({ text: "" }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: "IN WORDS",
                              color: "3333CC",
                              size: 16,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [new TextRun({ text: feeWords, size: 16 })],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: "" }),

            // --- BANK DETAILS ---
            new Paragraph({
              children: [
                new TextRun({
                  text: "BANK DETAILS",
                  bold: true,
                  underline: { type: "single" },
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                ["BANK NAME", invoice.bank_name],
                ["ACCOUNT NO", invoice.account_no],
                ["SWIFT CODE", invoice.swift_code],
                ["IFSC CODE", invoice.ifsc_code],
              ].map(
                ([label, value]) =>
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: label,
                                bold: true,
                                size: 16,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: value || "-", size: 16 }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            }),
          ],
        },
      ],
    });

    // Generate and Send
    const buffer = await Packer.toBuffer(doc);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice_${invoice.invoice_no}.docx`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.send(buffer);
  } catch (err) {
    console.error("Word Gen Error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
