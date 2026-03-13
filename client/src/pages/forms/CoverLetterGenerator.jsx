import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

/* ─────────── Helpers ─────────── */
const formatDate = (dateStr) => {
  if (!dateStr) return "_______________";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "_______________";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const numberToWords = (num) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  if (num < 20) return ones[num];
  if (num < 100)
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
  return num.toString();
};

/* ─────────── Constants ─────────── */
const AGENT = {
  nameUpper: "AMIT ASWAL",
  regNo: "2185",
  firm: "anovIP",
};

const PATENT_OFFICES = {
  "New Delhi": "New Delhi",
  Mumbai: "Mumbai",
  Kolkata: "Kolkata",
  Chennai: "Chennai",
};

/* ─────────── Data Transform ─────────── */
const transformData = (dbData) => {
  if (!dbData) return null;
  const applicantNames =
    (dbData.applicants || [])
      .map((a) => a.name)
      .filter(Boolean)
      .join("; ") || "_______________";
  const claimsCount = parseInt(dbData.claims_count) || 10;
  const pagesCount = parseInt(dbData.pages_count) || 30;
  const priorityCount = parseInt(dbData.priority_count) || 1;

  const baseFee = 8000;
  const extraPages = Math.max(0, pagesCount - 30);
  const extraClaims = Math.max(0, claimsCount - 10);
  const extraPriority = Math.max(0, priorityCount - 1);
  const extraPagesFee = extraPages * 800;
  const extraClaimsFee = extraClaims * 1600;
  const extraPriorityFee = extraPriority * 8000;
  const rfeFee = 28000;
  const sequenceFee = 0;
  const totalFee =
    baseFee +
    extraPagesFee +
    extraClaimsFee +
    extraPriorityFee +
    rfeFee +
    sequenceFee;

  return {
    docketNo: dbData.DOC_NO?.trim() || "",
    internalRef: dbData.internal_ref || dbData.DOC_NO?.trim() || "",
    patentOffice: PATENT_OFFICES[dbData.jurisdiction] || "New Delhi",
    filingDate: dbData.deposit_date || "",
    inventionTitle: dbData.title || "",
    pctAppNo: dbData.pct_app_no || "_______________",
    applicantName: applicantNames,
    claimsCount,
    pagesCount,
    priorityCount,
    baseFee,
    extraPages,
    extraClaims,
    extraPriority,
    extraPagesFee,
    extraClaimsFee,
    extraPriorityFee,
    rfeFee,
    sequenceFee,
    totalFee,
  };
};

/* ─────────── anovIP SVG Logo ─────────── */
const AnovIPLogo = () => (
  <svg
    width="165"
    height="82"
    viewBox="0 0 165 82"
    xmlns="http://www.w3.org/2000/svg"
  >
    <text
      x="0"
      y="44"
      fontFamily="Cambria, Georgia, serif"
      fontWeight="bold"
      fontSize="38"
      fill="#002060"
      letterSpacing="-1"
    >
      anov
    </text>
    {/* vertical gold bar */}
    <rect x="103" y="6" width="3" height="58" fill="#E36C0A" />
    {/* "IP" text */}
    <text
      x="112"
      y="44"
      fontFamily="Cambria, Georgia, serif"
      fontWeight="bold"
      fontSize="42"
      fill="#E36C0A"
    >
      IP
    </text>
    {/* underline beneath IP */}
    <line
      x1="112"
      y1="48"
      x2="157"
      y2="48"
      stroke="#E36C0A"
      strokeWidth="1.5"
    />
    {/* Small cap text: ATTORNEYS / AGENTS & / ASSOCIATES */}
    <text
      x="112"
      y="57"
      fontFamily="Calibri, Arial, sans-serif"
      fontSize="8"
      fill="#002060"
      letterSpacing="2"
      fontWeight="400"
    >
      ATTORNEYS
    </text>
    <text
      x="112"
      y="66"
      fontFamily="Calibri, Arial, sans-serif"
      fontSize="8"
      fill="#002060"
      letterSpacing="2"
      fontWeight="400"
    >
      AGENTS &amp;
    </text>
    <text
      x="108"
      y="75"
      fontFamily="Calibri, Arial, sans-serif"
      fontSize="7.5"
      fill="#002060"
      letterSpacing="1.8"
      fontWeight="400"
    >
      ASSOCIATES
    </text>
  </svg>
);

