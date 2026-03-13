import cron from "node-cron";
import Deadline from "../models/Deadline.js";
import { logActivity } from "../utils/activityLogger.js";
import { sendDeadlineReminder } from "../utils/emailService.js";
import { emitDeadlineReminder } from "../socket.js";

export const checkAndSendReminders = async (io = null) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deadlines = await Deadline.find({
      status: { $in: ["ON", "PENDING"] },
      deadline_date: { $gte: today },
    }).populate("docket_id", "docket_no title");

    let sentCount = 0;
    let failedCount = 0;

    for (const deadline of deadlines) {
      if (!deadline.emails || deadline.emails.length === 0) continue;

      for (let i = 1; i <= 6; i++) {
        const remainderDate = deadline[`remainder${i}`];

        if (remainderDate) {
          const reminderDay = new Date(remainderDate);
          reminderDay.setHours(0, 0, 0, 0);

          if (reminderDay.getTime() === today.getTime()) {
            console.log(
              `📧 Sending reminder ${i} for ${deadline.application_no}...`,
            );

            const result = await sendDeadlineReminder(deadline, i);

            if (result.success) {
              sentCount++;

              // ✅ Correct place: inside loop, deadline & i are in scope
              await logActivity({
                type: "deadline_reminder_sent",
                description: `Deadline reminder R${i}/6 sent for ${
                  deadline.docket_number ||
                  deadline.docket_id?.docket_no ||
                  deadline.application_no
                }`,
                userId: null,
                userName: "System",
                entityId: deadline._id,
                entityType: "deadline",
                metadata: { reminderNumber: i, emails: deadline.emails },
              });
            } else {
              failedCount++;
            }

            if (io) emitDeadlineReminder(io, deadline);

            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }

    console.log(
      `✅ Reminder check done. Sent: ${sentCount}, Failed: ${failedCount}`,
    );
  } catch (error) {
    console.error("❌ Cron job error:", error);
  }
};

export const startReminderCron = (io = null) => {
  cron.schedule("0 9 * * *", () => checkAndSendReminders(io), {
    timezone: "Asia/Kolkata",
  });

  console.log("⏰ Deadline reminder cron scheduled (9:00 AM IST daily)");

  if (process.env.NODE_ENV === "development") {
    checkAndSendReminders(io);
  }
};
