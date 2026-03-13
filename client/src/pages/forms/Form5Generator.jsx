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
  const firstApplicant = dbData.applicants?.[0] || {};
  const isCompany = dbData.applicant_category !== "Natural";
  let inventors = [];
  if (dbData.inventors_same_as_applicant === "yes") {
    inventors = (dbData.applicants || []).map((a) => ({
      name: a.name || "",
      nationality: a.nationality || "",
      address: a.address || "",
    }));
  } else {
    inventors = (dbData.inventors || []).map((i) => ({
      name: i.name || "",
      nationality: i.citizen_country || i.nationality || "",
      address: i.address || "",
    }));
  }
  return {
    docketNo: dbData.DOC_NO?.trim() || "",
    patentOffice: PATENT_OFFICES[dbData.jurisdiction] || "New Delhi",
    applicantName: firstApplicant.name || "",
    nationalityStatement: isCompany
      ? `a company organized and existing under the laws of ${firstApplicant.nationality || "INDIA"}`
      : `a citizen of ${firstApplicant.nationality || "INDIA"}`,
    applicantAddress: firstApplicant.address || "",
    filingDate: dbData.deposit_date || "",
    inventors: inventors.filter((i) => i.name && i.name.trim() !== ""),
  };
};

export default function Form5Generator({ formData, onClose }) {
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
              <h5>Form 5</h5>
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
      filename: `Form5_${d.docketNo || "Patent"}.pdf`,
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
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><style>
@page{size:A4;margin:10mm 10mm 10mm 10mm;}
body{font-family:Cambria,serif;font-size:11pt;line-height:1.15;margin:0;}
table{width:100%;border-collapse:collapse;}
td{padding:4pt 5pt;font-family:Cambria,serif;font-size:11pt;vertical-align:top;}
</style></head>
<body>${contentRef.current.innerHTML}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form5_${d.docketNo || "Patent"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── tokens ── */
  const CAM = { fontFamily: 'Cambria, "Book Antiqua", Georgia, serif' };
  const F11 = { fontSize: "11pt" };
  const LS = { lineHeight: "1.15" };
  const LS15 = { lineHeight: "1.5" };
  const BK = { color: "#000" };
  const B = { fontWeight: "bold" };
  const N = { fontWeight: "normal" };
  const JUS = { textAlign: "justify" };
  const CEN = { textAlign: "center" };
  const VT = { verticalAlign: "top" };

  /* ── border presets ── */
  const BORDER = "1px solid #000";
  /* all 4 sides */
  const allBorders = { border: BORDER };
  const sideBorder = {
    borderLeft: BORDER,

    borderRight: BORDER,
  };
  const onlyLeft = {
    borderRight: "none",
  };
  const onlyRight = {
    borderLeft: "none",
  };
  /* no right (cell-1 of seamless pairs) */
  const noRight = {
    borderTop: BORDER,
    borderLeft: BORDER,

    borderRight: BORDER,
  };
  /* no left (cell-2 of seamless pairs) */
  const noLeft = {
    borderRight: BORDER,

    borderLeft: BORDER,
  };

  /* base td style */
  const td = { ...CAM, ...F11, ...LS, ...BK, ...VT, padding: "4px 6px" };

  const inventors =
    d.inventors.length > 0
      ? d.inventors
      : [{ name: "", nationality: "", address: "" }];

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title fw-bold">
              Form 5 Preview — {d.docketNo}
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
                ...F11,
                ...LS,
                ...BK,
                background: "#fff",
                width: "210mm",
                minHeight: "297mm",
                margin: "0 auto",
                padding: "40mm 30mm 30mm 40mm",
                boxSizing: "border-box",
              }}
            >
              {/*
                Column grid  (% of 8240 DXA content width):
                C1 =  1.2%  — narrow inventor left spacer
                C2 = 31.0%  — applicant name / sig-left
                C3 = 46.5%  — nationality / sig-content-left
                C4 = 21.3%  — address / sig-content-right
              */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: "1.2%" }} />
                  <col style={{ width: "31.0%" }} />
                  <col style={{ width: "46.5%" }} />
                  <col style={{ width: "21.3%" }} />
                </colgroup>
                <tbody>
                  {/* ══ ROW 1 — HEADER (4-col span, all borders, lineHeight 1.5) ══ */}
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        ...td,
                        ...allBorders,
                        ...CEN,
                        ...LS15,
                        padding: "8px 10px",
                      }}
                    >
                      <div style={{ ...B }}>FORM 5</div>
                      {[
                        "THE PATENTS ACT, 1970",
                        "(39 of 1970)",
                        "and",
                        "THE PATENTS RULES, 2003",
                      ].map((t, i) => (
                        <div key={i} style={{ ...N }}>
                          {t}
                        </div>
                      ))}
                      <div style={{ ...B }}>DECLARATION AS TO INVENTORSHIP</div>
                      <div style={{ ...N, fontStyle: "italic" }}>
                        [<em>See</em> section 10 (6) and rule 13 (6)]
                      </div>
                    </td>
                  </tr>

                  {/* ══ ROW 2 — Applicant column headers (3 cols, DEFAULT = all borders) ══ */}
                  <tr>
                    <td colSpan={2} style={{ ...td, ...allBorders, ...B }}>
                      1.Applicant Name
                    </td>
                    <td style={{ ...td, ...allBorders, ...B }}>Nationality</td>
                    <td style={{ ...td, ...allBorders, ...B }}>Address</td>
                  </tr>

                  {/* ══ ROW 3 — Applicant data (3 cols, DEFAULT = all borders, NORMAL weight) ══ */}
                  <tr>
                    <td colSpan={2} style={{ ...td, ...allBorders, ...N }}>
                      {d.applicantName}
                    </td>
                    <td style={{ ...td, ...allBorders, ...N }}>
                      {d.nationalityStatement}
                    </td>
                    <td style={{ ...td, ...allBorders, ...N }}>
                      {d.applicantAddress}
                    </td>
                  </tr>

                  {/* ══ ROW 4 — "hereby declare" (full-width, explicit all borders, BOLD, justify) ══ */}
                  <tr>
                    <td colSpan={4} style={{ ...td, ...allBorders, ...JUS }}>
                      hereby declare that the true and first inventor(s) of the
                      invention disclosed in the complete specification filed in
                      pursuance of our application numbered{" "}
                      <span style={{ textDecoration: "underline" }}>
                        _________________
                      </span>{" "}
                      dated <strong>{formatDateLong(d.filingDate)}</strong>{" "}
                      is/are:
                    </td>
                  </tr>

                  {/* ══ ROW 5 — "2. INVENTOR(S)" (full-width, explicit all borders, BOLD) ══ */}
                  <tr>
                    <td colSpan={4} style={{ ...td, ...allBorders, ...B }}>
                      2. INVENTOR(S)
                    </td>
                  </tr>

                  {/*
                    ══ INVENTOR ROWS ══
                    Each inventor = 4 rows: Name / Nationality / Address / empty spacer
                    Per row: 2 cells
                      Cell-1 (C1 = 1.2%, no right border) → invisible spacer
                      Cell-2 (C2+C3+C4 = 98.8%, no left border) → full-width text
                    Result: row appears as one full-width cell (no internal vertical line)
                  */}
                  {inventors.map((inv, idx) => (
                    <React.Fragment key={idx}>
                      {/* (a) Name */}
                      <tr>
                        <td colSpan={4} style={{ ...td, ...noLeft, ...B }}>
                          <span style={{ ...N, marginRight: "200px" }}>
                            (a) Name:&nbsp;&nbsp;
                          </span>
                          {inv.name}
                        </td>
                      </tr>
                      {/* (b) Nationality */}
                      <tr>
                        <td colSpan={4} style={{ ...td, ...noLeft, ...B }}>
                          <span style={{ ...N, marginRight: "165px" }}>
                            (b) Nationality:&nbsp;&nbsp;
                          </span>
                          {inv.nationality}
                        </td>
                      </tr>
                      {/* (c) Address */}
                      <tr>
                        <td colSpan={4} style={{ ...td, ...noLeft, ...B }}>
                          <span style={{ ...N, marginRight: "185px" }}>
                            (c) Address:&nbsp;&nbsp;
                          </span>
                          {inv.address}
                        </td>
                      </tr>
                      {/* empty spacer between inventors */}
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            ...td,
                            ...noLeft,
                            borderBottom: "1px solid rgb(0, 0, 0)",
                            height: "14px",
                            padding: "2px 6px",
                          }}
                        ></td>
                      </tr>
                    </React.Fragment>
                  ))}

                  {/*
                    ══ SIGNATURE BLOCK (rows 22-26) ══
                    Row 22: Cell-1 (C1+C2=32.2%, right=nil) | Cell-2 (C3+C4=67.8%, left=nil)
                      → seamless: no vertical line between them
                      Cell-2 contains: "Dated this DATE" (centered bold) + "Signature:" (right-aligned)
                      as plain divs — NO nested table
                    Rows 23-26: 2 cells (C3=46.5% | C4=21.3%), DEFAULT borders
                      Row 23: "Name of the signatory:" (right) | "AMIT ASWAL" (bold)
                      Row 24: empty | "(IN/PA No. ...)"
                      Row 25: empty | "of firm"
                      Row 26: "AGENT FOR THE APPLICANT(S)" (colspan 2)
                  */}
                  {/* Row 22 */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...td,
                        ...sideBorder,
                        borderRight: "none",
                        textAlign: "right",
                      }}
                    >
                      Dated This:
                    </td>
                    <td
                      colSpan={2}
                      style={{ ...sideBorder, borderLeft: "none" }}
                    >
                      <strong>{formatDateLong(d.filingDate)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...td,
                        ...sideBorder,
                        borderRight: "none",
                        textAlign: "right",
                      }}
                    >
                      Signature:
                    </td>
                    <td
                      colSpan={2}
                      style={{ ...sideBorder, borderLeft: "none" }}
                    ></td>
                  </tr>
                  {/* Row 23 */}
                  <tr>
                    <td
                      colSpan={2}
                      rowSpan={4}
                      style={{
                        ...td,
                        ...sideBorder,
                        borderRight: "none",
                        textAlign: "right",
                      }}
                    >
                      Name of the signatory:
                    </td>
                    <td
                      colSpan={2}
                      style={{ ...td, ...sideBorder, borderLeft: "none", ...B }}
                    >
                      {AGENT.nameUpper}
                    </td>
                  </tr>
                  {/* Rows 24-25 */}
                  {[`(IN/PA No. ${AGENT.regNo})`, `of ${AGENT.firm}`].map(
                    (val, i) => (
                      <tr key={i}>
                        <td
                          colSpan={2}
                          style={{ ...td, ...sideBorder, borderLeft: "none" }}
                        >
                          {val}
                        </td>
                      </tr>
                    ),
                  )}
                  {/* Row 26 */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{ ...td, ...sideBorder, borderLeft: "none" }}
                    >
                      AGENT FOR THE APPLICANT(S)
                    </td>
                  </tr>

                  {/*
                    ══ ROW 27 — SECTION 3 (full-width, explicit all borders) ══
                    Single cell with:
                      - BOLD justified heading
                      - blank line
                      - normal body paragraph
                      - "Dated this DATE" BOLD centered
                    NO nested table
                  */}
                  <tr>
                    <td colSpan={4} style={{ ...td, ...allBorders, ...JUS }}>
                      <div style={{ ...B, marginBottom: "8px" }}>
                        3. DECLARATION TO BE GIVEN WHEN THE APPLICATION IN INDIA
                        IS FILED BY THE APPLICANT(S) IN THE CONVENTION COUNTRY:
                        -
                      </div>
                      <div style={{ height: "6px" }}></div>
                      <div style={{ ...N, marginBottom: "12px" }}>
                        We the applicant(s) in the convention country hereby
                        declare that our&nbsp; right to apply for a patent in
                        India is by way of assignment from the true and first
                        inventor(s).
                      </div>
                    </td>
                  </tr>

                  {/*
                    ══ ROWS 28-32 — Section 3 signature (DEFAULT borders) ══
                    Same visual layout as rows 22-26 but different column proportions:
                    Left col (C1+C2+C3 = 78.7%) | Right col (C4 = 21.3%)
                    Row 28: "Signature:" (right-aligned) | empty
                    Rows 29-32: label | value
                    NO nested table
                  */}
                  {/* Row 28: Signature */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...td,
                        ...sideBorder,
                        borderRight: "none",
                        textAlign: "right",
                      }}
                    >
                      Dated This:
                    </td>
                    <td
                      colSpan={2}
                      style={{ ...sideBorder, borderLeft: "none" }}
                    >
                      <strong>{formatDateLong(d.filingDate)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...td,
                        ...sideBorder,
                        borderRight: "none",
                        textAlign: "right",
                      }}
                    >
                      Signature:
                    </td>
                    <td
                      colSpan={2}
                      style={{ ...sideBorder, borderLeft: "none" }}
                    ></td>
                  </tr>
                  {/* Row 29: Name of signatory */}
                  <tr>
                    <td
                      colSpan={2}
                      rowSpan={4}
                      style={{
                        ...td,
                        ...sideBorder,
                        borderRight: "none",
                        textAlign: "right",
                      }}
                    >
                      Name of the signatory:
                    </td>
                    <td
                      colSpan={2}
                      style={{ ...td, ...sideBorder, borderLeft: "none", ...B }}
                    >
                      {AGENT.nameUpper}
                    </td>
                  </tr>

                  {/* Rows 30-31 */}
                  {[`(IN/PA No. ${AGENT.regNo})`, `of ${AGENT.firm}`].map(
                    (val, i) => (
                      <tr key={i}>
                        <td
                          colSpan={2}
                          style={{ ...td, ...sideBorder, borderLeft: "none" }}
                        >
                          {val}
                        </td>
                      </tr>
                    ),
                  )}
                  {/* Row 32 */}
                  <tr>
                    <td
                      colSpan={2}
                      style={{ ...td, ...sideBorder, borderLeft: "none" }}
                    >
                      AGENT FOR THE APPLICANT(S)
                    </td>
                  </tr>

                  {/*
                    ══ ROW 33 — SECTION 4: STATEMENT ══
                    Cell-1 (C1+C2+C3 = 78.7%, explicit all borders) contains ALL text:
                      - "4. STATEMENT" BOLD + normal rest (same para)
                      - strikethrough paragraph
                      - "Dated this" centered
                      - "Signature of additional inventor(s):" centered
                      - "Name: ………" centered
                      - blank
                      - "To, / The Controller..." left-aligned
                    Cell-2 (C4 = 21.3%, DEFAULT) = empty
                    NO nested table
                  */}
                  <tr>
                    <td colSpan={4} style={{ ...td, ...allBorders, ...JUS }}>
                      <div style={{ marginBottom: "8px" }}>
                        <strong>4.&nbsp;&nbsp;&nbsp;&nbsp;STATEMENT</strong>
                        <span style={{ ...N }}>
                          {" "}
                          (to be signed by the additional inventor(s) not
                          mentioned in the application form)
                        </span>
                      </div>
                      <div
                        style={{
                          ...N,
                          textDecoration: "line-through",
                          marginBottom: "12px",
                        }}
                      >
                        We assent to the invention referred to in the above
                        declaration, being included in the complete
                        specification filed in pursuance of the stated
                        application.
                      </div>
                      <div style={{ ...N, ...CEN, marginBottom: "14px" }}>
                        Dated this ………. day of …….., …….
                      </div>
                      <div style={{ ...N, ...CEN, marginBottom: "6px" }}>
                        Signature of the additional inventor(s):
                      </div>
                      <div style={{ ...N, ...CEN, marginBottom: "20px" }}>
                        Name:&nbsp;&nbsp;&nbsp;&nbsp;……………………
                      </div>
                      <div style={{ ...N }}>To,</div>
                      <div style={{ ...N }}>The Controller of Patents,</div>
                      <div style={{ ...N }}>The Patent Office,</div>
                      <div style={{ ...N }}>
                        At <strong>{d.patentOffice}</strong>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
