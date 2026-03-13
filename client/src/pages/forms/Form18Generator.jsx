import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

const formatDateLong = (dateStr) => {
  if (!dateStr) return ".......... day of ........, .......";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return ".......... day of ........, .......";
  const day = date.getDate();
  const suffix = ["th", "st", "nd", "rd"][
    day % 10 > 3 || Math.floor(day / 10) === 1 ? 0 : day % 10
  ];
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
  return `${day}${suffix} day of ${months[date.getMonth()]}, ${date.getFullYear()}`;
};

const AGENT = {
  name: "Amit Aswal",
  nameUpper: "AMIT ASWAL",
  regNo: "IN/PA-2XXX",
  firm: "ANOVIP CONSULTANTS LLP",
  phone: "+91-11-XXXXXXXX",
  fax: "+91-11-XXXXXXXX",
  mobile: "+91-XXXXXXXXXX",
  email: "info@anovip.com",
  address1: "161-B/4, 6th Floor, Gulmohar House,",
  address2: "Yusuf Sarai Community Center,",
  address3: "Gautam Nagar, Green Park,",
};

const PATENT_OFFICES = {
  "New Delhi": "NEW DELHI",
  Mumbai: "MUMBAI",
  Kolkata: "KOLKATA",
  Chennai: "CHENNAI",
};

const transformData = (dbData) => {
  if (!dbData) return null;

  return {
    docketNo: dbData.DOC_NO?.trim() || "",
    patentOffice: PATENT_OFFICES[dbData.jurisdiction] || "NEW DELHI",
    filingDate: dbData.deposit_date || "",
    inventionTitle: dbData.title || "",
    publicationDate: dbData.publication_date || "",
    applicants: (dbData.applicants || []).map((a) => ({
      name: a.name || "",
      nationality: a.nationality || "",
      address: a.address || "",
    })),
  };
};

const styles = {
  page: {
    fontFamily: "Times New Roman, serif",
    fontSize: "11px",
    lineHeight: "1.5",
    padding: "25px 35px",
    background: "white",
    maxWidth: "210mm",
    margin: "0 auto",
  },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: "0" },
  cell: {
    border: "1px solid #000",
    padding: "10px 12px",
    verticalAlign: "top",
    fontSize: "11px",
  },
  headerCell: {
    border: "1px solid #000",
    padding: "12px",
    verticalAlign: "top",
    fontSize: "11px",
  },
  strike: { textDecoration: "line-through", color: "#888" },
  label: { display: "inline-block", width: "100px", fontWeight: "normal" },
  fieldRow: { margin: "8px 0" },
};

