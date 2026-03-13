import React, { useRef } from 'react';
import html2pdf from 'html2pdf.js';

const formatDateLong = (dateStr) => {
  if (!dateStr) return '.......... day of ........, .......';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '.......... day of ........, .......';
  const day = date.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || Math.floor(day / 10) === 1) ? 0 : day % 10];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${day}${suffix} day of ${months[date.getMonth()]}, ${date.getFullYear()}`;
};

const AGENT = {
  name: 'Amit Aswal',
  nameUpper: 'AMIT ASWAL',
  regNo: 'IN/PA-2XXX',
  firm: 'anovIP',
  agents: 'AMIT ASWAL (IN/PA-2XXX), DUSHYANT RASTOGI (IN/PA No. 1448), SWEETY SHARMA (IN/PA No. 3628), Faisal Ahmad (IN/PA No. 3631) ABHISHEK NANDY (IN/PA No. 3173) DIPANKAR ROY (IN/PA No. 3448), RISHABH SETH (IN/PA No. 4771), DEEPTI (IN/PA No. 4604), EKTA ASWAL, NIDHI CHAUDHARY, PRIYANKA MISHRA, RANITA DAS and SHIVANI TIWARI',
  address1: '45/1, Floor No. 3, Corner Market, Malviya Nagar,',
  address2: '161-B/4, 6th Floor, Gulmohar House, Yusuf Sarai Community Center, Gautam Nagar, Green Park,',
};

const PATENT_OFFICES = {
  'New Delhi': 'New Delhi',
  'Mumbai': 'Mumbai',
  'Kolkata': 'Kolkata',
  'Chennai': 'Chennai'
};

const transformData = (dbData) => {
  if (!dbData) return null;
  const firstApplicant = dbData.applicants?.[0] || {};
  
  return {
    docketNo: dbData.DOC_NO?.trim() || '',
    patentOffice: PATENT_OFFICES[dbData.jurisdiction] || 'New Delhi',
    filingDate: dbData.deposit_date || '',
    applicantName: firstApplicant.name || '_______________',
    applicantNationality: firstApplicant.nationality || 'INDIA',
    applicantAddress: firstApplicant.address || '_______________',
  };
};

const styles = {
  page: { fontFamily: 'Times New Roman, serif', fontSize: '12px', lineHeight: '1.8', padding: '40px 50px', background: 'white', maxWidth: '210mm', margin: '0 auto' },
};

export default function Form26SPAGenerator({ formData, onClose }) {
  const contentRef = useRef();
  const d = transformData(formData);
  
  if (!d) {
    return (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header"><h5>Form 26 (SPA)</h5><button className="btn-close" onClick={onClose}></button></div>
            <div className="modal-body text-center p-5"><p>No application data available.</p></div>
          </div>
        </div>
      </div>
    );
  }

  const downloadPDF = () => {
    const opt = {
      margin: [15, 15, 15, 15],
      filename: `Form26_SPA_${d.docketNo || 'Patent'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    html2pdf().set(opt).from(contentRef.current).save();
  };

  const downloadDOCX = () => {
    const content = contentRef.current.innerHTML;
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.8}table{width:100%;border-collapse:collapse}td,th{padding:8px;font-size:12pt}</style></head>
      <body>${content}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Form26_SPA_${d.docketNo || 'Patent'}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-light sticky-top">
            <h5 className="modal-title">Form 26 (SPA) Preview - {d.docketNo}</h5>
            <div className="d-flex gap-2 download-header">
              <button className="btn btn-danger btn-sm" onClick={downloadPDF}>Download PDF</button>
              <button className="btn btn-primary btn-sm" onClick={downloadDOCX}>Download DOCX</button>
              <button className="btn-close" onClick={onClose}></button>
            </div>
          </div>
          <div className="modal-body bg-secondary bg-opacity-10">
            <div ref={contentRef} style={styles.page}>
              
              {/* HEADER */}
              <div style={{textAlign: 'center', marginBottom: '30px'}}>
                <p style={{margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '16px'}}>FORM 26</p>
                <p style={{margin: '5px 0', fontWeight: 'bold', fontSize: '14px'}}>THE PATENTS ACT, 1970</p>
                <p style={{margin: '5px 0', fontSize: '13px'}}>(39 of 1970)</p>
                <p style={{margin: '10px 0', fontWeight: 'bold', fontSize: '16px'}}>&amp;</p>
                <p style={{margin: '5px 0', fontWeight: 'bold', fontSize: '14px'}}>THE PATENT RULES, 2003</p>
                <p style={{margin: '25px 0 10px 0', fontWeight: 'bold', fontSize: '13px'}}>
                  FORM FOR AUTHORISATION OF A PATENT AGENT/ OR ANY<br/>
                  PERSON IN A MATTER OR PROCEEDING UNDER THE ACT
                </p>
                <p style={{margin: '10px 0', fontStyle: 'italic', fontSize: '11px'}}>
                  [See sections 127 and 132; and rule 135]
                </p>
              </div>

              {/* MAIN AUTHORIZATION PARAGRAPH */}
              <p style={{margin: '25px 0', textAlign: 'justify', lineHeight: '2'}}>
                I, <strong>{d.applicantName},</strong> a Citizen of the <strong>{d.applicantNationality}</strong>, having address at <strong>{d.applicantAddress},</strong> hereby authorize and appoint <strong>{AGENT.agents}</strong>, agents and advocates of <strong>{AGENT.firm}</strong>, having addresses at {AGENT.address1} {d.patentOffice} - 110017, and {AGENT.address2} {d.patentOffice} – 110049, India, jointly and severally, to act on our behalf as our agents/advocates for securing from the Government of India in our name the grant of letters patent under the above-mentioned Act in respect of inventions and in all matters and proceedings before the Controller of Patents or any Court of Law or Tribunals or the Government of India in connection therewith or incidental thereto and in all matters and proceedings subsequent to the grant of any letters patent including the amendment thereof or of the application, appeals or petitions in respect thereof, specification or any other document filed in respect thereof, the renewal thereof, the restoration thereof, the registration and recordal of any licence, mortgage, assignment or transfer of other interest in respect thereof, the recordal of changes in our name, address or address for service and the filing of statements of working in respect thereof and in general to perform all acts and take such actions as the said agents/advocates may in their discretion deem necessary or expedient in the discharge of their duties including the appointment of a substitute or substitutes, and We request that all notices, requisitions and communications relating to the matters identified herein be sent to such agents/advocates at 161-B/4, 6th Floor, Gulmohar House, Yusuf Sarai Community Center, Gautam Nagar, Green Park, {d.patentOffice} – 110049, India.
              </p>

              {/* CONFIRMATION PARAGRAPH */}
              <p style={{margin: '20px 0', textAlign: 'justify', lineHeight: '2'}}>
                I hereby confirm and ratify previous acts, if any, done by the said agents/advocates in respect of the said matters or proceedings.
              </p>

              {/* REVOCATION PARAGRAPH */}
              <p style={{margin: '20px 0', textAlign: 'justify', lineHeight: '2'}}>
                I hereby revoke all previous authorizations, if any, made by me in respect of the said matters or proceedings.
              </p>

              {/* DATE LINE */}
              <p style={{margin: '30px 0 20px 0'}}>
                Dated this <strong>{formatDateLong(d.filingDate)}</strong>
              </p>

              {/* SIGNATURE SECTION */}
              <div style={{marginTop: '40px'}}>
                <p style={{margin: '0 0 10px 0'}}>
                  <strong>Signature:</strong> ...........................................................
                </p>
                <p style={{margin: '15px 0'}}>
                  <strong>Applicant's Name: {d.applicantName}</strong>
                </p>
              </div>

              {/* ADDRESSEE SECTION */}
              <div style={{marginTop: '60px'}}>
                <h1 style={{fontSize: '14px', fontWeight: 'bold', margin: '0 0 15px 0'}}>To,</h1>
                <p style={{margin: '5px 0'}}>The Controller of Patents,</p>
                <p style={{margin: '5px 0'}}>The Patent Office,</p>
                <p style={{margin: '5px 0'}}>At <strong>{d.patentOffice}</strong></p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}