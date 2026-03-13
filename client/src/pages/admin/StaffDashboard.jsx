import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Eye,
  ChevronRight,
  Download,
  Paperclip,
  Trash2,
  Check,
  Clock,
  Activity,
  DownloadIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
// --- UPPY IMPORTS ---
import Uppy from "@uppy/core";
import AwsS3Multipart from "@uppy/aws-s3-multipart";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

import useAuthStore from "../../store/authStore";

// --- ICONS ---
const MyWorkIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

const DeadlineIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

// --- COMPONENT HELPERS ---
const StatCard = ({ icon, title, count, link = "#" }) => (
  <div style={styles.statCard}>
    <div style={styles.statCardContent}>
      <div style={styles.iconWrapper}>{icon}</div>
      <div style={styles.statInfo}>
        <span style={styles.statTitle}>{title}</span>
        <span style={styles.statCount}>{count}</span>
      </div>
    </div>
  </div>
);

const QuickActionCard = ({
  title,
  subtitle,
  link = "#",
  color = "#f97316",
}) => (
  <Link to={link} style={{ ...styles.quickActionCard, borderTopColor: color }}>
    <div>
      <h4 style={{ ...styles.quickActionTitle, color }}>{title}</h4>
      <span style={styles.quickActionSubtitle}>{subtitle}</span>
    </div>
    <ChevronRight size={20} color={color} />
  </Link>
);

const FilterButton = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{ ...styles.filterBtn, ...(active ? styles.filterBtnActive : {}) }}
  >
    {label}
  </button>
);

