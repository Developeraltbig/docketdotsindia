import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

const formatDateLong = (dateStr) => {
  if (!dateStr) return "___________";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "___________";
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

const AGENT = { nameUpper: "AMIT ASWAL", regNo: "2185", firm: "anovIP" };

const PATENT_OFFICES = {
  "New Delhi": "New Delhi",
  Mumbai: "Mumbai",
  Kolkata: "Kolkata",
  Chennai: "Chennai",
};

const transformData = (dbData) => {
  if (!dbData) return null;
  return {
    docketNo: dbData.DOC_NO?.trim() || "",
    patentOffice: PATENT_OFFICES[dbData.jurisdiction] || "New Delhi",
    filingDate: dbData.deposit_date || "",
    applicants: (dbData.applicants || []).map((a) => ({
      name: a.name || "",
      nationality: a.nationality || "",
      address: a.address || "",
    })),
  };
};

export default function Form9Generator({ formData, onClose }) {
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
              <h5>Form 9</h5>
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
    const opt = {
      margin: 0,
      filename: `Form9_${d.docketNo || "Patent"}.pdf`,
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
    html2pdf().set(opt).from(contentRef.current).save();
  };

  const downloadDOCX = () => {
    /* No global td { border } — each td carries its own inline border so
       Word respects the borderless signature cells correctly.            */
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
  xmlns:w='urn:schemas-microsoft-com:office:word'
  xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><style>
@page { size:A4; margin:40mm 30mm 30mm 40mm; }
body  { font-family:Cambria,serif; font-size:12pt; line-height:1.0; margin:0; }
table { width:100%; border-collapse:collapse; }
td    { font-family:Cambria,serif; font-size:12pt; vertical-align:top; padding:3pt 5pt; }
</style></head>
<body>${contentRef.current.innerHTML}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form9_${d.docketNo || "Patent"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── style tokens ── */
  const CAM = { fontFamily: 'Cambria, "Book Antiqua", Georgia, serif' };
  const F12 = { fontSize: "12pt" };
  const LS1 = { lineHeight: "1.0" }; /* line=240/240 */
  const LS15 = { lineHeight: "1.5" }; /* line=360/240 */
  const BK = { color: "#000" };
  const B = { fontWeight: "bold" };
  const N = { fontWeight: "normal" };
  const JUS = { textAlign: "justify" };
  const CEN = { textAlign: "center" };
  const VT = { verticalAlign: "top" };

  /* borders */
  const BDR = "1px solid #000";
  const allBorders = { border: BDR }; /* Table 1 — all cells */
  const noBorders = { border: "none" };
  const sideBorders = {
    borderRight: BDR,
    borderLeft: BDR,
  }; /* Table 2 — signature, no borders */

  /* base cell style (no border here — set per cell) */
  const td = { ...CAM, ...F12, ...BK, ...VT, padding: "3px 6px" };

  const applicants =
    d.applicants.length > 0
      ? d.applicants
      : [{ name: "", address: "", nationality: "" }];

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title fw-bold">
              Form 9 Preview — {d.docketNo}
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

          <div
            className="modal-body"
            style={{ background: "#d0d0d0", padding: "24px" }}
          >
            <div
              ref={contentRef}
              style={{
                ...CAM,
                ...F12,
                ...BK,
                background: "#fff",
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                padding: "40mm 30mm 30mm 40mm",
                boxSizing: "border-box",
              }}
            >
              {/* ═══════════════════════════════════════════════════════
                  TABLE 1  —  Applicant table (tblBorders = all sides)
                  2 columns: 15.7 % label | 84.3 % value
                  Row 1: colSpan=2 full-width header+body cell
                  Rows 2–4: label | value for Address / Nationality / empty
              ═══════════════════════════════════════════════════════ */}
              {applicants.map((app, appIdx) => (
                <table
                  key={appIdx}
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                    marginBottom: appIdx < applicants.length - 1 ? "16px" : 0,
                  }}
                >
                  <colgroup>
                    <col style={{ width: "15.7%" }} />
                    <col style={{ width: "84.3%" }} />
                  </colgroup>
                  <tbody>
                    {/* ── Row 1: full-width header + "We," + Name row ── */}
                    <tr>
                      {/* Left cell: header block + "We," (colSpan=2 visually via gridSpan) */}
                      <td
                        colSpan={2}
                        style={{
                          ...td,
                          ...allBorders,
                          ...CEN,
                          ...LS1,
                          padding: "6px 10px 0",
                          /* bottom border removed — shared with Name row's top */
                          borderBottom: "none",
                        }}
                      >
                        {/* Header lines */}
                        <div style={{ ...B, margin: 0 }}>FORM 9</div>
                        {[
                          "THE PATENTS ACT, 1970",
                          "(39 of 1970)",
                          "and",
                          "THE PATENTS RULES, 2003",
                        ].map((line, i) => (
                          <div key={i} style={{ ...N, margin: 0 }}>
                            {line}
                          </div>
                        ))}
                        <div style={{ ...B, margin: 0 }}>
                          REQUEST FOR PUBLICATION
                        </div>
                        {/* [See…] italic, lineHeight 1.5 */}
                        <div
                          style={{
                            ...N,
                            fontStyle: "italic",
                            ...LS15,
                            margin: 0,
                          }}
                        >
                          [<em>See</em> section 11A (2); rule 24A]
                        </div>
                        <br />
                        <br />
                        <br />
                        {/* "We," — justified, lineHeight 1.5 */}

                        <div
                          style={{ ...N, ...JUS, ...LS15, marginTop: "4px" }}
                        >
                          We,
                        </div>
                        <br />
                      </td>
                    </tr>

                    {/* ── Name row ── */}
                    <tr>
                      <td
                        style={{
                          ...td,
                          ...sideBorders,
                          ...N,
                          ...LS1,
                          borderRight: "none",
                        }}
                      >
                        Name:
                      </td>
                      <td
                        style={{
                          ...td,
                          ...sideBorders,
                          ...B,
                          ...LS1,
                          borderLeft: "none",
                        }}
                      >
                        {app.name}
                      </td>
                      <br />
                      <br />
                    </tr>

                    {/* ── Address row ── */}
                    <tr>
                      <td
                        style={{
                          ...td,
                          ...sideBorders,
                          ...N,
                          ...LS1,
                          borderRight: "none",
                        }}
                      >
                        Address:
                      </td>
                      <td
                        style={{
                          ...td,
                          ...sideBorders,
                          ...B,
                          ...LS1,
                          borderLeft: "none",
                        }}
                      >
                        {app.address}
                      </td>
                      <br />
                      <br />
                    </tr>

                    {/* ── Nationality row ── */}
                    <tr>
                      <td
                        style={{
                          ...td,
                          ...sideBorders,
                          ...N,
                          ...LS1,
                          borderRight: "none",
                        }}
                      >
                        Nationality:
                      </td>
                      <td
                        style={{
                          ...td,
                          ...sideBorders,
                          ...B,
                          ...LS1,
                          borderLeft: "none",
                          borderBottom: "none",
                        }}
                      >
                        {app.nationality}
                      </td>
                      <br />
                      <br />
                    </tr>

                    {/* ── Empty spacer row (DOCX Row 4) ── */}
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          ...td,
                          ...allBorders,
                          /* bottom of this row holds the body text below */
                          borderTop: "none",
                          borderBottom: "none",
                          height: "8px",
                          padding: "2px 6px",
                        }}
                      ></td>
                    </tr>

                    {/* ── Body text + Signature + To (still inside the outer border) ── */}
                    <tr>
                      <td
                        colSpan={2}
                        style={{
                          ...td,
                          ...allBorders,
                          borderTop: "none",
                          padding: "4px 6px 10px",
                        }}
                      >
                        {/* "hereby request…" — justified, lineHeight 1.5 */}
                        <div
                          style={{
                            ...N,
                            ...JUS,
                            ...LS15,
                            marginBottom: "10px",
                            borderTop: "none",
                          }}
                        >
                          hereby request for early publication of our Patent
                          application number{" "}
                          <span style={{ textDecoration: "underline" }}>
                            __________________
                          </span>{" "}
                          dated <strong>{formatDateLong(d.filingDate)}</strong>{" "}
                          under section 11A(2) of the Act.
                        </div>
                        <br />

                        {/* "Dated …" — centered, lineHeight 1.0 */}
                        <div
                          style={{
                            ...N,
                            ...CEN,
                            ...LS1,
                            margin: "12px 0 10px",
                          }}
                        >
                          Dated {formatDateLong(d.filingDate)}
                        </div>
                        <br />

                        {/* ══════════════════════════════════════════════
                            TABLE 2 — Signature block
                            tblBorders = NONE → no borders on any cell
                            Columns: 38.8 % (2548 DXA) | 61.2 % (4010 DXA)
                            Labels: right-aligned | Values: left-aligned
                            All rows: lineHeight 1.0
                        ══════════════════════════════════════════════ */}
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            tableLayout: "fixed",
                            marginBottom: "14px",
                          }}
                        >
                          <colgroup>
                            <col style={{ width: "38.8%" }} />
                            <col style={{ width: "61.2%" }} />
                          </colgroup>
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  ...td,
                                  ...noBorders,
                                  ...LS1,
                                  textAlign: "right",
                                }}
                              >
                                Signature:
                              </td>
                              <td style={{ ...td, ...noBorders, ...LS1 }}></td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  ...td,
                                  ...noBorders,
                                  ...LS1,
                                  textAlign: "right",
                                }}
                              >
                                Name of the signatory:
                              </td>
                              <td style={{ ...td, ...noBorders, ...LS1 }}>
                                {AGENT.nameUpper}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ ...td, ...noBorders, ...LS1 }}></td>
                              <td style={{ ...td, ...noBorders, ...LS1 }}>
                                (IN/PA No. {AGENT.regNo})
                              </td>
                            </tr>
                            <tr>
                              <td style={{ ...td, ...noBorders, ...LS1 }}></td>
                              <td style={{ ...td, ...noBorders, ...LS1 }}>
                                of {AGENT.firm}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ ...td, ...noBorders, ...LS1 }}></td>
                              <td style={{ ...td, ...noBorders, ...LS1 }}>
                                AGENT FOR THE APPLICANT(S)
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* "To, The Controller..." — left, lineHeight 1.0 */}
                        <div style={{ ...N, ...LS1 }}>To,</div>
                        <div style={{ ...N, ...LS1 }}>
                          The Controller of Patents,
                        </div>
                        <div style={{ ...N, ...LS1 }}>The Patent Office,</div>
                        <div style={{ ...N, ...LS1 }}>
                          At <strong>{d.patentOffice}</strong>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