/* ─────────── Document Header ─────────── */
const DocHeader = ({ patentOffice }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "0",
      paddingBottom: "0",
    }}
  >
    {/* LEFT: Logo */}
    <div style={{ width: "45%", paddingTop: "4px" }}>
      <AnovIPLogo />
    </div>

    {/* RIGHT: Address block */}
    <div
      style={{
        width: "52%",
        textAlign: "right",
        fontFamily: "'Calibri', 'Gill Sans', Arial, sans-serif",
        fontSize: "9pt",
        color: "#333",
        lineHeight: "1.5",
      }}
    >
      <p
        style={{
          fontFamily: "Cambria, Georgia, serif",
          fontWeight: "bold",
          fontSize: "16px",
          marginBottom: 0,
          color: "#002060",
        }}
      >
        anovIP
      </p>

      <p style={{ margin: "0" }}>161-B/4, 6th Floor, Gulmohar House,</p>
      <p style={{ margin: "0" }}>Yusuf Sarai Community Center, Gautam Nagar,</p>
      <p style={{ margin: "0" }}>Green Park, New Delhi, India – 110 049</p>
      <p style={{ margin: "4px 0 0 0" }}>
        P: +91-11-41835550{" "}
        <span style={{ color: "#E36C0A", fontWeight: "bold" }}>|</span> F:
        +91-11-41835551
      </p>
      <p style={{ margin: "0" }}>
        E: info@anovip.com{" "}
        <span style={{ color: "#E36C0A", fontWeight: "bold" }}>|</span> W:
        www.anovip.com
      </p>
    </div>
  </div>
);

/* ─────────── Document Footer ─────────── */
const DocFooter = () => (
  <div
    style={{
      borderTop: "1.5px solid #E36C0A",
      marginTop: "10px",
      paddingTop: "6px",
      textAlign: "center",
      fontFamily: "Cambria, Georgia, serif",
      fontWeight: "bold",
      fontSize: "11pt",
    }}
  >
    <span style={{ color: "#E36C0A" }}>PATENTS</span>
    {"    "}
    <span style={{ color: "#0070C0" }}>|</span>
    {"    "}
    <span style={{ color: "#E36C0A" }}>TRADEMARKS</span>
    {"    "}
    <span style={{ color: "#0070C0" }}>|</span>
    {"   "}
    <span style={{ color: "#E36C0A" }}>COPYRIGHTS</span>
    {"   "}
    <span style={{ color: "#0070C0" }}>| </span>
    {"  "}
    <span style={{ color: "#E36C0A" }}>DESIGNS</span>
    {"   "}
    <span style={{ color: "#0070C0" }}>|</span>
    {"   "}
    <span style={{ color: "#E36C0A" }}>DOMAIN NAMES</span>
  </div>
);