export default function Form18Generator({ formData, onClose }) {
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
              <h5>Form 18</h5>
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
      margin: [8, 8, 8, 8],
      filename: `Form18_${d.docketNo || "Patent"}.pdf`,
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
      <head><meta charset='utf-8'><style>body{font-family:'Times New Roman',serif;font-size:11pt}table{width:100%;border-collapse:collapse}td,th{padding:10px;font-size:11pt}.strike{text-decoration:line-through;color:#888}</style></head>
      <body>${content}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Form18_${d.docketNo || "Patent"}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applicantNames =
    d.applicants
      .map((a) => a.name)
      .filter((n) => n)
      .join("; ") || "_______________";
  const firstApplicant = d.applicants[0] || {};

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title">Form 18 Preview - {d.docketNo}</h5>
            <div className="d-flex gap-2 download-header">
              <button className="btn btn-danger btn-sm" onClick={downloadPDF}>
                Download PDF
              </button>
              <button className="btn btn-primary btn-sm" onClick={downloadDOCX}>
                Download DOCX
              </button>
              <button className="btn-close" onClick={onClose}></button>
            </div>
          </div>
          <div className="modal-body bg-secondary bg-opacity-10">
            <div ref={contentRef} style={styles.page}>
              {/* HEADER ROW - Two columns */}
              <table style={styles.table}>
                <tbody>
                  <tr>
                    {/* LEFT - FORM TITLE */}
                    <td
                      style={{
                        ...styles.headerCell,
                        width: "65%",
                        textAlign: "center",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 10px 0",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        FORM 18
                      </p>
                      <p style={{ margin: "5px 0" }}>THE PATENTS ACT, 1970</p>
                      <p style={{ margin: "5px 0" }}>(39 of 1970)</p>
                      <p style={{ margin: "5px 0" }}>and</p>
                      <p style={{ margin: "5px 0" }}>THE PATENTS RULES, 2003</p>
                      <p
                        style={{
                          margin: "15px 0 5px 0",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        REQUEST/EXPRESS REQUEST FOR EXAMINATION OF APPLICATION
                        FOR PATENT
                      </p>
                      <p
                        style={{
                          margin: "5px 0",
                          fontStyle: "italic",
                          fontSize: "10px",
                        }}
                      >
                        [See section 11B and rules 20 (4) (ii), 24B (1) (i)]
                      </p>
                    </td>
                    {/* RIGHT - FOR OFFICE USE ONLY */}
                    <td
                      style={{
                        ...styles.headerCell,
                        width: "35%",
                        textAlign: "left",
                        verticalAlign: "top",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 12px 0",
                          fontWeight: "bold",
                          textAlign: "center",
                        }}
                      >
                        (FOR OFFICE USE ONLY)
                      </p>
                      <div style={styles.fieldRow}>RQ. No: </div>
                      <div style={styles.fieldRow}>Filing Date: </div>
                      <div style={styles.fieldRow}>Amount of Fee Paid: </div>
                      <div style={styles.fieldRow}>CBR No: </div>
                      <div style={styles.fieldRow}>Signature: </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* SECTION 1 - APPLICANT(S) */}
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        ...styles.cell,
                        fontWeight: "bold",
                        backgroundColor: "#f9f9f9",
                      }}
                      colSpan="2"
                    >
                      1. <strong>APPLICANT(S)</strong>/
                      <span style={styles.strike}>
                        OTHER INTERESTED PERSON(S)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.cell, width: "100%" }} colSpan="2">
                      {d.applicants.map((applicant, idx) => (
                        <div
                          key={idx}
                          style={{
                            marginBottom:
                              idx < d.applicants.length - 1 ? "15px" : "0",
                          }}
                        >
                          <div style={styles.fieldRow}>
                            (a) Name: <strong>{applicant.name}</strong>
                          </div>
                          <div style={styles.fieldRow}>
                            (b) Address: {applicant.address}
                          </div>
                          <div style={styles.fieldRow}>
                            (c) Nationality: {applicant.nationality}
                          </div>
                        </div>
                      ))}
                      <div style={{ ...styles.fieldRow, marginTop: "15px" }}>
                        (d) Date Of Publication Under Section 11A:{" "}
                        {d.publicationDate || "_______________"}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* SECTION 2 - STATEMENT FOR APPLICANT */}
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        ...styles.cell,
                        fontWeight: "bold",
                        backgroundColor: "#f9f9f9",
                      }}
                      colSpan="2"
                    >
                      2. STATEMENT IN CASE OF REQUEST FOR EXAMINATION MADE BY
                      THE APPLICANT(S)
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...styles.cell,
                        width: "100%",
                        textAlign: "justify",
                        lineHeight: "1.8",
                      }}
                    >
                      <p style={{ margin: "0 0 15px 0" }}>
                        We, <strong>{applicantNames}</strong>; hereby request
                        that my/our application for Patent No.{" "}
                        <span style={{ textDecoration: "underline" }}>
                          <strong>____________________</strong>
                        </span>{" "}
                        filed on <strong>{formatDateLong(d.filingDate)}</strong>{" "}
                        for the invention titled "
                        <strong>
                          <span style={{ textDecoration: "underline" }}>
                            {d.inventionTitle}
                          </span>
                        </strong>
                        " shall be examined under sections 12 and 13 of the Act.
                      </p>
                      <p
                        style={{
                          margin: "15px 0",
                          textAlign: "center",
                          ...styles.strike,
                        }}
                      >
                        Or
                      </p>
                      <p style={{ margin: "0", ...styles.strike }}>
                        We, _________________________ hereby make an express
                        request that our application for Patent No.
                        __________________ filed on ___________ based on Patent
                        Cooperation Treaty (PCT) application no. _______________
                        dated ___________ made in country ___________ shall be
                        examined under sections 12 and 13 of the Act,
                        immediately without waiting for the expiry of 31 months
                        as specified in rule 20(4)(ii).
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* SECTION 3 - STATEMENT FOR OTHER INTERESTED PERSON */}
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        ...styles.cell,
                        fontWeight: "bold",
                        backgroundColor: "#f9f9f9",
                      }}
                      colSpan="2"
                    >
                      3. STATEMENT IN CASE OF REQUEST FOR EXAMINATION MADE BY
                      ANY OTHER INTERESTED PERSON
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        ...styles.cell,
                        width: "100%",
                        ...styles.strike,
                        lineHeight: "1.8",
                      }}
                    >
                      <p style={{ margin: "0 0 10px 0" }}>
                        We the interested person request for the examination of
                        the application no. ..................... dated
                        ................. filed by the applicant
                        ................. titled
                        ...................................... under section 12
                        and 13 of the Act.
                      </p>
                      <p style={{ margin: "10px 0" }}>
                        As an evidence of our interest in the application for
                        patent following documents are submitted.
                      </p>
                      <p style={{ margin: "5px 0" }}>
                        (a)
                        .....................................................................
                      </p>
                      <p style={{ margin: "5px 0", paddingLeft: "20px" }}>
                        .....................................................................
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* SECTION 4 - ADDRESS FOR SERVICE */}
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        ...styles.cell,
                        fontWeight: "bold",
                        backgroundColor: "#f9f9f9",
                      }}
                      colSpan="2"
                    >
                      4. ADDRESS FOR SERVICE
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...styles.cell, width: "65%" }}>
                      <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>
                        {AGENT.firm}
                      </p>
                      <p style={{ margin: "3px 0" }}>{AGENT.address1}</p>
                      <p style={{ margin: "3px 0" }}>{AGENT.address2}</p>
                      <p style={{ margin: "3px 0" }}>{AGENT.address3}</p>
                      <p style={{ margin: "3px 0" }}>
                        {d.patentOffice} – 110049, India
                      </p>
                    </td>
                    <td style={{ ...styles.cell, width: "35%" }}>
                      <div style={styles.fieldRow}>
                        Telephone No. {AGENT.phone}
                      </div>
                      <div style={styles.fieldRow}>Fax No. {AGENT.fax}</div>
                      <div style={styles.fieldRow}>
                        Mobile No. {AGENT.mobile}
                      </div>
                      <div style={styles.fieldRow}>
                        E-mail:{" "}
                        <a href={`mailto:${AGENT.email}`}>{AGENT.email}</a>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* SIGNATURE & FOOTER */}
              <table style={styles.table}>
                <tbody>
                  <tr>
                    <td style={{ ...styles.cell, width: "100%" }} colSpan={2}>
                      <p style={{ margin: "15px 0" }}>
                        <strong>
                          Dated this {formatDateLong(d.filingDate)}
                        </strong>
                      </p>
                      <table
                        style={{
                          width: "80%",
                          borderCollapse: "collapse",
                          marginTop: "15px",
                        }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ padding: "5px 0", width: "40%" }}>
                              Signature:
                            </td>
                            <td
                              style={{
                                padding: "5px 0",
                                borderBottom: "1px solid #000",
                              }}
                            ></td>
                          </tr>
                          <tr>
                            <td style={{ padding: "5px 0" }}>
                              Name of the signatory:
                            </td>
                            <td style={{ padding: "5px 0" }}>
                              <strong>{AGENT.nameUpper}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "5px 0" }}></td>
                            <td style={{ padding: "5px 0" }}>
                              (IN/PA No. {AGENT.regNo})
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "5px 0" }}></td>
                            <td style={{ padding: "5px 0" }}>
                              of {AGENT.firm}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: "5px 0" }}></td>
                            <td
                              style={{ padding: "5px 0", fontWeight: "bold" }}
                            >
                              AGENT FOR THE APPLICANT(S)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ marginTop: "25px" }}>
                        <p style={{ margin: "5px 0" }}>To,</p>
                        <p style={{ margin: "5px 0" }}>
                          The Controller of Patents,
                        </p>
                        <p style={{ margin: "5px 0" }}>The Patent Office,</p>
                        <p style={{ margin: "5px 0" }}>
                          At <strong>{d.patentOffice}</strong>
                        </p>
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
