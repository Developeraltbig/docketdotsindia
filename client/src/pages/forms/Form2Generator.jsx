import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

const transformData = (dbData) => {
  if (!dbData) return null;
  return {
    docketNo: dbData.DOC_NO?.trim() || "",
    inventionTitle: dbData.title || "",
    applicants: (dbData.applicants || []).map((a) => ({
      name: a.name || "",
      nationality: a.nationality || "",
      residence: a.residence_country || "",
      address: a.address || "",
    })),
  };
};

export default function Form2Generator({ formData, onClose }) {
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
              <h5>Form 2</h5>
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
      filename: `Form2_${d.docketNo || "Patent"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(element).save();
  };

  const downloadDOCX = () => {
    const content = contentRef.current.innerHTML;
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><style>
@page { size:A4; margin:40mm 30mm 30mm 40mm; }
body { font-family:'Times New Roman',serif; font-size:12pt; margin:0; }
table { width:100%; border-collapse:collapse; }
td { border:1px solid #000; padding:6pt 8pt; font-family:'Times New Roman',serif; font-size:12pt; }
</style></head>
<body>${content}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form2_${d.docketNo || "Patent"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TNR = { fontFamily: '"Times New Roman", Times, serif' };
  const CAMBRIA = { fontFamily: 'Cambria, "Book Antiqua", Georgia, serif' };
  const PT12 = { fontSize: "12pt" };
  const BOLD = { fontWeight: "bold" };
  const NORMAL = { fontWeight: "normal" };
  const BLACK = { color: "#000" };

  /* outer cell base — bold, 12pt, TNR, black border */
  const outerCell = {
    ...TNR,
    ...PT12,
    ...BOLD,
    ...BLACK,
    border: "1px solid #000",
    verticalAlign: "top",
  };

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
              Form 2 Preview — {d.docketNo}
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
            {/* A4 PAGE */}
            <div
              ref={contentRef}
              style={{
                ...TNR,
                ...PT12,
                ...BOLD,
                ...BLACK,
                background: "#fff",
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                padding: "40mm 30mm 30mm 40mm",
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
                  {/* ═══════════════════════════════════════════════════
                      ROW 1  —  FORM 2 HEADER
                      • Single cell, centered
                      • All lines bold 12pt TNR, NO gap between lines
                      • lineHeight: 1.35, no margin/padding on each div
                      • "&" is italic
                  ═══════════════════════════════════════════════════ */}
                  <tr>
                    <td
                      style={{
                        ...outerCell,
                        textAlign: "center",
                        padding: "10px 14px 8px",
                        lineHeight: "1.35",
                      }}
                    >
                      {[
                        { text: "FORM 2", extra: { letterSpacing: "5px" } },
                        { text: "THE PATENTS ACT, 1970", extra: {} },
                        { text: "(39 of 1970)", extra: {} },
                        { text: "&", extra: { fontStyle: "italic" } },
                        { text: "THE PATENTS RULES, 2003", extra: {} },
                        { text: "COMPLETE SPECIFICATION", extra: {} },
                        { text: "(See section 10 and rule 13)", extra: {} },
                      ].map(({ text, extra }, i) => (
                        <div
                          key={i}
                          style={{ margin: 0, padding: 0, ...extra }}
                        >
                          {text}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* ═══════════════════════════════════════════════════
                      ROW 2  —  1. TITLE OF THE INVENTION
                      • Heading and content in THE SAME CELL (one box)
                      • Heading: bold, left, "1.    TITLE OF THE INVENTION"
                      • Blank line between heading and title
                      • Title: bold, centered, curly double-quotes
                  ═══════════════════════════════════════════════════ */}
                  <tr>
                    <td style={{ ...outerCell, padding: "8px 14px 14px" }}>
                      {/* Heading line */}
                      <div
                        style={{
                          ...TNR,
                          ...PT12,
                          ...BOLD,
                          ...BLACK,
                          marginBottom: "10px",
                        }}
                      >
                        1.&nbsp;&nbsp;&nbsp;&nbsp;TITLE OF THE INVENTION
                      </div>
                      {/* Title value — centered bold */}
                      <div
                        style={{
                          ...TNR,
                          ...PT12,
                          ...BOLD,
                          ...BLACK,
                          textAlign: "center",
                        }}
                      >
                        &ldquo;{d.inventionTitle}&rdquo;
                      </div>
                    </td>
                  </tr>

                  {/* ═══════════════════════════════════════════════════
                      ROW 3  —  2. APPLICANT(s)
                      • Heading and nested table in THE SAME CELL (one box)
                      • Heading: bold, left, "2.    APPLICANT(s)"
                      • Nested table has VISIBLE 1px black borders
                      • Label col (~16%): Cambria, normal weight
                      • Value col (~84%): Cambria, bold
                      • Rows: Name / Address / Nationality / blank
                  ═══════════════════════════════════════════════════ */}
                  <tr>
                    <td style={{ ...outerCell, padding: "8px 14px 10px" }}>
                      {/* Heading */}
                      <div
                        style={{
                          ...TNR,
                          ...PT12,
                          ...BOLD,
                          ...BLACK,
                          marginBottom: "8px",
                        }}
                      >
                        2.&nbsp;&nbsp;&nbsp;&nbsp;APPLICANT(s)
                      </div>

                      {/* Applicant details — plain div rows, no nested table */}
                      {(d.applicants.length === 0
                        ? [{ name: "", address: "", nationality: "" }]
                        : d.applicants
                      ).map((applicant, idx) => (
                        <div
                          key={idx}
                          style={{
                            marginBottom:
                              idx < d.applicants.length - 1 ? "10px" : "0",
                          }}
                        >
                          {[
                            { label: "Name:", value: applicant.name },
                            { label: "Address:", value: applicant.address },
                            {
                              label: "Nationality:",
                              value: applicant.nationality,
                            },
                          ].map((row, ri) => (
                            <div
                              key={ri}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                marginBottom: "2px",
                              }}
                            >
                              <span
                                style={{
                                  ...CAMBRIA,
                                  ...PT12,
                                  ...NORMAL,
                                  ...BLACK,
                                  minWidth: "110px",
                                  flexShrink: 0,
                                }}
                              >
                                {row.label}
                              </span>
                              <span
                                style={{
                                  ...CAMBRIA,
                                  ...PT12,
                                  ...BOLD,
                                  ...BLACK,
                                  flex: 1,
                                  wordBreak: "break-word",
                                }}
                              >
                                {row.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* ═══════════════════════════════════════════════════
                      ROW 4  —  3. PREAMBLE TO THE DESCRIPTION
                      • Small heading-only row (no content below)
                      • Bold, left-aligned
                  ═══════════════════════════════════════════════════ */}
                  <tr>
                    <td style={{ ...outerCell, padding: "5px 14px 5px" }}>
                      3.&nbsp;&nbsp;&nbsp;&nbsp;PREAMBLE TO THE DESCRIPTION
                    </td>
                  </tr>

                  {/* ═══════════════════════════════════════════════════
                      ROW 5  —  PREAMBLE CONTENT
                      • blank leading line
                      • "COMPLETE SPECIFICATION" — centered, NORMAL weight
                      • Body paragraph — left-justified, NORMAL weight
                  ═══════════════════════════════════════════════════ */}
                  <tr>
                    <td
                      style={{
                        ...outerCell,
                        ...NORMAL,
                        padding: "8px 14px 16px",
                        lineHeight: "1.5",
                      }}
                    >
                      {/* blank leading paragraph (matches DOCX empty paragraph) */}
                      <div style={{ marginBottom: "10px" }}>&nbsp;</div>

                      {/* "COMPLETE SPECIFICATION" — centered, normal weight */}
                      <div
                        style={{
                          ...TNR,
                          ...PT12,
                          ...NORMAL,
                          ...BLACK,
                          textAlign: "center",
                          marginBottom: "12px",
                        }}
                      >
                        COMPLETE SPECIFICATION
                      </div>

                      {/* Body text — justified, normal weight */}
                      <div
                        style={{
                          ...TNR,
                          ...PT12,
                          ...NORMAL,
                          ...BLACK,
                          textAlign: "justify",
                        }}
                      >
                        The following specification particularly describes the
                        invention and the manner in which it is to be performed.
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