/* ─────────── Main Component ─────────── */
export default function CoverLetterGenerator({ formData, onClose }) {
  const contentRef = useRef();
  const d = transformData(formData);

  if (!d) {
    return (
      <div
        className="modal show d-block"
        style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5>Cover Letter</h5>
              <button className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body text-center p-5">
              <p>No application data available.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const downloadPDF = () => {
    const element = contentRef.current;
    const opt = {
      margin: [0, 0, 0, 0],
      filename: `CoverLetter_${d.docketNo || "Patent"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };
    html2pdf().set(opt).from(element).save();
  };

  const downloadDOCX = () => {
    const content = contentRef.current.innerHTML;
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'>
      <style>
        body { font-family: Calibri, sans-serif; font-size: 11pt; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 8px; font-size: 11pt; }
      </style>
      </head>
      <body>${content}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CoverLetter_${d.docketNo || "Patent"}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ── Page styles matching the docx ── */
  const pageStyle = {
    fontFamily: "'Calibri', 'Gill Sans', Arial, sans-serif",
    fontSize: "11pt",
    lineHeight: "1.15",
    /* A4 with docx margins: top 1.575", right 1.18", bottom 1.18", left 1.575" */
    padding: "56.7px 42.5px 42.5px 56.7px",
    background: "white",
    maxWidth: "210mm",
    margin: "0 auto",
    boxSizing: "border-box",
    minHeight: "297mm",
    display: "flex",
    flexDirection: "column",
  };

  const bodyStyle = {
    flex: 1,
    fontSize: "11pt",
    fontFamily: "'Calibri', 'Gill Sans', Arial, sans-serif",
  };

  const pStyle = {
    margin: "0 0 0 0",
    textAlign: "justify",
    lineHeight: "1.38",
  };
  const pSpaced = { ...pStyle, margin: "6px 0" };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          {/* Modal header with action buttons */}
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title fw-semibold">
              Cover Letter Preview — {d.docketNo}
            </h5>
            <div className="d-flex gap-2 align-items-center">
              <button className="btn btn-danger btn-sm" onClick={downloadPDF}>
                ⬇ PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={downloadDOCX}>
                ⬇ DOCX
              </button>
              <button className="btn-close" onClick={onClose}></button>
            </div>
          </div>

          {/* Document preview area */}
          <div
            className="modal-body"
            style={{ background: "#8a8a8a", padding: "24px" }}
          >
            <div ref={contentRef} style={pageStyle}>
              {/* ── HEADER ── */}
              <DocHeader patentOffice={d.patentOffice} />

              {/* Thin rule under header */}
              <div
                style={{
                  borderBottom: "1.5px solid #002060",
                  margin: "8px 0 12px 0",
                }}
              />

              {/* ── DATE + LOCATION ── */}
              <div style={{ body: bodyStyle }}>
                <p
                  style={{
                    ...pStyle,
                    textAlign: "right",
                    fontWeight: "bold",
                    fontSize: "11pt",
                    marginBottom: "2px",
                  }}
                >
                  {formatDate(d.filingDate)} | {d.patentOffice}, India
                </p>

                {/* anovIP Ref */}
                <p
                  style={{
                    ...pStyle,
                    textAlign: "right",
                    fontWeight: "bold",
                    fontSize: "11pt",
                    marginBottom: "14px",
                  }}
                >
                  anovIP Ref: {d.internalRef}
                </p>

                {/* ── ADDRESSEE ── */}
                <p style={{ ...pStyle, fontWeight: "bold", marginTop: "2px" }}>
                  To,
                </p>
                <p
                  style={{
                    ...pStyle,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    color: "#222222",
                    fontFamily: "Cambria, Georgia, serif",
                  }}
                >
                  The Controller General of Patents,
                </p>
                <p
                  style={{
                    ...pStyle,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    color: "#222222",
                    fontFamily: "Cambria, Georgia, serif",
                  }}
                >
                  Designs, and Trade Marks
                </p>
                <p style={{ ...pStyle, color: "#222222" }}>
                  Boudhik Sampada Bhawan,
                </p>
                <p style={{ ...pStyle, color: "#222222" }}>
                  Plot No. 32, Sector 14
                </p>
                <p
                  style={{ ...pStyle, color: "#222222", marginBottom: "16px" }}
                >
                  Dwarka, {d.patentOffice} – 110078, India
                </p>

                {/* ── SUBJECT LINE ── */}
                <div
                  style={{
                    borderBottom: "2px solid #4F81BD",
                    paddingBottom: "2px",
                    marginBottom: "2px",
                  }}
                />
                <p
                  style={{
                    ...pStyle,
                    fontSize: "12pt",
                    marginBottom: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  <span style={{ fontSize: "11pt" }}>Re:</span>
                  {"    "}
                  <strong style={{ fontSize: "12pt" }}>
                    NEW PCT-NATIONAL-PHASE
                  </strong>
                  {" APPLICATION – "}
                  <strong>INDIA</strong>
                  {" OUT OF APPLICATION NO. "}
                  <span>{d.pctAppNo}</span>
                </p>
                <div style={{ height: "10px" }} />

                {/* ── SALUTATION ── */}
                <p style={{ ...pStyle, marginBottom: "10px" }}>Dear Sir,</p>

                {/* ── INTRO PARAGRAPH ── */}
                <p style={{ ...pSpaced, lineHeight: "1.38" }}>
                  We have the honor to submit herewith{" "}
                  <strong>PCT-NATIONAL-PHASE – INDIA</strong> for the
                  application for letters patent under The Patents (Amendment)
                  Act, 2005 for an invention:
                </p>

                <div style={{ height: "8px" }} />

                {/* ── APPLICATION DETAILS ── */}
                <p
                  style={{
                    ...pStyle,
                    lineHeight: "1.38",
                    marginBottom: "16px",
                  }}
                >
                  <strong>PCT-NATIONAL-PHASE</strong> application in India out
                  of Application No. {d.pctAppNo} in the name of{" "}
                  <span style={{ fontSize: "12pt" }}>{d.applicantName}; </span>
                  titled <strong>"{d.inventionTitle}"</strong> with{" "}
                  {d.claimsCount} ({numberToWords(d.claimsCount)}) claims,{" "}
                  {d.pagesCount} ({numberToWords(d.pagesCount)}) pages and{" "}
                  {d.priorityCount} ({numberToWords(d.priorityCount)}) Priority.
                </p>

                {/* ── FEE DETAILS HEADING ── */}
                <p
                  style={{
                    ...pStyle,
                    fontFamily: "'Calibri', Arial, sans-serif",
                    fontSize: "12pt",
                    fontWeight: "bold",
                    marginBottom: "6px",
                    marginTop: "4px",
                  }}
                >
                  Details of the Fee:
                </p>

                {/* ── FEE TABLE — NO borders, bullet list style ── */}
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "16px",
                    fontSize: "11pt",
                  }}
                >
                  <colgroup>
                    <col style={{ width: "62%" }} />
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "33%" }} />
                  </colgroup>
                  <tbody>
                    <FeeRow
                      label={
                        <>
                          Application Filing Fee
                          <br />
                          <span
                            style={{ fontSize: "10pt", fontStyle: "normal" }}
                          >
                            (with 30 Pages, 10 Claims and 1 Priority)
                          </span>
                        </>
                      }
                      amount={`INR ${d.baseFee.toLocaleString()}`}
                    />

                    {d.extraPages > 0 && (
                      <FeeRow
                        label={`Fee for Extra ${d.extraPages} Pages in addition to 30`}
                        amount={`INR ${d.extraPagesFee.toLocaleString()}`}
                      />
                    )}
                    {d.extraClaims > 0 && (
                      <FeeRow
                        label={`Fee for Extra ${d.extraClaims} Claims in addition to 10`}
                        amount={`INR ${d.extraClaimsFee.toLocaleString()}`}
                      />
                    )}
                    {d.extraPriority > 0 && (
                      <FeeRow
                        label={`Fee for Extra ${d.extraPriority} Priority in addition to 1`}
                        amount={`INR ${d.extraPriorityFee.toLocaleString()}`}
                      />
                    )}
                    <FeeRow
                      label="Fee for Request for Examination"
                      amount={`INR ${d.rfeFee.toLocaleString()}`}
                    />
                    <FeeRow
                      label="Fee for Sequence Listing"
                      amount={`INR ${d.sequenceFee}`}
                    />
                    {/* TOTAL ROW */}
                    <tr>
                      <td
                        style={{
                          padding: "3px 6px 3px 32px",
                          fontWeight: "bold",
                        }}
                      >
                        TOTAL FEE
                      </td>
                      <td style={{ padding: "3px 4px" }}></td>
                      <td style={{ padding: "3px 6px", fontWeight: "bold" }}>
                        INR {d.totalFee.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* ── CLOSING ── */}
                <p style={{ ...pStyle, marginBottom: "12px" }}>
                  The Controller is respectfully requested to take that on
                  record.
                </p>

                <p style={{ ...pStyle, marginBottom: "40px" }}>
                  Yours faithfully,
                </p>

                {/* ── SIGNATURE BLOCK ── */}
                <p style={{ ...pStyle, marginBottom: "2px" }}>
                  <strong>{AGENT.nameUpper}</strong>
                </p>
                <p style={{ ...pStyle, marginBottom: "2px" }}>
                  (IN/PA No. {AGENT.regNo})
                </p>
                <p style={{ ...pStyle, marginBottom: "2px" }}>
                  of {AGENT.firm}
                </p>
                <p style={{ ...pStyle, marginBottom: "16px" }}>
                  <strong>AGENT FOR THE APPLICANT(s)</strong>
                </p>

                {/* ── ENCLOSURES ── */}
                <p
                  style={{
                    ...pStyle,
                    fontWeight: "bold",
                    fontSize: "11pt",
                    lineHeight: "1.5",
                    marginBottom: "4px",
                  }}
                >
                  Enclosures:
                </p>
                <ol
                  style={{
                    margin: "0",
                    paddingLeft: "22px",
                    lineHeight: "1.7",
                    fontSize: "11pt",
                  }}
                >
                  <li>Form 1,</li>
                  <li>Form 2 - Complete Specification,</li>
                  <li>Form 3,</li>
                  <li>Form 5,</li>
                  <li>FORM 18</li>
                  <li>
                    Copy of Notification of the International Application Number
                    and of the International Filing Date RO/105
                  </li>
                  <li>
                    Copy of Notification Concerning Submission or Transmittal of
                    Priority Document IB/304
                  </li>
                  <li>
                    Copy of notification of the Recording of a Change IB/306
                  </li>
                  <li>Proof of right</li>
                  <li>FORM 26</li>
                </ol>
              </div>

              {/* Push footer to bottom */}
              <div style={{ flex: 1 }} />

              {/* ── FOOTER ── */}
              <DocFooter />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Fee Table Row (no-border, bullet style) ─────────── */
function FeeRow({ label, amount }) {
  return (
    <tr>
      <td style={{ padding: "3px 6px 3px 0", verticalAlign: "top" }}>
        <span style={{ display: "flex", gap: "8px" }}>
          <span style={{ minWidth: "16px", paddingLeft: "8px" }}>•</span>
          <span>{label}</span>
        </span>
      </td>
      <td
        style={{
          padding: "3px 4px",
          verticalAlign: "top",
          textAlign: "center",
        }}
      >
        :
      </td>
      <td style={{ padding: "3px 6px", verticalAlign: "top" }}>{amount}</td>
    </tr>
  );
}
