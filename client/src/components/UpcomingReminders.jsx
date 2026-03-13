import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bell, Mail, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "react-toastify";

const UpcomingRemindersSection = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default
  const [sendingTestId, setSendingTestId] = useState(null);
  const [sendingRowIndex, setSendingRowIndex] = useState(null);
  useEffect(() => {
    fetchUpcomingReminders();
  }, []);

  const fetchUpcomingReminders = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/deadlines/upcoming-reminders");
      setReminders(res.data.reminders || []);
    } catch (err) {
      console.error("Error fetching reminders:", err);
      toast.error("Failed to load upcoming reminders");
    } finally {
      setLoading(false);
    }
  };

  const handleManualTrigger = async () => {
    if (
      !window.confirm("This will send all due reminders immediately. Continue?")
    ) {
      return;
    }

    setSending(true);
    try {
      await axios.post("/api/deadlines/send-all-reminders");
      toast.success("Reminder check completed! Check server logs for details.");
      fetchUpcomingReminders();
    } catch (err) {
      toast.error("Failed to trigger reminders");
    } finally {
      setSending(false);
    }
  };

  // CHANGE: Accept 'index' as the second parameter
  const handleTestEmail = async (deadlineId, index) => {
    setSendingRowIndex(index); // Set loading for this specific row index
    try {
      await axios.post(`/api/deadlines/test-email/${deadlineId}`);
      toast.success("Test email sent successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send test email");
      if (!import.meta.env.PROD) {
        console.error("Email send error:", err);
      }
    } finally {
      setSendingRowIndex(null); // Reset loading
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getUrgencyColor = (days) => {
    if (days === 0) return "danger";
    if (days <= 2) return "warning";
    return "info";
  };

  return (
    <div className="card shadow-sm mb-4">
      <div
        className="card-header bg-primary text-white d-flex justify-content-between align-items-center"
        style={{ cursor: "pointer" }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h5 className="mb-0 d-flex align-items-center">
          <Bell size={20} className="me-2" />
          Upcoming Reminders (Next 7 Days)
          {reminders.length > 0 && (
            <span className="badge bg-light text-primary ms-2">
              {reminders.length}
            </span>
          )}
        </h5>
        <div className="d-flex align-items-center">
          {isExpanded && (
            <button
              className="btn btn-sm btn-light me-2"
              onClick={(e) => {
                e.stopPropagation(); // Prevent header click
                handleManualTrigger();
              }}
              disabled={sending}
            >
              <Mail size={16} className="me-1" />
              {sending ? "Sending..." : "Send Due Reminders Now"}
            </button>
          )}
          <button
            className="btn btn-sm btn-outline-light d-flex align-items-center"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={16} className="me-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown size={16} className="me-1" />
                View All
              </>
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center">
              <div
                className="spinner-border spinner-border-sm me-2"
                role="status"
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              Loading reminders...
            </div>
          ) : reminders.length === 0 ? (
            <div className="p-4 text-center text-muted">
              <Calendar size={24} className="mb-2" />
              <p className="mb-0">No upcoming reminders in the next 7 days</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Reminder</th>
                    <th>Docket</th>
                    <th>Application No</th>
                    <th>Action</th>
                    <th>Reminder Date</th>
                    <th>Days Until</th>
                    <th>Emails</th>
                    <th>Test</th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((reminder, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className="badge bg-secondary">
                          R{reminder.reminder_number}/6
                        </span>
                      </td>
                      <td>{reminder.docket_number}</td>
                      <td>{reminder.application_no}</td>
                      <td>
                        <small>{reminder.worktype}</small>
                      </td>
                      <td>
                        <Calendar size={14} className="me-1" />
                        {formatDate(reminder.reminder_date)}
                      </td>
                      <td>
                        <span
                          className={`badge bg-${getUrgencyColor(
                            reminder.days_until_reminder
                          )}`}
                        >
                          {reminder.days_until_reminder === 0
                            ? "TODAY"
                            : `${reminder.days_until_reminder} day${
                                reminder.days_until_reminder !== 1 ? "s" : ""
                              }`}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">
                          {reminder.emails?.filter((e) => e && e.trim() !== "")
                            .length || 0}{" "}
                          recipient(s)
                        </small>
                      </td>
                      <td>
                        {/* Inside the map loop: {reminders.map((reminder, idx) => ( ... */}

                        <td>
                          <button
                            className="btn btn-sm btn-outline-primary"
                            // CHANGE: Pass 'idx' to the function
                            onClick={() =>
                              handleTestEmail(reminder.deadline_id, idx)
                            }
                            title="Send test email"
                            // CHANGE: Compare state with 'idx' instead of ID
                            disabled={sendingRowIndex === idx}
                          >
                            {/* CHANGE: Check if this specific index is loading */}
                            {sendingRowIndex === idx ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              ></span>
                            ) : (
                              <Mail size={14} />
                            )}
                          </button>
                        </td>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UpcomingRemindersSection;
