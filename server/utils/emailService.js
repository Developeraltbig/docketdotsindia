// utils/emailService.js
import nodemailer from "nodemailer";
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";

// Create transporter - configure with your email provider
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // false for STARTTLS (port 587)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false, // helps with self-signed certs
  },
});

// Verify connection
if (process.env.EMAIL_ENABLED === "true") {
  transporter.verify((error, success) => {
    if (error) console.error("Email service error:", error);
    // else console.log("✅ Email service ready");
  });
}

/**
 * Send deadline reminder email
 */
export const sendDeadlineReminder = async (deadline, reminderNumber) => {
  if (!EMAIL_ENABLED) {
    console.log(
      `📧 [DEV MODE] Email skipped for ${deadline.application_no} (R${reminderNumber})`,
    );
    return { success: true, skipped: true };
  }
  try {
    const docketInfo = deadline.docket_id
      ? `${deadline.docket_id.docket_no || "N/A"}`
      : "N/A";

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || "anovIP"}" <${
        process.env.EMAIL_FROM
      }>`,
      to: deadline.emails.join(", "),
      subject: `⏰ Reminder: ${deadline.worktype} - ${deadline.application_no}`,
      html: generateEmailTemplate(deadline, reminderNumber, docketInfo),
      text: generatePlainTextEmail(deadline, reminderNumber, docketInfo),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Email sent for ${deadline.application_no} (R${reminderNumber}):`,
      info.messageId,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed for ${deadline.application_no}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * HTML Email Template
 */
const generateEmailTemplate = (deadline, reminderNumber, docketInfo) => {
  const deadlineDate = new Date(deadline.deadline_date).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );

  const remainderDate = new Date(
    deadline[`remainder${reminderNumber}`],
  ).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const daysLeft = Math.ceil(
    (new Date(deadline.deadline_date) - new Date()) / (1000 * 60 * 60 * 24),
  );

  const urgencyColor =
    daysLeft <= 3 ? "#dc3545" : daysLeft <= 7 ? "#ffc107" : "#28a745";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .deadline-box { background: white; padding: 20px; border-radius: 8px; 
                        border-left: 4px solid ${urgencyColor}; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; 
                    border-bottom: 1px solid #e9ecef; }
        .label { font-weight: bold; color: #495057; }
        .value { color: #212529; }
        .alert { background: ${urgencyColor}; color: white; padding: 15px; 
                 border-radius: 8px; text-align: center; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
       
        
        <div class="content">
          <div class="alert">
            ⚠️ ${daysLeft} Day${
              daysLeft !== 1 ? "s" : ""
            } Remaining Until Deadline
          </div>

          <div class="deadline-box">
            <h2 style="margin-top: 0; color: #667eea;">Deadline Details</h2>
            
            <div class="info-row">
              <span class="label">Docket Number:</span>
              <span class="value">${docketInfo}</span>
            </div>
            
            <div class="info-row">
              <span class="label">Application No:</span>
              <span class="value">${deadline.application_no}</span>
            </div>
            
            <div class="info-row">
              <span class="label">Action Type:</span>
              <span class="value">${deadline.worktype}</span>
            </div>
            
            <div class="info-row">
              <span class="label">Reminder Date:</span>
              <span class="value">${remainderDate}</span>
            </div>
            
            <div class="info-row" style="border-bottom: none;">
              <span class="label">⏰ Final Deadline:</span>
              <span class="value" style="color: ${urgencyColor}; font-weight: bold; font-size: 18px;">
                ${deadlineDate}
              </span>
            </div>

            ${
              deadline.remarks
                ? `
              <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e9ecef;">
                <span class="label">Remarks:</span>
                <p style="margin: 10px 0 0 0; color: #495057;">${deadline.remarks}</p>
              </div>
            `
                : ""
            }
          </div>

          <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #004085;">
              <strong>📌 Note:</strong> This is reminder related to your application. 
              Please ensure all necessary actions are completed before the deadline.
            </p>
          </div>
        </div>

        <div class="footer">
          <p>This is an automated message from the Deadline Management System.</p>
          <p>Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Plain text version (fallback)
 */
const generatePlainTextEmail = (deadline, reminderNumber, docketInfo) => {
  const deadlineDate = new Date(deadline.deadline_date).toLocaleDateString(
    "en-GB",
  );
  const daysLeft = Math.ceil(
    (new Date(deadline.deadline_date) - new Date()) / (1000 * 60 * 60 * 24),
  );

  return `
DEADLINE REMINDER ${reminderNumber}/6

⚠️ ${daysLeft} Day(s) Remaining Until Deadline

Deadline Details:
------------------
Docket Number: ${docketInfo}
Application No: ${deadline.application_no}
Action Type: ${deadline.worktype}
Final Deadline: ${deadlineDate}

${deadline.remarks ? `Remarks: ${deadline.remarks}` : ""}

This is an automated reminder from the Deadline Management System.
Please do not reply to this email.
  `;
};

export default transporter;
