import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

const numberToWords = (num) => {
  if (!num || isNaN(num)) return "Zero";
  const n = Math.abs(Math.floor(num));
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
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100)
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000)
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " " + numberToWords(n % 100) : "")
    );
  if (n < 100000)
    return (
      numberToWords(Math.floor(n / 1000)) +
      " Thousand" +
      (n % 1000 ? " " + numberToWords(n % 1000) : "")
    );
  if (n < 10000000)
    return (
      numberToWords(Math.floor(n / 100000)) +
      " Lakh" +
      (n % 100000 ? " " + numberToWords(n % 100000) : "")
    );
  return (
    numberToWords(Math.floor(n / 10000000)) +
    " Crore" +
    (n % 10000000 ? " " + numberToWords(n % 10000000) : "")
  );
};

const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const mo = [
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
  return `${mo[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const fmtDateLong = (s) => {
  if (!s) return "_____";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "_____";
  const mo = [
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
  return `${mo[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

// ─── Static Agent ─────────────────────────────────────────────────────────────
const AG = {
  name: "Amit Aswal",
  nameU: "AMIT ASWAL",
  regNo: "2185",
  firm: "anovIP",
  addr: "161-B/4, 6th Floor, Gulmohar House, Yusuf Sarai Community Center, Gautam Nagar, Green Park, New Delhi \u2013 110049, India",
  tel: "011 \u2013 41835550",
  mob: "9773654477",
  fax: "011 \u2013 41835551",
  email: "info@anovip.com",
};
const PO = {
  "New Delhi": "New Delhi",
  Mumbai: "Mumbai",
  Kolkata: "Kolkata",
  Chennai: "Chennai",
};

// ─── Transform ────────────────────────────────────────────────────────────────
const transform = (db) => {
  if (!db) return null;
  const at = db.application_type || "";
  const ac = db.applicant_category || "";
  return {
    docketNo: db.DOC_NO?.trim() || "",
    patentOffice: PO[db.jurisdiction] || "New Delhi",
    isOrdinary: ![
      "CONVENTION",
      "PCT-NATIONAL-PHASE",
      "PPH",
      "DIVISIONAL",
      "PATENT-OF-ADDITION",
    ].includes(at),
    isConvention: at === "CONVENTION",
    isPCT: at === "PCT-NATIONAL-PHASE",
    isPPH: at === "PPH",
    isDivisional: at === "DIVISIONAL",
    isPA: at === "PATENT-OF-ADDITION",
    isNatural: ac === "Natural",
    isSmall: ac === "Small",
    isStartup: ac === "Start",
    isEdu: ac === "education",
    isOther: ac === "Other",
    inventionTitle: db.title || "",
    applicants: (db.applicants || []).map((a) => ({
      name: a.name || "",
      nationality: a.nationality || "",
      residence: a.residence_country || "",
      address: a.address || "",
    })),
    invSameAsApp: db.inventors_same_as_applicant === "yes",
    inventors: (db.inventors || []).map((i) => ({
      name: i.name || "",
      nationality: i.citizen_country || "",
      residence: i.residence_country || "",
      address: i.address || "",
    })),
    hasPriority: db.claiming_priority === "yes",
    priorities: (db.priorities || []).map((p) => ({
      country: p.country || "",
      appNo: p.priority_no || "",
      date: fmtDate(p.priority_date),
      applicant: p.applicant_name || "",
      title: p.title_in_priority || "",
    })),
    intlAppNo: db.inter_appli_no || "",
    intlDate: fmtDate(db.inter_filing_date),
    descPages: +db.descrip_of_page || 0,
    claimPages: +db.claims_page || 0,
    drawPages: +db.drawing_page || 0,
    abstPages: +db.abstract_page || 1,
    form2Pages: +db.form_2_page || 1,
    totalPages: +db.total_pages || 0,
    numDrawings: +db.number_of_drawing || 0,
    numClaims: +db.number_of_claims || 0,
    basicFee: +db.basic_fee || 0,
    extraPages: +db.no_of_extra_page || 0,
    extraPagesFee: +db.extra_page_charge || 0,
    extraClaims: +db.no_of_extra_claims || 0,
    extraClaimsFee: +db.extra_claims_charge || 0,
    extraPriorities: +db.no_of_extra_priorities || 0,
    extraPriorFee: +db.extra_priorities_charge || 0,
    reqExam: db.request_examination === "yes",
    examFee: +db.examination_charge || 0,
    seqFee: +db.sequence_charge || 0,
    depositDate: db.deposit_date || "",
    totalFee: +db.deposit_fee || 0,
  };
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const BRD = "1px solid #000";
const F = "Times New Roman, serif";
const cell = (o = {}) => ({
  border: BRD,
  padding: "3px 5px",
  verticalAlign: "top",
  fontSize: "9.5pt",
  fontFamily: F,
  wordWrap: "break-word",
  overflow: "hidden",
  ...o,
});
const hcell = (o = {}) => ({
  border: BRD,
  padding: "3px 5px",
  verticalAlign: "middle",
  fontSize: "9.5pt",
  fontFamily: F,
  fontWeight: "bold",
  textAlign: "center",
  wordWrap: "break-word",
  overflow: "hidden",
  ...o,
});

// (√) / ( ) exactly as in Word — parenthesis tick style
const Tick = ({ on, label = "", bold = false }) => (
  <span style={{ fontWeight: bold ? "bold" : "normal", whiteSpace: "nowrap" }}>
    {on ? "(\u221A)" : "(\u00A0\u00A0)"}
    {label ? "\u00A0" + label : ""}
  </span>
);

// ☑ ☒ Unicode chars exactly as Word uses in Table 9
const CK = ({ on }) => (
  <span style={{ fontSize: "10.5pt" }}>{on ? "\u2611" : "\u2612"}</span>
);

// Table with fixed layout
const T = ({ cols, children, style = {} }) => (
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      tableLayout: "fixed",
      ...style,
    }}
  >
    {cols && (
      <colgroup>
        {cols.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
    )}
    <tbody>{children}</tbody>
  </table>
);

export default function Form1Generator({ formData, onClose }) {
  const ref = useRef();
  const d = transform(formData);

  if (!d)
    return (
      <div
        className="modal show d-block"
        style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5>Form 1</h5>
              <button className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body text-center p-5">
              <p>No data.</p>
            </div>
          </div>
        </div>
      </div>
    );

  const dlPDF = () =>
    html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename: `Form1_${d.docketNo || "Patent"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          windowWidth: ref.current.scrollWidth,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      })
      .from(ref.current)
      .save();

  const dlDOCX = () => {
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body{font-family:'Times New Roman',serif;font-size:10pt;margin:15mm}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:3px 5px;font-size:9.5pt;vertical-align:top;word-wrap:break-word}</style></head><body>${ref.current.innerHTML}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Form1_${d.docketNo || "Patent"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const firstApp = d.applicants[0] || {};
  const invList = d.invSameAsApp ? d.applicants : d.inventors;
  const isPCT = d.isPCT;
  const hasConv = d.isConvention || d.hasPriority;

  const page = {
    fontFamily: F,
    fontSize: "9.5pt",
    lineHeight: "1.3",
    background: "#fff",
    color: "#000",
    padding: "12mm 14mm",
    maxWidth: "210mm",
    margin: "0 auto",
  };

  // ── Table 1 — 13 columns (exact Word grid widths as %)
  // Grid: 1270,573,557,290,1193,88,1274,567,567,567,284,2126,1701 / 11057
  // Col%: 11.49, 5.18, 5.04, 2.62, 10.79, 0.80, 11.52, 5.13, 5.13, 5.13, 2.57, 19.23, 15.38
  const t1cols = [
    "11.49%",
    "5.18%",
    "5.04%",
    "2.62%",
    "10.79%",
    "0.80%",
    "11.52%",
    "5.13%",
    "5.13%",
    "5.13%",
    "2.57%",
    "19.23%",
    "15.38%",
  ];

  // ── Table 2 / 4 address rows — same 13-col grid but 7 logical columns:
  // Name(gs=2=16.67%) | Gender(gs=2=10.22%) | Nationality(gs=2=11.59%) | Country(gs=1=11.52%) | Age(gs=2=10.26%) | AddrLabel(gs=2=...) | AddrValue(gs=2=...)
  // From XML: w=1840,850,1280,1280,1135,1323,3350 (Table 2 col widths)
  // Total Table2 = 11058 ≈ 11057
  const t2total = 11058;
  const t2cols = [
    `${((1840 / t2total) * 100).toFixed(2)}%`, // Name
    `${((850 / t2total) * 100).toFixed(2)}%`, // Gender
    `${((1280 / t2total) * 100).toFixed(2)}%`, // Nationality
    `${((1280 / t2total) * 100).toFixed(2)}%`, // Country
    `${((1135 / t2total) * 100).toFixed(2)}%`, // Age
    `${((1323 / t2total) * 100).toFixed(2)}%`, // Addr label
    `${((3350 / t2total) * 100).toFixed(2)}%`, // Addr value
  ];

  // ── Table 3 — 12 equal cols (12 * 921 ≈ 11057)
  const t3cols = Array(12).fill(`${(100 / 12).toFixed(3)}%`);

  // ── Table 4 inventor rows — from XML: 1840,850,1280,1280,1125,1318,3350
  const t4total = 11043;
  const t4cols = [
    `${((1840 / t4total) * 100).toFixed(2)}%`,
    `${((850 / t4total) * 100).toFixed(2)}%`,
    `${((1280 / t4total) * 100).toFixed(2)}%`,
    `${((1280 / t4total) * 100).toFixed(2)}%`,
    `${((1125 / t4total) * 100).toFixed(2)}%`,
    `${((1318 / t4total) * 100).toFixed(2)}%`,
    `${((3350 / t4total) * 100).toFixed(2)}%`,
  ];

  // ── Table 5 — 8 equal cols
  const t5cols = Array(8).fill("12.5%");

  // ── Table 6 — 6 cols from XML: 2980,986,1416,1141,2012,2530 / 11065
  const t6total = 11065;
  const t6cols = [
    `${((2980 / t6total) * 100).toFixed(2)}%`,
    `${((986 / t6total) * 100).toFixed(2)}%`,
    `${((1416 / t6total) * 100).toFixed(2)}%`,
    `${((1141 / t6total) * 100).toFixed(2)}%`,
    `${((2012 / t6total) * 100).toFixed(2)}%`,
    `${((2530 / t6total) * 100).toFixed(2)}%`,
  ];

  // ── Table 7 — 4 cols: 5081,+(5976 split into 3) from XML w=5081 and gs=3 w=5976
  // Actually 2 logical: 5081 | 5976 (colspan 3 of 4)
  const t7cols = ["45.98%", "18.01%", "18.01%", "18.01%"]; // 5081/11057 | 5976/3/11057 *3

  // ── Table 8 — sig: 5104,3402,2551 / 11057
  const t8cols = ["46.17%", "30.77%", "23.08%"];

  // ── Table 9 — 2 cols: 562,10245 / 10807
  const t9cols = ["5.2%", "94.8%"];

  // ── Table 10 — sig table: 2548,4010 / 6558
  const t10cols = ["38.85%", "61.15%"];

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title fw-bold">
              Form 1 Preview - {d.docketNo}
            </h5>
            <div className="d-flex gap-2">
              <button className="btn btn-danger btn-sm" onClick={dlPDF}>
                Download PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={dlDOCX}>
                Download DOCX
              </button>
              <button className="btn-close ms-2" onClick={onClose} />
            </div>
          </div>
          <div className="modal-body bg-secondary bg-opacity-10 p-3">
            <div ref={ref} style={page}>
              {/*
          ════════════════════════════════════════════════════════════
          TABLE 1 — 13 cols
          FORM 1 header (rowspan 6) | Office use | Ref | Type of App | 3A header
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t1cols}>
                {/* R1: FORM 1 (gs=10,rs=6) | FOR OFFICE USE ONLY (gs=3) */}
                <tr>
                  <td
                    colSpan={10}
                    rowSpan={6}
                    style={cell({
                      textAlign: "center",
                      verticalAlign: "middle",
                      padding: "8px 6px",
                    })}
                  >
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "13pt",
                        marginBottom: "1px",
                      }}
                    >
                      FORM 1
                    </div>
                    <div>THE PATENTS ACT 1970</div>
                    <div>(39 of 1970)</div>
                    <div>and</div>
                    <div>THE PATENTS RULES, 2003</div>
                    <div style={{ fontWeight: "bold", marginTop: "3px" }}>
                      APPLICATION FOR GRANT OF PATENT
                    </div>
                    <div style={{ fontStyle: "italic", fontSize: "8.5pt" }}>
                      [<em>See</em> Section 7, 54 and 135 and sub-rule (1) of
                      rule 20]
                    </div>
                  </td>
                  <td colSpan={3} style={hcell()}>
                    ( FOR OFFICE USE ONLY )
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Application No.:
                  </td>
                  <td style={cell()}>&nbsp;</td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Filing Date:
                  </td>
                  <td style={cell()}>&nbsp;</td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Amount of Fee paid:
                  </td>
                  <td style={cell()}>&nbsp;</td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    CBR No.:
                  </td>
                  <td style={cell()}>&nbsp;</td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Signature:
                  </td>
                  <td style={cell()}>&nbsp;</td>
                </tr>

                {/* R7: Section 1 — ref (gs=10 | gs=3) */}
                <tr>
                  <td colSpan={10} style={cell({ fontWeight: "bold" })}>
                    1.&nbsp;&nbsp;APPLICANT'S REFERENCE / IDENTIFICATION NO. (AS
                    ALLOTTED BY OFFICE)
                  </td>
                  <td colSpan={3} style={cell()}>
                    {d.docketNo}
                  </td>
                </tr>

                {/* R8: Section 2 header (gs=13) */}
                <tr>
                  <td colSpan={13} style={cell({ fontWeight: "bold" })}>
                    2.&nbsp;&nbsp;TYPE OF APPLICATION [Please tick (&radic;) at
                    the appropriate category]
                  </td>
                </tr>

                {/*
              R9: Row 1 of type options
              Ordinary(gs=3,w=21.7%) | Convention(gs=5,w=30.9%) | PCT-NP(gs=4,w=32.1%) | PPH(gs=1,w=15.4%)
            */}
                <tr>
                  <td colSpan={3} style={cell({ textAlign: "center" })}>
                    Ordinary <Tick on={d.isOrdinary} />
                  </td>
                  <td colSpan={5} style={cell({ textAlign: "center" })}>
                    Convention <Tick on={d.isConvention} />
                  </td>
                  <td
                    colSpan={4}
                    style={cell({
                      textAlign: "center",
                      fontWeight: d.isPCT ? "bold" : "normal",
                    })}
                  >
                    PCT-NP <Tick on={d.isPCT} bold={d.isPCT} />
                  </td>
                  <td colSpan={1} style={cell({ textAlign: "center" })}>
                    PPH <Tick on={d.isPPH} />
                  </td>
                </tr>

                {/*
              R10: Row 2 of type options — exact Word widths:
              Divisional(gs=1,11.5%) | Patent of Addition(gs=2,10.2%) | Divisional(gs=2,13.4%) |
              Patent of Addition(gs=3,17.4%) | Divisional(gs=3,12.8%) | Patent of Addition(gs=1,19.2%) | empty(15.4%)
              Text: "Divisional ( )" and "Patent of\nAddition\n( )" as in the Word doc
            */}
                <tr>
                  <td
                    colSpan={1}
                    style={cell({ textAlign: "center", fontSize: "8.5pt" })}
                  >
                    Divisional <Tick on={d.isDivisional} />
                  </td>
                  <td
                    colSpan={2}
                    style={cell({ textAlign: "center", fontSize: "8.5pt" })}
                  >
                    Patent of
                    <br />
                    Addition
                    <br />
                    <Tick on={d.isPA} />
                  </td>
                  <td
                    colSpan={2}
                    style={cell({ textAlign: "center", fontSize: "8.5pt" })}
                  >
                    Divisional
                    <br />
                    <Tick on={false} />
                  </td>
                  <td
                    colSpan={3}
                    style={cell({ textAlign: "center", fontSize: "8.5pt" })}
                  >
                    Patent of
                    <br />
                    Addition
                    <br />
                    <Tick on={false} />
                  </td>
                  <td
                    colSpan={3}
                    style={cell({ textAlign: "center", fontSize: "8.5pt" })}
                  >
                    Divisional
                    <br />
                    <Tick on={false} />
                  </td>
                  <td
                    colSpan={1}
                    style={cell({ textAlign: "center", fontSize: "8.5pt" })}
                  >
                    Patent of
                    <br />
                    Addition
                    <br />
                    <Tick on={false} />
                  </td>
                  <td
                    colSpan={1}
                    style={cell({ borderRight: "1px solid black" })}
                  ></td>
                </tr>

                {/* R11: 3A header (gs=13) */}
                <tr>
                  <td colSpan={13} style={cell({ fontWeight: "bold" })}>
                    3A. APPLICANT(S)
                  </td>
                </tr>

                {/*
              R12: 3A column headers
              Name(gs=2) | Gender(gs=2) | Nationality(gs=2) | Country(gs=1) | Age(gs=2) | Address(gs=4)
            */}
                <tr>
                  <td colSpan={2} style={hcell()}>
                    Name in Full
                  </td>
                  <td colSpan={2} style={hcell()}>
                    Gender (optional, for individuals)
                  </td>
                  <td colSpan={2} style={hcell()}>
                    Nationality
                  </td>
                  <td colSpan={1} style={hcell()}>
                    Country of Residence
                  </td>
                  <td colSpan={2} style={hcell()}>
                    Age (optional, for natural persons)
                  </td>
                  <td colSpan={4} style={hcell()}>
                    Address of the Applicant
                  </td>
                </tr>
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 2 — Applicant data
          7 cols, cols 1-5 use rowSpan across address rows
          Cols 6-7: address label | address value (one row each)
          From XML: each applicant = rows for House No, Street, City, State, Country, Pincode, Email, Contact
          ════════════════════════════════════════════════════════════
          */}
              {d.applicants.map((app, ai) => {
                const natText = d.isNatural
                  ? `a citizen of ${app.nationality}`
                  : `a company organized and existing under the laws of ${app.nationality}`;
                const addrRows = [
                  ["House No.", app.address],
                  ["Street", ""],
                  ["City", ""],
                  ["State", ""],
                  ["Country", ""],
                  ["Pincode", ""],
                  [
                    "Email (OTP verification mandatory -will be redacted)",
                    AG.email,
                  ],
                  [
                    "Contact number (OTP verification mandatory -will be redacted)",
                    AG.mob,
                  ],
                ];
                const rs = addrRows.length;
                return (
                  <T key={ai} cols={t2cols}>
                    {addrRows.map((ar, ri) => (
                      <tr key={ri}>
                        {ri === 0 && (
                          <>
                            <td
                              rowSpan={rs}
                              style={cell({
                                fontWeight: "bold",
                                verticalAlign: "top",
                              })}
                            >
                              {app.name}
                            </td>

                            <td
                              rowSpan={rs}
                              style={cell({ verticalAlign: "top" })}
                            >
                              Prefer not to disclose
                            </td>

                            <td
                              rowSpan={rs}
                              style={cell({ verticalAlign: "top" })}
                            >
                              {natText}
                            </td>

                            <td
                              rowSpan={rs}
                              style={cell({ verticalAlign: "top" })}
                            >
                              {app.residence || app.nationality}
                            </td>

                            <td
                              rowSpan={rs}
                              style={cell({ verticalAlign: "top" })}
                            >
                              Prefer not to disclose
                            </td>
                          </>
                        )}

                        {/* Left label column */}
                        <td style={cell({ fontSize: "8.5pt" })}>{ar[0]}</td>

                        {/* ✅ Address column with rowspan ONLY for first 6 rows */}
                        {ri === 0 && (
                          <td
                            rowSpan={6}
                            style={cell({
                              fontSize: "8.5pt",
                              verticalAlign: "middle", // center vertically
                              textAlign: "left",
                            })}
                          >
                            {addrRows[0][1]}
                          </td>
                        )}

                        {/* After Pincode (ri >= 6), render normally */}
                        {ri >= 6 && (
                          <td style={cell({ fontSize: "8.5pt" })}>{ar[1]}</td>
                        )}
                      </tr>
                    ))}
                  </T>
                );
              })}

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 3 — 12 cols
          3B Category | Section 4 header | Inventor question | Inventor col headers
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t3cols}>
                {/* 3B header */}
                <tr>
                  <td colSpan={12} style={cell({ fontWeight: "bold" })}>
                    3B.CATEGORY OF APPLICANT [Please tick (&radic;) at the
                    appropriate&nbsp;&nbsp; category]
                  </td>
                </tr>
                {/*
              Natural Person(gs=3,rs=2) | Other than Natural(gs=8) | Educational(gs=1,rs=2)
              From XML: gs=3 w=2836 | gs=8 w=5386 | gs=1 w=2835
            */}
                <tr>
                  <td
                    colSpan={3}
                    rowSpan={2}
                    style={cell({ verticalAlign: "middle" })}
                  >
                    Natural Person <Tick on={d.isNatural} />
                  </td>
                  <td colSpan={8} style={cell()}>
                    Other than Natural Person{" "}
                    <Tick on={!d.isNatural && !d.isEdu} />
                  </td>
                  <td
                    colSpan={1}
                    rowSpan={2}
                    style={cell({ verticalAlign: "middle" })}
                  >
                    Educational Institution <Tick on={d.isEdu} />
                  </td>
                </tr>
                {/*
              (Natural rowspan continues) | Small Entity(gs=2) | Startup(gs=4) | Others(gs=2) | empty(gs=1,no border)
              From XML: gs=2 w=2126 | gs=4 w=1559 | gs=2 w=1701 | gs=1 w=2835
            */}
                <tr>
                  <td colSpan={2} style={cell()}>
                    &nbsp;Small Entity <Tick on={d.isSmall} />
                  </td>
                  <td colSpan={4} style={cell()}>
                    Startup <Tick on={d.isStartup} />
                  </td>
                  <td colSpan={2} style={cell()}>
                    <strong>Others</strong> <Tick on={d.isOther} />
                  </td>
                  <td colSpan={1} style={{ border: "none" }}></td>
                </tr>

                {/* Section 4 header (gs=12) */}
                <tr>
                  <td colSpan={12} style={cell({ fontWeight: "bold" })}>
                    4.&nbsp;&nbsp;INVENTOR(S) [Please tick (&radic;) at the
                    appropriate category]
                  </td>
                </tr>
                {/* Are inventors same (gs=6) | Yes(gs=4) | No(gs=2) — from XML */}
                <tr>
                  <td colSpan={6} style={cell()}>
                    Are all the inventor(s) same as the applicant(s) named
                    above?
                  </td>
                  <td colSpan={4} style={cell({ textAlign: "center" })}>
                    Yes
                    <Tick on={d.invSameAsApp} />
                  </td>
                  <td colSpan={2} style={cell({ textAlign: "center" })}>
                    No
                    <Tick on={!d.invSameAsApp} />
                  </td>
                </tr>

                {/* If No row (gs=12) */}
                {!d.invSameAsApp && (
                  <tr>
                    <td colSpan={12} style={cell()}>
                      <strong>If &ldquo;No&rdquo;,</strong> furnish the details
                      of the inventor(s)
                    </td>
                  </tr>
                )}

                {/* Inventor column headers — from XML: Name(gs=1) | Gender(gs=1) | Nationality(gs=2) | Age(gs=3) | Country(gs=1) | Address(gs=4) */}
                {!d.invSameAsApp && (
                  <tr>
                    <td colSpan={1} style={hcell()}>
                      Name in Full
                    </td>
                    <td colSpan={1} style={hcell()}>
                      Gender (optional, for individuals)
                    </td>
                    <td colSpan={2} style={hcell()}>
                      Nationality
                    </td>
                    <td colSpan={3} style={hcell()}>
                      Age (optional, for natural persons)
                    </td>
                    <td colSpan={1} style={hcell()}>
                      Country of Residence
                    </td>
                    <td colSpan={4} style={hcell()}>
                      Address of the Inventor
                    </td>
                  </tr>
                )}
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 4 — Inventor data rows (same pattern as Table 2)
          From XML: 7 cols, each inventor = 6 address rows (no email/contact)
          ════════════════════════════════════════════════════════════
          */}
              {!d.invSameAsApp &&
                d.inventors.map((inv, ii) => {
                  const addrRows = [
                    "House No.",
                    "Street",
                    "City",
                    "State",
                    "Country",
                    "Pincode",
                  ];

                  const rs = addrRows.length;

                  return (
                    <T key={ii} cols={t4cols}>
                      {addrRows.map((label, ri) => (
                        <tr key={ri}>
                          {ri === 0 && (
                            <>
                              {/* Left Main Columns */}
                              <td
                                rowSpan={rs}
                                style={cell({
                                  fontWeight: "bold",
                                  verticalAlign: "top",
                                })}
                              >
                                {inv.name}
                              </td>

                              <td
                                rowSpan={rs}
                                style={cell({
                                  fontWeight: "bold",
                                  verticalAlign: "top",
                                })}
                              >
                                Prefer not to disclose
                              </td>

                              <td
                                rowSpan={rs}
                                style={cell({
                                  fontWeight: "bold",
                                  verticalAlign: "top",
                                })}
                              >
                                a citizen of {inv.nationality}
                              </td>

                              <td
                                rowSpan={rs}
                                style={cell({
                                  fontWeight: "bold",
                                  verticalAlign: "top",
                                })}
                              >
                                Prefer not to disclose
                              </td>

                              <td
                                rowSpan={rs}
                                style={cell({
                                  fontWeight: "bold",
                                  verticalAlign: "top",
                                })}
                              >
                                {inv.residence || inv.nationality}
                              </td>
                            </>
                          )}

                          {/* Address Label Column */}
                          <td style={cell({ fontSize: "8.5pt" })}>{label}</td>

                          {/* Address Value Column (Merged Vertically, RIGHT SIDE) */}
                          {ri === 0 && (
                            <td
                              rowSpan={rs}
                              style={cell({
                                fontSize: "8.5pt",
                                verticalAlign: "top",
                                fontWeight: "bold",
                              })}
                            >
                              {inv.address}
                            </td>
                          )}
                        </tr>
                      ))}
                    </T>
                  );
                })}

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 5 — 8 equal cols
          Title | Agent (gs=4 rowspan) | Address for service (gs=4 rowspan) | Section 8 header | Priority col headers
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t5cols}>
                {/* 5. Title */}
                <tr>
                  <td colSpan={8} style={cell({ fontWeight: "bold" })}>
                    5.&nbsp;&nbsp;TITLE OF THE INVENTION
                  </td>
                </tr>
                <tr>
                  <td colSpan={8} style={cell()}>
                    &ldquo;{d.inventionTitle}&rdquo;
                  </td>
                </tr>

                {/* 6. Agent — left cell (gs=4,rs=3) | IN/PA(gs=2) | value(gs=2) */}
                <tr>
                  <td
                    colSpan={4}
                    rowSpan={3}
                    style={cell({
                      fontWeight: "bold",
                      verticalAlign: "middle",
                    })}
                  >
                    6.&nbsp;&nbsp;AUTHORISED REGISTERED PATENT AGENT(S)
                  </td>
                  <td colSpan={2} style={cell()}>
                    IN/PA No.
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.regNo}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Name
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.name}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell({ fontSize: "8.5pt" })}>
                    Mobile No. (OTP verification mandatory -will be redacted)
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.mob}
                  </td>
                </tr>

                {/* 7. Address for service — left (gs=4,rs=6) | right rows */}
                {/* From XML: Name label | anovIP+addr (rs=2) ; Postal Address label | (merged) ; Tel | val ; Mob | val ; Fax | val ; Email | val */}
                <tr>
                  <td
                    colSpan={4}
                    rowSpan={6}
                    style={cell({
                      fontWeight: "bold",
                      verticalAlign: "middle",
                    })}
                  >
                    7.&nbsp;&nbsp;ADDRESS FOR SERVICE OF APPLICANT IN INDIA
                  </td>
                  <td colSpan={2} style={cell()}>
                    Name
                  </td>
                  <td
                    colSpan={2}
                    rowSpan={2}
                    style={cell({ verticalAlign: "top" })}
                  >
                    <strong>{AG.firm}</strong>
                    <br />
                    {AG.addr}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Postal Address
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Telephone No.
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.tel}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell({ fontSize: "8.5pt" })}>
                    Mobile No. (OTP verification mandatory -will be redacted)
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.mob}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    Fax No.
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.fax}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell({ fontSize: "8.5pt" })}>
                    E-mail ID (OTP verification mandatory -will be redacted)
                  </td>
                  <td colSpan={2} style={cell()}>
                    {AG.email}
                  </td>
                </tr>

                {/* 8. Convention priority header (gs=8) */}
                <tr>
                  <td colSpan={8} style={cell({ fontWeight: "bold" })}>
                    8.&nbsp;&nbsp;IN CASE OF APPLICATION CLAIMING PRIORITY OF
                    APPLICATION FILED IN CONVENTION COUNTRY, PARTICULARS OF
                    CONVENTION APPLICATION
                  </td>
                </tr>

                {/* Priority column headers — from XML: Country(1) | App No(1) | Filing Date(1) | Name(gs=2) | Title(gs=2) | IPC(1) */}
                <tr>
                  <td colSpan={1} style={hcell()}>
                    Country
                  </td>
                  <td colSpan={1} style={hcell()}>
                    Application Number
                  </td>
                  <td colSpan={1} style={hcell()}>
                    Filing Date
                  </td>
                  <td colSpan={2} style={hcell()}>
                    Name of the Applicant
                  </td>
                  <td colSpan={2} style={hcell()}>
                    Title of the invention
                  </td>
                  <td colSpan={1} style={hcell()}>
                    IPC (as classified in the convention country)
                  </td>
                </tr>
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 6 — 6 cols, priority data rows
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t6cols}>
                {d.hasPriority && d.priorities.length > 0 ? (
                  d.priorities.map((p, i) => (
                    <tr key={i}>
                      <td style={cell({ fontWeight: "bold" })}>{p.country}</td>
                      <td style={cell({ fontWeight: "bold" })}>{p.appNo}</td>
                      <td style={cell({ fontWeight: "bold" })}>{p.date}</td>
                      <td style={cell({ fontWeight: "bold" })}>
                        {p.applicant || firstApp.name}
                      </td>
                      <td style={cell({ fontWeight: "bold" })}>
                        {p.title || d.inventionTitle}
                      </td>
                      <td style={cell()}>&nbsp;</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={cell()}>
                      &nbsp;
                    </td>
                  </tr>
                )}
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 7 — 4 cols (2 logical: ~46% | ~54%)
          Sections 9, 10, 11, then 12 header + 12(i) text + Name/Sig/Date header
          ALL in one table exactly as Word XML
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t7cols}>
                {/* 9. PCT */}
                <tr>
                  <td colSpan={4} style={cell({ fontWeight: "bold" })}>
                    9.&nbsp;&nbsp;IN CASE OF PCT NATIONAL PHASE APPLICATION,
                    PARTICULARS OF INTERNATIONAL APPLICATION FILED UNDER PATENT
                    CO-OPERATION TREATY (PCT)
                  </td>
                </tr>
                <tr>
                  <td colSpan={1} style={cell()}>
                    International application number
                  </td>
                  <td colSpan={3} style={cell()}>
                    International Filing Date
                  </td>
                </tr>
                <tr>
                  <td colSpan={1} style={cell({ fontWeight: "bold" })}>
                    {isPCT ? d.intlAppNo : ""}
                  </td>
                  <td colSpan={3} style={cell({ fontWeight: "bold" })}>
                    {isPCT ? d.intlDate : ""}
                  </td>
                </tr>

                {/* 10. Divisional */}
                <tr>
                  <td colSpan={4} style={cell({ fontWeight: "bold" })}>
                    10.&nbsp;&nbsp;IN CASE OF DIVISIONAL APPLICATION FILED UNDER
                    SECTION 16, PARTICULARS OF ORIGINAL (FIRST) APPLICATION
                  </td>
                </tr>
                <tr>
                  <td colSpan={1} style={cell()}>
                    Original (first) application No.
                  </td>
                  <td colSpan={3} style={cell()}>
                    Date of filing of original (first) application
                  </td>
                </tr>
                <tr>
                  <td colSpan={1} style={cell()}>
                    -
                  </td>
                  <td colSpan={3} style={cell()}>
                    -
                  </td>
                </tr>

                {/* 11. Patent of Addition */}
                <tr>
                  <td colSpan={4} style={cell({ fontWeight: "bold" })}>
                    11.&nbsp;&nbsp;IN CASE OF PATENT OF ADDITION FILED UNDER
                    SECTION 54, PARTICULARS OF MAIN APPLICATION OR PATENT
                  </td>
                </tr>
                <tr>
                  <td colSpan={1} style={cell()}>
                    Main application/patent No.
                  </td>
                  <td colSpan={3} style={cell()}>
                    Date of filing of main application
                  </td>
                </tr>
                <tr>
                  <td colSpan={1} style={cell()}>
                    -
                  </td>
                  <td colSpan={3} style={cell()}>
                    -
                  </td>
                </tr>

                {/* 12. DECLARATIONS header (gs=4) */}
                <tr>
                  <td colSpan={4} style={cell({ fontWeight: "bold" })}>
                    12.&nbsp;&nbsp;DECLARATIONS
                  </td>
                </tr>

                {/*
              12(i) — From XML: full text in ONE cell (gs=4):
              "Declaration by the inventor(s)(In case the applicant is an assignee:...)"
            */}
                <tr>
                  <td colSpan={4} style={cell()}>
                    <p style={{ margin: "0 0 3px" }}>
                      <strong>
                        (i)&nbsp;&nbsp;Declaration by the inventor(s)
                      </strong>
                    </p>
                    <p style={{ margin: "0 0 3px", textAlign: "justify" }}>
                      <strong>(In case the applicant is an assignee:</strong>{" "}
                      the inventor(s) may sign herein below or the applicant may
                      upload the assignment or enclose the assignment with this
                      application for patent or send the assignment by
                      post/electronic transmission duly authenticated within the
                      prescribed period).
                    </p>
                    <p style={{ margin: "0", textAlign: "justify" }}>
                      We, the above named inventor(s) are the true &amp; first
                      inventor(s) for this Invention and declare that the
                      applicant(s) herein are our assignee or legal
                      representative.
                    </p>
                  </td>
                </tr>

                {/* Name(s) | Signature(s) | Date — header row (gs=2 | gs=1 | gs=1) */}
                <tr>
                  <td colSpan={2} style={hcell({ textAlign: "left" })}>
                    Name(s)
                  </td>
                  <td colSpan={1} style={hcell()}>
                    Signature(s)
                  </td>
                  <td colSpan={1} style={hcell()}>
                    Date
                  </td>
                </tr>
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 8 — 3 cols: inventor signature rows
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t8cols}>
                {invList.map((inv, i) => (
                  <tr key={i}>
                    <td colSpan={2} style={cell({ fontWeight: "bold" })}>
                      {inv.name}
                    </td>
                    <td style={cell({ minHeight: "20px" })}>&nbsp;</td>
                    <td style={cell()}>&nbsp;</td>
                  </tr>
                ))}
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          TABLE 9 — 2 cols (5.2% | 94.8%)
          Row 1: full-width cell = "(ii) struck + (iii) intro"
          Rows 2–12: CK | text
          ════════════════════════════════════════════════════════════
          */}
              <T cols={t9cols}>
                {/*
              Table 9 Row 1 (from XML gs=4 = full width):
              "(ii) Declaration by applicant in convention country" — all struck through
              then "(iii) Declaration by the applicant(s): We the applicant(s) hereby declare(s) that: -"
              then first ☑ item starts in NEXT cell of same row
            */}
                <tr>
                  <td colSpan={2} style={cell()}>
                    {/* (ii) — all struck through */}
                    <p
                      style={{
                        margin: "0 0 2px",
                        textDecoration: "line-through",
                      }}
                    >
                      <strong>
                        (ii)&nbsp;&nbsp;Declaration by the applicant(s) in the
                        convention country
                      </strong>
                    </p>
                    <p
                      style={{
                        margin: "0 0 2px",
                        textDecoration: "line-through",
                        textAlign: "justify",
                      }}
                    >
                      <strong>
                        (In case the applicant in India is different than the
                        applicant in the convention country:
                      </strong>{" "}
                      the applicant in the convention country may sign herein
                      below or applicant in India may upload the assignment from
                      the applicant in the convention country or enclose the
                      said assignment with this application for patent or send
                      the assignment by post/electronic transmission duly
                      authenticated within the prescribed period)
                    </p>
                    <p
                      style={{
                        margin: "0 0 2px",
                        textDecoration: "line-through",
                        textAlign: "justify",
                      }}
                    >
                      We, the applicant(s) in the convention country declare
                      that the applicant(s) herein are our assignee or legal
                      representative.
                    </p>
                    <p
                      style={{
                        margin: "0 0 1px",
                        textDecoration: "line-through",
                      }}
                    >
                      (a) Date:
                    </p>
                    <p
                      style={{
                        margin: "0 0 1px",
                        textDecoration: "line-through",
                      }}
                    >
                      (b) Signature(s) ________________________
                    </p>
                    <p
                      style={{
                        margin: "0 0 4px",
                        textDecoration: "line-through",
                      }}
                    >
                      (c) Name(s) of the signatory
                    </p>
                    {/* (iii) intro — not struck */}
                    <p style={{ margin: "0 0 2px" }}>
                      <strong>(iii) Declaration by the applicant(s):</strong>
                    </p>
                    <p style={{ margin: "0" }}>
                      We the applicant(s) hereby declare(s) that: -
                    </p>
                  </td>
                </tr>

                {/*
              Table 9 Row 2 from XML: cell1 (gs=4,w=11057) = "(iii) intro + ☑" — but we already put (iii) intro above
              Actually XML shows row2 col1 gs=4 ALSO has the ☑ char at end, and col2 has the first item text.
              So row 2 col1 = checkbox ☑, col2 = "We are in possession..."
              Let's render exactly: ☑ | text
            */}
                {[
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        We are in possession of the above-mentioned invention.
                      </>
                    ),
                  },
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        The{" "}
                        <span style={{ textDecoration: "line-through" }}>
                          provisional
                        </span>
                        /complete specification relating to the invention is
                        filed with this application.
                      </>
                    ),
                  },
                  {
                    on: false,
                    sk: true,
                    text: (
                      <>
                        The invention as disclosed in the specification uses the
                        biological material from India and the necessary
                        permission from the competent authority shall be
                        submitted by us before the grant of patent to me/us{"}"}
                      </>
                    ),
                  },
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        There is no lawful ground of objection(s) to the grant
                        of the Patent to us.
                      </>
                    ),
                  },
                  {
                    on: false,
                    sk: true,
                    text: <>We are the true &amp; first inventor(s).</>,
                  },
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        We are the assignee or legal representative of true
                        &amp; first inventor(s).
                      </>
                    ),
                  },
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        The application or each of the applications, particulars
                        of which are given in Paragraph-8, was the first
                        application in convention country/countries in respect
                        of our invention(s).
                      </>
                    ),
                  },
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        We claim the priority from the above mentioned
                        application(s) filed in convention country/countries and
                        state that no application for protection in respect of
                        the invention had been made in a convention country
                        before that date by us or by any person from which We
                        derive the title.
                      </>
                    ),
                  },
                  {
                    on: true,
                    sk: false,
                    text: (
                      <>
                        Our application in India is based on international
                        application under Patent Cooperation Treaty (PCT) as
                        mentioned in Paragraph-9.
                      </>
                    ),
                  },
                  {
                    on: false,
                    sk: true,
                    text: (
                      <>
                        The application is divided out of our application
                        particulars of which is given in Paragraph-10 and pray
                        that this application may be treated as deemed to have
                        been filed on DD/MM/YYYY under section 16 of the Act.
                      </>
                    ),
                  },
                  {
                    on: false,
                    sk: true,
                    text: (
                      <>
                        The said invention is an improvement in or modification
                        of the invention particulars of which are given in
                        Paragraph-11.
                      </>
                    ),
                  },
                ].map((item, i) => (
                  <tr key={i}>
                    <td
                      style={cell({
                        textAlign: "center",
                        padding: "2px 3px",
                        verticalAlign: "top",
                      })}
                    >
                      <CK on={item.on} />
                    </td>
                    <td
                      style={cell({
                        textDecoration: item.sk ? "line-through" : "none",
                        textAlign: "justify",
                      })}
                    >
                      {item.text}
                    </td>
                  </tr>
                ))}
              </T>

              {/*
          ════════════════════════════════════════════════════════════
          Section 13 — plain div (no table wrapper in Word)
          ════════════════════════════════════════════════════════════
          */}
              <div
                style={{
                  border: BRD,
                  borderTop: "none",
                  padding: "4px 6px",
                  fontFamily: F,
                  fontSize: "9.5pt",
                }}
              >
                <p style={{ margin: "0 0 2px", fontWeight: "bold" }}>
                  13.&nbsp;&nbsp;FOLLOWING ARE THE ATTACHMENTS WITH THE
                  APPLICATION
                </p>
                <p style={{ margin: "0 0 3px" }}>(a)&nbsp;&nbsp;Form 2</p>
              </div>

              {/* Fee table — 4 cols */}
              <T cols={["27%", "28%", "18%", "27%"]}>
                <tr>
                  <td style={hcell()}>Item</td>
                  <td style={hcell()}>Details</td>
                  <td style={hcell()}>Fee</td>
                  <td style={hcell()}>Remarks</td>
                </tr>
                <tr>
                  <td style={cell()}>
                    Complete/
                    <span style={{ textDecoration: "line-through" }}>
                      provisional
                    </span>{" "}
                    specification (description only)
                  </td>
                  <td style={cell()}>
                    No. of pages : <strong>{d.descPages}</strong>
                    <br />
                    Form 2 page : <strong>{d.form2Pages}</strong>
                  </td>
                  <td style={cell()}>
                    INR {d.basicFee}
                    <br />
                    INR {d.extraPagesFee}
                  </td>
                  <td style={cell()}>
                    Application Fee
                    <br />
                    Fee For Extra <strong>{d.extraPages}</strong> Pages
                  </td>
                </tr>
                <tr>
                  <td style={cell()}>No. of Claim(s)</td>
                  <td style={cell()}>
                    No. of claims : <strong>{d.numClaims}</strong>
                    <br />
                    No. of pages : <strong>{d.claimPages}</strong>
                  </td>
                  <td style={cell()}>INR {d.extraClaimsFee}</td>
                  <td style={cell()}>
                    Fee For Extra <strong>{d.extraClaims}</strong> claims
                  </td>
                </tr>
                <tr>
                  <td style={cell()}>Abstract</td>
                  <td style={cell()}>
                    No. of page : <strong>{d.abstPages}</strong>
                  </td>
                  <td style={cell()}>INR {d.extraPriorFee}</td>
                  <td style={cell()}>
                    Fee For Extra <strong>{d.extraPriorities}</strong> priority
                  </td>
                </tr>
                <tr>
                  <td style={cell()}>No. of Drawing(s)</td>
                  <td style={cell()}>
                    No. of drawings: <strong>{d.numDrawings}</strong> and No. of
                    pages: <strong>{d.drawPages}</strong>
                  </td>
                  <td style={cell()}>
                    INR {d.examFee}
                    <br />
                    INR {d.seqFee}
                  </td>
                  <td style={cell()}>
                    Fee For Examination
                    <br />
                    Fee For Sequence Listing
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={cell()}>
                    &nbsp;
                  </td>
                  <td style={cell({ fontWeight: "bold" })}>INR {d.totalFee}</td>
                  <td style={cell({ fontWeight: "bold" })}>TOTAL FEE</td>
                </tr>
              </T>

              {/* Attachment list (b)–(n) — plain div, no table, exactly as Word */}
              <div
                style={{
                  border: BRD,
                  borderTop: "none",
                  padding: "4px 8px",
                  fontFamily: F,
                  fontSize: "9.5pt",
                  lineHeight: "1.65",
                }}
              >
                <p style={{ margin: "0" }}>
                  (b)&nbsp;&nbsp;Complete Specification comprising, No. of
                  Claims &ndash; {d.numClaims} ({numberToWords(d.numClaims)})
                  with No. of Pages &ndash; {d.totalPages} (
                  {numberToWords(d.totalPages)})
                </p>
                <p style={{ margin: "0" }}>
                  (c)&nbsp;&nbsp;Drawings - No. of sheets &ndash; {d.drawPages}{" "}
                  ({numberToWords(d.drawPages)}&nbsp;&nbsp;)
                </p>
                <p style={{ margin: "0" }}>
                  (d)&nbsp;&nbsp;Statement and undertaking on Form 3
                </p>
                <p style={{ margin: "0" }}>
                  (e)&nbsp;&nbsp;Declaration of inventorship on Form 5
                </p>
                {d.reqExam && (
                  <p style={{ margin: "0" }}>
                    (f)&nbsp;&nbsp;&nbsp;Request for Examination on Form 18
                  </p>
                )}
                {isPCT && (
                  <>
                    <p style={{ margin: "0" }}>
                      (g)&nbsp;&nbsp;Copy of Notification of the International
                      Application Number and of the International Filing Date
                      RO/105
                    </p>
                    <p style={{ margin: "0" }}>
                      (h)&nbsp;&nbsp;Copy of Notification Concerning Submission
                      or Transmittal of Priority Document&nbsp;&nbsp;IB/304
                    </p>
                    <p style={{ margin: "0" }}>
                      (i)&nbsp;&nbsp;&nbsp;Copy of notification of the Recording
                      of a Change IB/306
                    </p>
                    <p style={{ margin: "0" }}>
                      (j)&nbsp;&nbsp;&nbsp;Copy of certified priority documents
                    </p>
                    <p style={{ margin: "0" }}>
                      (k)&nbsp;&nbsp;Copy of executed Form 1/Copy of deed of
                      Assignment
                    </p>
                    <p style={{ margin: "0" }}>
                      (l)&nbsp;&nbsp;&nbsp;Verified English translation of
                      Priority document
                    </p>
                    <p style={{ margin: "0" }}>
                      (m)Submission of DAS code (****)
                    </p>
                    <p style={{ margin: "0" }}>
                      (n)&nbsp;&nbsp;Copy of General Power of Authority.
                    </p>
                  </>
                )}
                {!isPCT && hasConv && (
                  <>
                    <p style={{ margin: "0" }}>
                      (g)&nbsp;&nbsp;Copy of certified Priority Document
                    </p>
                    <p style={{ margin: "0" }}>
                      (h)&nbsp;&nbsp;Copy of executed Form 1/Copy of deed of
                      Assignment
                    </p>
                    <p style={{ margin: "0" }}>
                      (i)&nbsp;&nbsp;&nbsp;Verified English translation of
                      Priority document
                    </p>
                    <p style={{ margin: "0" }}>
                      (j)&nbsp;&nbsp;&nbsp;Submission of DAS code (****)
                    </p>
                    <p style={{ margin: "0" }}>
                      (k)&nbsp;&nbsp;Copy of General Power of Authority.
                    </p>
                  </>
                )}
                {!isPCT && !hasConv && (
                  <>
                    <p style={{ margin: "0" }}>
                      (g)&nbsp;&nbsp;Copy of executed Form 1/Copy of deed of
                      Assignment
                    </p>
                    <p style={{ margin: "0" }}>
                      (h)&nbsp;&nbsp;Copy of General Power of Authority.
                    </p>
                  </>
                )}
                <br />
                <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>
                  Deposit of Total fee INR {d.totalFee}/- (
                  {numberToWords(d.totalFee)} only) - via electronic transfer.
                </p>
              </div>
              {/* Final declaration + dated — all in one bordered div (same as attachment div, no border-top) */}
              <div
                style={{
                  border: BRD,
                  borderTop: "none",
                  padding: "6px 8px",
                  fontFamily: F,
                  fontSize: "9.5pt",
                }}
              >
                <p style={{ margin: "0 0 8px", textAlign: "justify" }}>
                  We hereby declare that to the best of our knowledge,
                  information and belief the fact and matters stated herein are
                  correct and We request that a patent may be granted to us for
                  the said invention.
                </p>
                <p style={{ margin: "0 0 0", textAlign: "center" }}>
                  Dated this {fmtDateLong(d.depositDate)},
                </p>

                {/*
          ════════════════════════════════════════════════════════════
          TABLE 10 — Signature block
          From XML: 2 cols (2548:4010 = 38.85%:61.15%) — NO border on table itself
          5 rows: Signature: | blank ; Name of signatory: | AMIT ASWAL ;
                  blank | (IN/PA No. 2185) ; blank | of anovIP ; blank | AGENT FOR THE APPLICANT(S)
          Table is right-aligned (col1+col2 total = 6558/11057 = 59.3% of page width)
          ════════════════════════════════════════════════════════════
          */}
                <table
                  style={{
                    width: "59.3%",
                    marginLeft: "auto",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                    marginTop: "4px",
                  }}
                >
                  <colgroup>
                    <col style={{ width: "38.85%" }} />
                    <col style={{ width: "61.15%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td style={cell({ border: "none" })}>Signature:</td>
                      <td style={cell({ border: "none" })}>&nbsp;</td>
                    </tr>
                    <tr>
                      <td style={cell({ border: "none" })}>
                        Name of the signatory:
                      </td>
                      <td style={cell({ border: "none", fontWeight: "bold" })}>
                        {AG.nameU}
                      </td>
                    </tr>
                    <tr>
                      <td style={cell({ border: "none" })}>&nbsp;</td>
                      <td style={cell({ border: "none" })}>
                        (IN/PA No. {AG.regNo})
                      </td>
                    </tr>
                    <tr>
                      <td style={cell({ border: "none" })}>&nbsp;</td>
                      <td style={cell({ border: "none" })}>of {AG.firm}</td>
                    </tr>
                    <tr>
                      <td style={cell({ border: "none" })}>&nbsp;</td>
                      <td style={cell({ border: "none" })}>
                        AGENT FOR THE APPLICANT(S)
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/*
          "To," section — plain text AFTER table 10, no border, no table
          From XML: after </w:tbl> we see: "To, The Controller of PatentsThe Patent Office, At New Delhi"
          */}
                <div
                  style={{
                    fontFamily: F,
                    fontSize: "9.5pt",
                    marginTop: "8px",
                    paddingLeft: "2px",

                    paddingTop: "4px",
                  }}
                >
                  <div>To,</div>
                  <div>The Controller of Patents</div>
                  <div>The Patent Office,</div>
                  <div>
                    At <strong>{d.patentOffice}</strong>
                  </div>
                </div>
              </div>
            </div>
            {/* end page */}
          </div>
        </div>
      </div>
    </div>
  );
}