// --- MAIN COMPONENT ---
export default function StaffDashboard() {
  const [stats, setStats] = useState({
    myWork: 0,
    deadlines: 0,
    application: 0,
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [activeFilter, setActiveFilter] = useState("All");
  const recordsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({});
  const [timelineTask, setTimelineTask] = useState(null);

  const [isUppyModalOpen, setIsUppyModalOpen] = useState(false);
  const [newlyUploadedFiles, setNewlyUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDocType, setPendingDocType] = useState("");

  const { user } = useAuthStore();

  // --- EXPORT STAFF ACTIVITY ---
  const handleExportActivity = async () => {
    try {
      const res = await axios.get(
        "/api/dashboard/staff/recent-activity/export",
      );
      const data = res.data.map((a, i) => ({
        "Sr no.": i + 1,
        Task: a.description,
        "Time/Date": new Date(a.createdAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "My Recent Activity");
      XLSX.writeFile(wb, "My_Recent_Activity.xlsx");
    } catch (err) {
      toast.error("Failed to export recent activity");
      console.error(err);
    }
  };

  // --- INITIALIZE UPPY ---
  const uppy = useMemo(() => {
    const uppyInstance = new Uppy({
      id: "staff-task-uploader",
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: 10,
        maxTotalFileSize: 5 * 1024 * 1024 * 1024,
      },
    });

    uppyInstance.use(AwsS3Multipart, {
      limit: 4,
      async createMultipartUpload(file) {
        const res = await axios.post("/api/tasks/s3/multipart/start", {
          filename: file.name,
          contentType: file.type,
        });
        file.meta.key = res.data.key;
        return { uploadId: res.data.uploadId, key: res.data.key };
      },
      async signPart(file, { uploadId, key, partNumber }) {
        const res = await axios.post("/api/tasks/s3/multipart/sign-part", {
          uploadId,
          key,
          partNumber,
        });
        return { url: res.data.url };
      },
      async completeMultipartUpload(file, { uploadId, key, parts }) {
        const res = await axios.post("/api/tasks/s3/multipart/complete", {
          uploadId,
          key,
          parts,
        });
        return { location: res.data.location };
      },
      async abortMultipartUpload(file, { uploadId, key }) {
        await axios.post("/api/tasks/s3/multipart/abort", { uploadId, key });
      },
      async getUploadParameters(file) {
        const res = await axios.post("/api/tasks/s3/presigned-url", {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        });
        file.meta.key = res.data.key;
        return {
          method: "PUT",
          url: res.data.uploadUrl,
          headers: { "Content-Type": file.type },
        };
      },
    });
    return uppyInstance;
  }, []);

  // --- ADD THESE STATES ---
  const [recentActivity, setRecentActivity] = useState([]);
  const [actPage, setActPage] = useState(1);
  const [actTotal, setActTotal] = useState(0);
  const ACT_PER_PAGE = 5;

  // --- ADD THIS HELPER ---
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "--";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  // --- ADD THIS FETCH FUNCTION & EFFECT ---
  const fetchActivity = async () => {
    try {
      const res = await axios.get(
        `/api/dashboard/staff/recent-activity?page=${actPage}&limit=${ACT_PER_PAGE}`,
      );
      setRecentActivity(res.data.records || []);
      setActTotal(res.data.total || 0);
    } catch (err) {
      console.error("Error fetching activity", err);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [actPage]);

  useEffect(() => {
    const handleUploadStart = () => setIsUploading(true);
    const handleComplete = (result) => {
      setIsUploading(false);
      if (result.successful.length > 0) {
        const files = result.successful.map((f) => ({
          key: f.meta.key,
          filename: f.name,
          fileType: f.type,
          fileSize: f.size,
          documentType: pendingDocType,
        }));
        setNewlyUploadedFiles((prev) => [...prev, ...files]);
        toast.success("Files uploaded! Click 'Update Task' to save.");
        setIsUppyModalOpen(false);
        uppy.cancelAll();
      }
    };
    const handleCancel = () => setIsUploading(false);

    uppy.on("upload", handleUploadStart);
    uppy.on("complete", handleComplete);
    uppy.on("cancel-all", handleCancel);
    return () => {
      uppy.off("upload", handleUploadStart);
      uppy.off("complete", handleComplete);
      uppy.off("cancel-all", handleCancel);
    };
  }, [uppy, pendingDocType]);

  useEffect(() => {
    return () => uppy.close();
  }, [uppy]);

  // --- API CALLS ---
  const fetchStats = async () => {
    try {
      const res = await axios.get(`/api/tasks/staff/stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats", err);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", currentPage);
      params.append("limit", recordsPerPage);
      params.append("filter", activeFilter.toLowerCase());
      const res = await axios.get(
        `/api/tasks/staff/tasks?${params.toString()}`,
      );
      setTasks(res.data.tasks || []);
      setTotalRecords(res.data.total || 0);
    } catch (err) {
      console.error("Error fetching tasks", err);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);
  useEffect(() => {
    fetchTasks();
  }, [currentPage, activeFilter]);

  // --- HANDLERS ---
  const handleDownloadFile = async (fileKey, filename) => {
    try {
      const res = await axios.get(
        `/api/tasks/download-url?fileKey=${encodeURIComponent(fileKey)}`,
      );
      const link = document.createElement("a");
      link.href = res.data.downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("File not found or download failed");
    }
  };

  const removeNewFile = (index) => {
    const updated = [...newlyUploadedFiles];
    updated.splice(index, 1);
    setNewlyUploadedFiles(updated);
  };

  const handleViewTask = async (task) => {
    try {
      const res = await axios.get(`/api/tasks/${task._id}`);
      const fresh = res.data;
      setFormData({
        _id: fresh._id,
        docket_no: fresh.docket_no || "",
        client_name: fresh.client_name || "",
        work_type: fresh.work_type || "",
        territory_manager: fresh.territory_manager?.name || "",
        prepared_by: fresh.prepared_by?.name || fresh.prepared_by || "",
        review_by: fresh.review_by?.name || fresh.review_by || "",
        final_review_by:
          fresh.final_review_by?.name || fresh.final_review_by || "",
        prepared_by_id: fresh.prepared_by?._id || fresh.prepared_by,
        review_by_id: fresh.review_by?._id || fresh.review_by,
        final_review_by_id: fresh.final_review_by?._id || fresh.final_review_by,
        country: fresh.country || "",
        remarks: fresh.remarks || "",
        task_status: fresh.task_status || "Pending",
        sub_status: fresh.sub_status || "",
        client_ref_no: fresh.client_ref_no || "",
        pct_application_no: fresh.pct_application_no || "",
        instruction_date: fresh.instruction_date
          ? fresh.instruction_date.split("T")[0]
          : "",
        internal_deadline: fresh.internal_deadline
          ? fresh.internal_deadline.split("T")[0]
          : "",
        official_deadline: fresh.official_deadline
          ? fresh.official_deadline.split("T")[0]
          : "",
        files: fresh.files || [],
      });
      setNewlyUploadedFiles([]);
      setPendingDocType("");
      setShowModal(true);
    } catch {
      toast.error("Failed to load task details");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // ✅ Ignore placeholder option
    if (name === "sub_status" && value === "__current__") return;

    if (name === "sub_status") {
      if (user?._id === formData.review_by_id && value === "")
        toast.info("Rejecting task: Please provide a reason in Remarks.");
      if (user?._id === formData.final_review_by_id && value === "Prepared")
        toast.info("Rejecting task: Please provide a reason in Remarks.");
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      user?._id === formData.review_by_id &&
      formData.sub_status === "" &&
      (!formData.remarks || formData.remarks.trim() === "")
    ) {
      toast.error("Please add a Remark explaining the rejection.");
      return;
    }
    if (
      user?._id === formData.final_review_by_id &&
      formData.sub_status === "Prepared" &&
      (!formData.remarks || formData.remarks.trim() === "")
    ) {
      toast.error("Please add a Remark explaining the rejection.");
      return;
    }
    try {
      const payload = {
        task_status: formData.task_status,
        sub_status: formData.sub_status,
        remarks: formData.remarks,
        newFiles: newlyUploadedFiles,
      };
      await axios.put(`/api/tasks/${formData._id}`, payload);
      toast.success("Task updated successfully");
      setShowModal(false);
      setNewlyUploadedFiles([]);
      setPendingDocType("");
      fetchTasks();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Update failed");
    }
  };

  // --- TIMELINE HELPER ---
  const getTimelineStatus = (currentSubStatus, stepValue) => {
    const statusMap = { "": 0, Prepared: 1, Reviewed: 2, "Final Reviewed": 3 };
    const currentVal = statusMap[currentSubStatus || ""] || 0;
    const stepVal = statusMap[stepValue];
    return currentVal >= stepVal ? "completed" : "pending";
  };

  // --- PAGINATION ---
  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);
    if (endPage - startPage < 2 && totalPages >= 3)
      startPage = Math.max(1, endPage - 2);
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const isAssignee =
    user?._id === formData.prepared_by_id ||
    user?._id === formData.review_by_id ||
    user?._id === formData.final_review_by_id;

  return (
    <div style={styles.container}>
      {/* --- DASHBOARD STATS --- */}
      <div style={styles.topRow}>
        <div style={styles.statsGrid}>
          <StatCard
            icon={<MyWorkIcon />}
            title="My Work"
            count={stats.myWork}
            link="/my-work"
          />
          <StatCard
            icon={<DeadlineIcon />}
            title="Upcoming Deadlines (7 Days)"
            count={stats.deadlines}
            link="/deadline"
          />
          <StatCard
            icon={<DeadlineIcon />}
            title="Application"
            count={stats.application}
            link="/application"
          />
        </div>
        <div style={styles.quickActionsGrid}>
          <QuickActionCard
            title="Prior Art Search"
            subtitle="Search Now"
            link="/prior-art-search"
            color="#f97316"
          />
          <QuickActionCard
            title="Drafting"
            subtitle="Draft Now"
            link="/drafting"
            color="#f97316"
          />
          <QuickActionCard
            title="Form Generation"
            subtitle="Generate Form"
            link="/application"
            color="#f97316"
          />
        </div>
      </div>

      {/* --- TASKS TABLE --- */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div style={styles.tableHeaderLeft}>
            <h3 style={styles.tableTitle}>My Tasks</h3>
            <div style={styles.filterGroup}>
              {["All", "Prepare", "Review", "Final Review"].map((filter) => (
                <FilterButton
                  key={filter}
                  label={filter}
                  active={activeFilter === filter}
                  onClick={() => {
                    setActiveFilter(filter);
                    setCurrentPage(1);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Sr no.</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>TM</th>
                <th style={styles.th}>Ref No.</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Worktype</th>
                <th style={styles.th}>Deadline</th>
                <th style={styles.th}>Prepared</th>
                <th style={styles.th}>Review</th>
                <th style={styles.th}>Final Review</th>
                <th style={styles.th}>Remarks</th>
                {/* ✅ CHANGED: "Status" → "Current Stage" */}
                <th style={styles.th}>Current Stage</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" style={styles.tdCenter}>
                    Loading...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="13" style={styles.tdCenter}>
                    No data found
                  </td>
                </tr>
              ) : (
                tasks.map((task, index) => (
                  <tr key={task._id || index} style={styles.tr}>
                    <td style={styles.td}>
                      {(currentPage - 1) * recordsPerPage + index + 1}
                    </td>
                    <td style={styles.td}>
                      {formatDate(task.date || task.createdAt)}
                    </td>
                    <td style={styles.td}>
                      {task.tm || task.territory_manager?.name || "--"}
                    </td>
                    <td style={styles.td}>
                      {task.docket_no || task.anovip_reference || "--"}
                    </td>
                    <td style={styles.td}>
                      {task.client_name || task.client || "--"}
                    </td>
                    <td style={styles.td}>
                      {task.work_type || task.worktype || "--"}
                    </td>
                    <td style={styles.td}>
                      {formatDate(task.internal_deadline || task.deadline)}
                    </td>
                    <td style={styles.td}>
                      {task.prepared_by_name || task.prepared || "--"}
                    </td>
                    <td style={styles.td}>
                      {task.review_by_name || task.review || "--"}
                    </td>
                    <td style={styles.td}>
                      {task.final_review_by_name || task.final_review || "--"}
                    </td>
                    <td style={styles.td}>{task.remarks || "--"}</td>

                    {/* ✅ REPLACED: Static status pill → Clickable stage that opens timeline modal */}
                    <td style={styles.td}>
                      <div
                        onClick={() => setTimelineTask(task)}
                        style={styles.clickableStage}
                        title="Click to view timeline"
                      >
                        <span
                          style={{
                            ...styles.statusPill,
                            backgroundColor: task.sub_status
                              ? "#fff7ed"
                              : "#f3f4f6",
                            color: task.sub_status ? "#f97316" : "#6b7280",
                            border: task.sub_status
                              ? "1px solid #fed7aa"
                              : "1px solid transparent",
                          }}
                        >
                          {task.sub_status || "Pending"}
                        </span>
                        <Activity
                          size={14}
                          color="#f97316"
                          style={{ marginLeft: "5px" }}
                        />
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={styles.viewLink}
                        onClick={() => handleViewTask(task)}
                      >
                        View <Eye size={14} color="#22c55e" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div style={styles.pagination}>
          <span style={styles.paginationInfo}>
            Showing{" "}
            <strong>
              {totalRecords > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0}
            </strong>{" "}
            -{" "}
            <strong>
              {Math.min(currentPage * recordsPerPage, totalRecords)}
            </strong>{" "}
            of <strong>{totalRecords}</strong>
          </span>
          <div style={styles.paginationBtns}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!canGoPrev}
              style={{
                ...styles.pageBtn,
                opacity: !canGoPrev ? 0.5 : 1,
                cursor: !canGoPrev ? "not-allowed" : "pointer",
              }}
            >
              ←
            </button>
            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                style={{
                  ...styles.pageBtn,
                  ...(currentPage === p ? styles.pageBtnActive : {}),
                }}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={!canGoNext}
              style={{
                ...styles.pageBtn,
                opacity: !canGoNext ? 0.5 : 1,
                cursor: !canGoNext ? "not-allowed" : "pointer",
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* --- TIMELINE MODAL --- */}
      {timelineTask && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: "600px" }}>
            <div style={styles.modalHeader}>
              <h5 style={styles.modalTitle}>Stage Timeline</h5>
              <button
                style={styles.closeBtn}
                onClick={() => setTimelineTask(null)}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "30px" }}>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: "20px",
                  color: "#6b7280",
                  fontSize: "13px",
                }}
              >
                Docket:{" "}
                <strong>
                  {timelineTask.docket_no || timelineTask.anovip_reference}
                </strong>
              </div>

              <div style={styles.timelineContainer}>
                {/* Step 1: Preparation */}
                <div style={styles.timelineItem}>
                  <div
                    style={styles.timelineIcon(
                      getTimelineStatus(timelineTask.sub_status, "Prepared") ===
                        "completed",
                    )}
                  >
                    {getTimelineStatus(timelineTask.sub_status, "Prepared") ===
                    "completed" ? (
                      <Check size={16} color="#fff" />
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                        1
                      </span>
                    )}
                  </div>
                  <div style={styles.timelineContent}>
                    <span style={styles.timelineLabel}>Preparation</span>
                    <span style={styles.timelineUser}>
                      {timelineTask.prepared_by_name ||
                        timelineTask.prepared ||
                        "Unassigned"}
                    </span>
                  </div>
                  <div
                    style={styles.timelineLine(
                      getTimelineStatus(timelineTask.sub_status, "Prepared") ===
                        "completed",
                    )}
                  ></div>
                </div>

                {/* Step 2: Review */}
                <div style={styles.timelineItem}>
                  <div
                    style={styles.timelineIcon(
                      getTimelineStatus(timelineTask.sub_status, "Reviewed") ===
                        "completed",
                    )}
                  >
                    {getTimelineStatus(timelineTask.sub_status, "Reviewed") ===
                    "completed" ? (
                      <Check size={16} color="#fff" />
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                        2
                      </span>
                    )}
                  </div>
                  <div style={styles.timelineContent}>
                    <span style={styles.timelineLabel}>Review</span>
                    <span style={styles.timelineUser}>
                      {timelineTask.review_by_name ||
                        timelineTask.review ||
                        "Unassigned"}
                    </span>
                  </div>
                  <div
                    style={styles.timelineLine(
                      getTimelineStatus(timelineTask.sub_status, "Reviewed") ===
                        "completed",
                    )}
                  ></div>
                </div>

                {/* Step 3: Final Review */}
                <div style={{ ...styles.timelineItem, flex: 0 }}>
                  <div
                    style={styles.timelineIcon(
                      getTimelineStatus(
                        timelineTask.sub_status,
                        "Final Reviewed",
                      ) === "completed",
                    )}
                  >
                    {getTimelineStatus(
                      timelineTask.sub_status,
                      "Final Reviewed",
                    ) === "completed" ? (
                      <Check size={16} color="#fff" />
                    ) : (
                      <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                        3
                      </span>
                    )}
                  </div>
                  <div style={styles.timelineContent}>
                    <span style={styles.timelineLabel}>Final Review</span>
                    <span style={styles.timelineUser}>
                      {timelineTask.final_review_by_name ||
                        timelineTask.final_review ||
                        "Unassigned"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT TASK MODAL --- */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h5 style={styles.modalTitle}>
                View Task:{" "}
                <span style={{ color: "#f97316" }}>{formData.docket_no}</span>
              </h5>
              <button
                style={styles.closeBtn}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form style={styles.modalBody} onSubmit={handleSubmit}>
              <div style={styles.formColumns}>
                {/* COLUMN 1 */}
                <div style={styles.formColumn}>
                  <h6 style={styles.sectionTitle}>Basic Info</h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Docket No</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.docket_no}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Work Type</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.work_type}
                        disabled
                      />
                    </div>

                    {/* ADMIN STATUS (READ ONLY) */}
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        Main Status (Admin)
                      </label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.task_status}
                        disabled
                      />
                    </div>

                    {/* ✅ STAFF STAGE SELECT WITH ROLE-BASED LOGIC */}
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        Update Stage <span style={{ color: "red" }}>*</span>
                      </label>
                      <select
                        name="sub_status"
                        style={{
                          ...styles.formSelect,
                          borderColor: "#f97316",
                          borderWidth: "2px",
                          backgroundColor: "#fff7ed",
                        }}
                        value={formData.sub_status}
                        onChange={handleInputChange}
                        disabled={!isAssignee && user?.role !== "admin"}
                      >
                        <option value="__current__" disabled>
                          Current: {formData.sub_status || "Pending"}
                        </option>
                        <option disabled>──────────</option>

                        {/* PREPARER: can mark Prepared only if not yet prepared */}
                        {(user?._id === formData.prepared_by_id ||
                          user?.role === "admin") && (
                          <option
                            value="Prepared"
                            disabled={
                              formData.sub_status === "Prepared" ||
                              formData.sub_status === "Reviewed" ||
                              formData.sub_status === "Final Reviewed"
                            }
                          >
                            Mark as Prepared
                          </option>
                        )}

                        {/* REVIEWER: can only act if sub_status === "Prepared" */}
                        {(user?._id === formData.review_by_id ||
                          user?.role === "admin") &&
                          (formData.sub_status === "Prepared" ||
                          formData.sub_status === "Reviewed" ||
                          user?.role === "admin" ? (
                            <>
                              <option
                                value="Reviewed"
                                disabled={
                                  formData.sub_status === "Reviewed" ||
                                  formData.sub_status === "Final Reviewed"
                                }
                              >
                                Mark as Reviewed
                              </option>
                              <option
                                value=""
                                style={{ color: "red" }}
                                disabled={formData.sub_status !== "Prepared"}
                              >
                                ⚠ Reject (Return to Preparer)
                              </option>
                            </>
                          ) : (
                            <option disabled style={{ color: "#9ca3af" }}>
                              ⏳ Waiting for Preparation first
                            </option>
                          ))}

                        {/* FINAL REVIEWER: can only act if sub_status === "Reviewed" */}
                        {(user?._id === formData.final_review_by_id ||
                          user?.role === "admin") &&
                          (formData.sub_status === "Reviewed" ||
                          formData.sub_status === "Final Reviewed" ||
                          user?.role === "admin" ? (
                            <>
                              <option
                                value="Final Reviewed"
                                disabled={
                                  formData.sub_status === "Final Reviewed"
                                }
                              >
                                Mark as Final Reviewed
                              </option>
                              <option
                                value="Prepared"
                                style={{ color: "red" }}
                                disabled={formData.sub_status !== "Reviewed"}
                              >
                                ⚠ Reject (Return to Reviewer)
                              </option>
                            </>
                          ) : (
                            <option disabled style={{ color: "#9ca3af" }}>
                              ⏳ Waiting for Review first
                            </option>
                          ))}
                      </select>
                      {!isAssignee && user?.role !== "admin" && (
                        <small style={{ color: "red", fontSize: "10px" }}>
                          You are not assigned to this task.
                        </small>
                      )}
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Territory Manager</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.territory_manager}
                        disabled
                      />
                    </div>
                  </div>

                  <h6 style={{ ...styles.sectionTitle, marginTop: "20px" }}>
                    Examinations
                  </h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Prepared By</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.prepared_by}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Review By</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.review_by}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Final Review By</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.final_review_by}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Country</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.country}
                        disabled
                      />
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>
                        Remarks / Comments{" "}
                        {((user?._id === formData.review_by_id &&
                          formData.sub_status === "") ||
                          (user?._id === formData.final_review_by_id &&
                            formData.sub_status === "Prepared")) && (
                          <span style={{ color: "red" }}>
                            (Required for Rejection)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        name="remarks"
                        style={{
                          ...styles.formInput,
                          backgroundColor: isAssignee ? "#fff" : "#f9fafb",
                          cursor: isAssignee ? "text" : "not-allowed",
                          color: "#000",
                        }}
                        value={formData.remarks}
                        onChange={handleInputChange}
                        disabled={!isAssignee}
                        placeholder="Add comments here..."
                      />
                    </div>
                  </div>
                </div>

                {/* COLUMN 2 */}
                <div style={styles.formColumn}>
                  <h6 style={styles.sectionTitle}>Application Details</h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Client Ref. No.</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.client_ref_no}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>PCT / App No.</label>
                      <input
                        type="text"
                        style={styles.formInput}
                        value={formData.pct_application_no}
                        disabled
                      />
                    </div>
                  </div>

                  <h6 style={{ ...styles.sectionTitle, marginTop: "20px" }}>
                    Dates
                  </h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Internal Deadline</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={formData.internal_deadline}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Official Deadline</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={formData.official_deadline}
                        disabled
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Instruction Date</label>
                      <input
                        type="date"
                        style={styles.formInput}
                        value={formData.instruction_date}
                        disabled
                      />
                    </div>
                  </div>

                  {/* FILE UPLOAD SECTION */}
                  <div
                    style={{
                      marginTop: "25px",
                      borderTop: "1px solid #eee",
                      paddingTop: "15px",
                    }}
                  >
                    <label style={styles.formLabel}>Task Documents</label>

                    {formData.files && formData.files.length > 0 && (
                      <div style={{ marginBottom: "10px", marginTop: "8px" }}>
                        <small style={{ color: "#666" }}>Attached:</small>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                            marginTop: "5px",
                          }}
                        >
                          {formData.files.map((file, idx) => (
                            <div key={idx} style={styles.filePill}>
                              <span style={{ fontWeight: 500 }}>
                                {file.filename}
                              </span>
                              {file.documentType && (
                                <span style={styles.docTypeBadge}>
                                  {file.documentType}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadFile(file.key, file.filename)
                                }
                                style={styles.iconBtn}
                                title="Download"
                              >
                                <Download size={14} color="#2563eb" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {newlyUploadedFiles.length > 0 && (
                      <div style={{ marginBottom: "10px" }}>
                        <small style={{ color: "green" }}>
                          Ready to upload:
                        </small>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                            marginTop: "5px",
                          }}
                        >
                          {newlyUploadedFiles.map((file, idx) => (
                            <div key={idx} style={styles.filePill}>
                              <span style={{ fontWeight: 500 }}>
                                {file.filename}
                              </span>
                              {file.documentType && (
                                <span
                                  style={{
                                    ...styles.docTypeBadge,
                                    backgroundColor: "#dcfce7",
                                    color: "#16a34a",
                                    border: "1px solid #bbf7d0",
                                  }}
                                >
                                  {file.documentType}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeNewFile(idx)}
                                style={styles.iconBtn}
                                title="Remove"
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={styles.uploadRow}>
                      <div style={styles.docTypeGroup}>
                        <label style={styles.docTypeLabel}>
                          Document Type{" "}
                          <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={pendingDocType}
                          onChange={(e) => setPendingDocType(e.target.value)}
                          style={styles.docTypeSelect}
                        >
                          <option value="">-- Select Type --</option>
                          <option value="Input">Input</option>
                          <option value="Internal">Internal</option>
                          <option value="Output">Output</option>
                        </select>
                      </div>
                      <div style={styles.attachGroup}>
                        <label style={styles.docTypeLabel}>Documents</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!pendingDocType) {
                              toast.error(
                                "Please select a Document Type first!",
                              );
                              return;
                            }
                            setIsUppyModalOpen(true);
                          }}
                          style={styles.attachBtn}
                          disabled={isUploading}
                        >
                          <Paperclip size={14} />
                          {isUploading ? "Uploading..." : "Attach New Files"}
                        </button>
                      </div>
                    </div>
                    {!pendingDocType && (
                      <p style={styles.docTypeHint}>
                        Select a document type before attaching files.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading}
                    style={{
                      ...styles.submitBtn,
                      opacity: isUploading ? 0.6 : 1,
                      cursor: isUploading ? "not-allowed" : "pointer",
                    }}
                  >
                    {isUploading ? "Uploading Files..." : "Update Task"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPPY MODAL */}
      <DashboardModal
        uppy={uppy}
        open={isUppyModalOpen}
        onRequestClose={() => {
          uppy.cancelAll();
          setIsUppyModalOpen(false);
        }}
        closeModalOnClickOutside={false}
        theme="light"
        note="Files are uploaded immediately. Click 'Update Task' to save changes."
      />

      {/* --- MY RECENT ACTIVITY TABLE --- */}
      <div style={{ ...styles.tableCard, marginTop: "20px" }}>
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>My Recent Activity</h3>
          <button onClick={handleExportActivity} style={styles.exportBtn}>
            <DownloadIcon size={18} /> Export Excel
          </button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Sr no.</th>
                <th style={styles.th}>Task</th>
                <th style={styles.th}>Time/Date</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan="3" style={styles.tdCenter}>
                    No recent activity
                  </td>
                </tr>
              ) : (
                recentActivity.map((a, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>
                      {(actPage - 1) * ACT_PER_PAGE + i + 1}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>
                      {a.description}
                    </td>
                    <td style={{ ...styles.td, color: "#9ca3af" }}>
                      {formatTimeAgo(a.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ACTIVITY PAGINATION */}
        {actTotal > 0 && (
          <div style={styles.pagination}>
            <span style={styles.paginationInfo}>
              Showing <strong>{(actPage - 1) * ACT_PER_PAGE + 1}</strong> -{" "}
              <strong>{Math.min(actPage * ACT_PER_PAGE, actTotal)}</strong> of{" "}
              <strong>{actTotal}</strong>
            </span>
            <div style={styles.paginationBtns}>
              <button
                onClick={() => setActPage((p) => Math.max(1, p - 1))}
                disabled={actPage === 1}
                style={{
                  ...styles.pageBtn,
                  opacity: actPage === 1 ? 0.5 : 1,
                  cursor: actPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                ←
              </button>
              <button
                onClick={() =>
                  setActPage((p) =>
                    Math.min(Math.ceil(actTotal / ACT_PER_PAGE), p + 1),
                  )
                }
                disabled={actPage === Math.ceil(actTotal / ACT_PER_PAGE)}
                style={{
                  ...styles.pageBtn,
                  opacity:
                    actPage === Math.ceil(actTotal / ACT_PER_PAGE) ? 0.5 : 1,
                  cursor:
                    actPage === Math.ceil(actTotal / ACT_PER_PAGE)
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- STYLES ---
const styles = {
  container: { padding: "0" },
  topRow: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  statsGrid: { display: "flex", gap: "15px", flex: "0 0 auto" },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    minWidth: "280px",
  },
  statCardContent: { display: "flex", alignItems: "flex-start", gap: "15px" },
  iconWrapper: {
    width: "48px",
    height: "48px",
    backgroundColor: "#fff7ed",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flex: 1,
  },
  statTitle: { fontSize: "13px", color: "#6b7280", marginBottom: "5px" },
  statCount: { fontSize: "28px", fontWeight: "700", color: "#111827" },
  quickActionsGrid: {
    display: "flex",
    gap: "15px",
    flex: "1",
    minWidth: "300px",
  },
  quickActionCard: {
    flex: "1",
    backgroundColor: "#fffbf5",
    borderRadius: "12px",
    padding: "20px",
    borderTop: "3px solid #f97316",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textDecoration: "none",
    transition: "box-shadow 0.2s",
    cursor: "pointer",
  },
  quickActionTitle: {
    fontSize: "15px",
    fontWeight: "600",
    margin: "0 0 5px 0",
  },
  quickActionSubtitle: { fontSize: "12px", color: "#6b7280" },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  tableHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },
  tableTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#111827",
    margin: 0,
  },
  filterGroup: { display: "flex", gap: "8px" },
  filterBtn: {
    padding: "8px 16px",
    fontSize: "12px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#fddcab",
    borderRadius: "20px",
    backgroundColor: "#fff",
    cursor: "pointer",
    color: "#f97316",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  filterBtnActive: { backgroundColor: "#fff7ed", borderColor: "#f97316" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#f97316",
    fontWeight: "600",
    borderBottom: "1px solid #f3f4f6",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "14px 10px", color: "#374151", whiteSpace: "nowrap" },
  tdCenter: { padding: "40px", textAlign: "center", color: "#9ca3af" },
  statusPill: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "500",
  },
  clickableStage: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: "4px",
    transition: "background 0.2s",
  },
  viewLink: {
    color: "#111827",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "500",
    cursor: "pointer",
  },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "20px",
    paddingTop: "15px",
  },
  paginationInfo: { fontSize: "13px", color: "#6b7280" },
  paginationBtns: { display: "flex", gap: "5px" },
  pageBtn: {
    width: "32px",
    height: "32px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    backgroundColor: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    color: "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnActive: {
    backgroundColor: "#f97316",
    color: "#fff",
    borderColor: "#f97316",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1000,
    paddingTop: "20px",
    overflowY: "auto",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    width: "95%",
    maxWidth: "1000px",
    marginBottom: "50px",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 25px",
    borderBottom: "1px solid #f3f4f6",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
    margin: 0,
  },
  closeBtn: {
    width: "30px",
    height: "30px",
    border: "none",
    borderRadius: "50%",
    backgroundColor: "#f3f4f6",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { padding: "25px" },
  formColumns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" },
  formColumn: {},
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#111827",
    margin: "0 0 15px 0",
    paddingBottom: "10px",
    borderBottom: "2px solid #f97316",
  },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  formLabel: { fontSize: "12px", color: "#201d1bff", fontWeight: "500" },
  formInput: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    backgroundColor: "#f9fafb",
    color: "#6b7280",
    cursor: "not-allowed",
  },
  formSelect: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    backgroundColor: "#fff",
  },
  exportBtn: {
    padding: "6px 16px",
    fontSize: "12px",
    fontWeight: "600",
    border: "1px solid #22c55e",
    borderRadius: "6px",
    backgroundColor: "#f0fdf4",
    color: "#16a34a",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  filePill: {
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "6px 10px",
    backgroundColor: "#f9fafb",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
  },
  docTypeBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    backgroundColor: "#e5e7eb",
    borderRadius: "4px",
    color: "#4b5563",
    fontWeight: "500",
    border: "1px solid #d1d5db",
  },
  uploadRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "12px",
    alignItems: "end",
  },
  docTypeGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  docTypeLabel: { fontSize: "12px", color: "#374151", fontWeight: "500" },
  docTypeSelect: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    backgroundColor: "#fff",
    cursor: "pointer",
    height: "36px",
  },
  attachGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  attachBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    backgroundColor: "#f3f4f6",
    cursor: "pointer",
    fontSize: "13px",
    height: "36px",
    width: "fit-content",
  },
  docTypeHint: {
    fontSize: "11px",
    color: "#f97316",
    margin: "6px 0 0 0",
    fontStyle: "italic",
  },
  iconBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 0,
    display: "flex",
  },
  submitBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "25px",
  },
  timelineContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 0",
  },
  timelineItem: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    position: "relative",
  },
  timelineIcon: (isCompleted) => ({
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    backgroundColor: isCompleted ? "#22c55e" : "#e5e7eb",
    color: isCompleted ? "#fff" : "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    border: isCompleted ? "2px solid #22c55e" : "2px solid #d1d5db",
  }),
  timelineContent: {
    marginLeft: "12px",
    display: "flex",
    flexDirection: "column",
  },
  timelineLabel: { fontSize: "13px", fontWeight: "600", color: "#111827" },
  timelineUser: { fontSize: "12px", color: "#6b7280", marginTop: "2px" },
  timelineLine: (isCompleted) => ({
    flex: 1,
    height: "3px",
    backgroundColor: isCompleted ? "#22c55e" : "#e5e7eb",
    margin: "0 10px",
    borderRadius: "2px",
  }),
};
