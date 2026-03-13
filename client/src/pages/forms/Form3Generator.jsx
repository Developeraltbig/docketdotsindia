import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

const formatDate = (dateStr) => {
  if (!dateStr) return "___________";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "___________";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateLong = (dateStr) => {
  if (!dateStr) return "this _____ day of _____, _____";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "this _____ day of _____, _____";
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

const transformData = (dbData) => {
  if (!dbData) return null;
  const firstApplicant = dbData.applicants?.[0] || {};
  const isCompany = dbData.applicant_category !== "Natural";
  return {
    docketNo: dbData.DOC_NO?.trim() || "",
    patentOffice: PATENT_OFFICES[dbData.jurisdiction] || "New Delhi",
    inventionTitle: dbData.title || "",
    applicantName: firstApplicant.name || "",
    applicantNationality: firstApplicant.nationality || "INDIA",
    applicantAddress: firstApplicant.address || "",
    nationalityStatement: isCompany
      ? `a company organized and existing under the laws of ${firstApplicant.nationality || "INDIA"}`
      : `a citizen of ${firstApplicant.nationality || "INDIA"}`,
    filingDate: dbData.deposit_date || "",
    claimingPriority: dbData.claiming_priority === "yes",
    priorities: (dbData.priorities || []).map((p) => ({
      country: p.country || "",
      appNo: p.priority_no || "",
      date: formatDate(p.priority_date),
      applicantName: p.applicant_name || firstApplicant.name || "",
    })),
  };
};

export default function Form3Generator({ formData, onClose }) {
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
              <h5>Form 3</h5>
              <button className="btn-close" onClick={onClose} />
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
      margin: 0,
      filename: `Form3_${d.docketNo || "Patent"}.pdf`,
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
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><style>
@page { size:A4; margin:12.5mm 25.4mm 25.4mm 25.4mm; }
body { font-family:Cambria,serif; font-size:11pt; line-height:1.5; margin:0; }
table { width:100%; border-collapse:collapse; }
td { border:1px solid #000; padding:5pt 6pt; font-family:Cambria,serif; font-size:11pt; vertical-align:top; }
</style></head>
<body>${content}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form3_${d.docketNo || "Patent"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const firstPriority = d.priorities[0] || {};

  /* ── style tokens ── */
  const CAMBRIA = { fontFamily: 'Cambria, "Book Antiqua", Georgia, serif' };
  const PT11 = { fontSize: "11pt" };
  const LS15 = { lineHeight: "1.5" };
  const JUSTIFY = { textAlign: "justify" };
  const CENTER = { textAlign: "center" };
  const BOLD = { fontWeight: "bold" };
  const NORMAL = { fontWeight: "normal" };
  const BLACK = { color: "#000" };
  const VTOP = { verticalAlign: "top" };

  /* base cell used everywhere */
  const cell = {
    ...CAMBRIA,
    ...PT11,
    ...LS15,
    ...BLACK,
    ...VTOP,
    border: "1px solid #000",
    padding: "5px 7px",
  };

  /* label column (left, ~30.3%) */
  const labelCell = {
    ...cell,
    width: "30.3%",
  };

  /* content column (right, ~69.7%) */
  const contentCell = {
    ...cell,
    width: "69.7%",
    ...JUSTIFY,
  };

  /* priority table 6-col widths as % of 9350 DXA total */
  const pCols = ["15.15%", "15.15%", "21.22%", "16.67%", "18.19%", "13.61%"];

  /* render priority data rows */
  const priorityRows =
    d.claimingPriority && d.priorities.length > 0
      ? d.priorities
      : [{ country: "", appNo: "", date: "" }];

  /* pad to at least 4 rows */
  const paddedRows = [
    ...priorityRows,
    ...Array(Math.max(0, 4 - priorityRows.length)).fill({
      country: "",
      appNo: "",
      date: "",
    }),
  ];

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          {/* ── Modal toolbar ── */}
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title fw-bold">
              Form 3 Preview — {d.docketNo}
            </h5>
            <div className="d-flex gap-2 align-items-center">
              <button className="btn btn-danger btn-sm" onClick={downloadPDF}>
                ⬇ PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={downloadDOCX}>
                ⬇ DOCX
              </button>
              <button className="btn-close" onClick={onClose} />
            </div>
          </div>

          {/* ── Modal body ── */}
          <div
            className="modal-body"
            style={{ background: "#d0d0d0", padding: "24px" }}
          >
            {/* ════ A4 PAGE ════ */}
            <div
              ref={contentRef}
              style={{
                ...CAMBRIA,
                ...PT11,
                ...LS15,
                ...BLACK,
                background: "#fff",
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                /* top=709 DXA≈12.5mm, others=1440 DXA≈25.4mm */
                padding: "12.5mm 25.4mm 25.4mm 25.4mm",
                boxSizing: "border-box",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <tbody>
                  {/* ══════════════════════════════════════════════════════
                      ROW 1 — HEADER  (trHeight 2847 DXA, single full-width cell)
                      line-height: 1.5, centered
                      "FORM 3" prefix curly-quote + BOLD
                      "STATEMENT AND UNDERTAKING…" BOLD
                      All other lines: normal weight
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td
                      colSpan="6"
                      style={{
                        ...cell,
                        ...CENTER,
                        padding: "8px 7px",
                      }}
                    >
                      {/* "FORM 3 — bold */}
                      <div style={{ ...BOLD, margin: 0 }}>FORM 3</div>
                      {/* Normal-weight lines */}
                      {[
                        "THE PATENTS ACT, 1970",
                        "(39 of 1970)",
                        "and",
                        "THE PATENTS RULES, 2003",
                      ].map((line, i) => (
                        <div key={i} style={{ ...NORMAL, margin: 0 }}>
                          {line}
                        </div>
                      ))}
                      {/* BOLD line */}
                      <div style={{ ...BOLD, margin: 0 }}>
                        STATEMENT AND UNDERTAKING UNDER SECTION 8
                      </div>
                      {/* Normal italic */}
                      <div
                        style={{ ...NORMAL, fontStyle: "italic", margin: 0 }}
                      >
                        (See sub-rule (2) and (3) of Rule 12)
                      </div>
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW 2 — Section 1: Name of applicant(s)
                      Left col: label text, normal weight
                      Right col: justified, "I/We, [NAME bold] [statement bold], having address at [ADDRESS bold]; do hereby declare:"
                      Bold applicant name + statement + address (matches DOCX bold runs)
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}>
                      1. Name of the applicant(s).
                    </td>
                    <td colSpan="4" style={contentCell}>
                      <span>I/We, </span>
                      <strong>
                        {d.applicantName} {d.nationalityStatement}, having
                        address at {d.applicantAddress};{" "}
                      </strong>
                      <br />
                      <br />
                      <span>do hereby declare:</span>
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW 3 — Section 2: Name/address/nationality of joint applicant
                      Left col: label, normal
                      Right col: justified paragraphs:
                        (i) plain text with bold date/appno
                        (ii) strikethrough
                        "Or" centered
                        (iii) plain text
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}>
                      2. Name, address and nationality of the joint applicant.
                    </td>
                    <td colSpan="4" style={contentCell}>
                      {/* (i) */}
                      <div style={{ marginBottom: "6px" }}>
                        (i) that I/we who have made the Application for patent
                        number&hellip;&hellip;&hellip;&hellip;&hellip; in India,
                        dated <strong>{formatDateLong(d.filingDate)}</strong>,
                        based on{" "}
                        <strong>
                          {firstPriority.appNo || ".................."}
                        </strong>
                        , alone/jointly
                        with&hellip;&hellip;&hellip;&hellip;&hellip;
                      </div>
                      {/* (ii) strikethrough */}
                      <div
                        style={{
                          textDecoration: "line-through",
                          marginBottom: "6px",
                        }}
                      >
                        (ii) that I/We have not made any application for the
                        same/substantially the same invention outside India
                      </div>
                      {/* Or */}
                      <div style={{ ...CENTER, marginBottom: "6px" }}>Or</div>
                      {/* (iii) */}
                      <div>
                        (iii) that I/We have made for the same/ substantially
                        same invention, application(s) for patent in the other
                        countries, the particulars of which are given below:
                      </div>
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW 4 — Priority table HEADER (6 columns)
                      Widths: 1418|1418|1984|1559|1701|1270 DXA
                      Bold, centered, 11pt Cambria
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    {[
                      "Name of the country",
                      "Date of application",
                      "Application No.",
                      "Status of  the application",
                      "Date  of publication",
                      "Date  of disposal",
                    ].map((header, i) => (
                      <td
                        key={i}
                        style={{
                          ...cell,
                          ...CENTER,
                          ...BOLD,
                          width: pCols[i],
                          padding: "5px 4px",
                        }}
                      >
                        {header}
                      </td>
                    ))}
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROWS 5+ — Priority data rows
                      Bold values, centered
                  ══════════════════════════════════════════════════════ */}
                  {paddedRows.map((p, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          ...cell,
                          ...CENTER,
                          ...BOLD,
                          width: pCols[0],
                          padding: "4px",
                        }}
                      >
                        {p.country || ""}
                      </td>
                      <td
                        style={{
                          ...cell,
                          ...CENTER,
                          ...BOLD,
                          width: pCols[1],
                          padding: "4px",
                        }}
                      >
                        {p.date || ""}
                      </td>
                      <td
                        style={{
                          ...cell,
                          ...CENTER,
                          ...BOLD,
                          width: pCols[2],
                          padding: "4px",
                        }}
                      >
                        {p.appNo || ""}
                      </td>
                      <td
                        style={{
                          ...cell,
                          ...CENTER,
                          width: pCols[3],
                          padding: "4px",
                        }}
                      ></td>
                      <td
                        style={{
                          ...cell,
                          ...CENTER,
                          width: pCols[4],
                          padding: "4px",
                        }}
                      ></td>
                      <td
                        style={{
                          ...cell,
                          ...CENTER,
                          width: pCols[5],
                          padding: "4px",
                        }}
                      ></td>
                    </tr>
                  ))}

                  {/* ══════════════════════════════════════════════════════
                      ROW: Section 3 — Name and address of assignee (part i)
                      Left col: label
                      Right col: "(i) that the rights… [BOLD name+statement+address];"
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}>
                      3. Name and address of the assignee
                    </td>
                    <td colSpan="4" style={contentCell}>
                      (i) that the rights in the application(s) has/have been
                      assigned to{" "}
                      <strong>
                        {d.applicantName} {d.nationalityStatement}, having
                        address at {d.applicantAddress};
                      </strong>
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW: Section 3 continuation (part ii + Dated this)
                      Left col: empty
                      Right col: "(ii) undertaking…" then "Dated this: [bold date]"
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}></td>
                    <td colSpan="4" style={contentCell}>
                      <div style={{ marginBottom: "8px" }}>
                        (ii) that I/We undertake that up to the date of grant of
                        the patent by the Controller, I/We would keep him
                        informed in writing the details regarding corresponding
                        applications for patents filed outside India in
                        accordance with the provisions contained in section 8
                        and rule 12.
                      </div>
                      <div style={{ ...BOLD }}>
                        Dated this: {formatDateLong(d.filingDate)}
                      </div>
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW: Section 4 — To be signed
                      Left col: label text (normal)
                      Right col: empty
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}>
                      4. To be signed by the applicant or his authorized
                      registered patent agent.
                    </td>
                    <td colSpan="4" style={contentCell}></td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW: Section 5 — Name of natural person who signed
                      Left col: label
                      Right col: AGENT NAME (bold), reg no, firm, role
                      All lines: Cambria 11pt, line-height 1.5
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}>
                      5. Name of the natural person who has signed.
                    </td>
                    <td colSpan="4" style={contentCell}>
                      <div style={{ ...BOLD }}>{AGENT.nameUpper}</div>
                      <div>(IN/PA No. {AGENT.regNo})</div>
                      <div>of {AGENT.firm}</div>
                      <div>AGENT FOR THE APPLICANT(S)</div>
                    </td>
                  </tr>

                  {/* ══════════════════════════════════════════════════════
                      ROW: To the Controller
                      Left col: empty
                      Right col: "To / The Controller… / at [BOLD office]"
                  ══════════════════════════════════════════════════════ */}
                  <tr>
                    <td colSpan="2" style={labelCell}></td>
                    <td colSpan="4" style={contentCell}>
                      <div>To</div>
                      <div>The Controller of Patents,</div>
                      <div>The Patent Office,</div>
                      <div>
                        at <strong>{d.patentOffice}</strong>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* /A4 page */}
          </div>
          {/* /modal-body */}
        </div>
      </div>
    </div>
  );
}
