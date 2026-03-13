import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Eye,
  Trash,
  Trash2,
  Paperclip,
  Download,
  DownloadIcon,
  Plus,
  RotateCw,
  Activity,
  Check,
  Pencil,
  Copy,
} from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "react-toastify";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import StatsRow, {
  ApplicationIcon,
  DeadlineIcon,
  DocketIcon,
} from "../components/StatsRow";
import useAuthStore from "../store/authStore";
import * as XLSX from "xlsx";

import Uppy from "@uppy/core";
import AwsS3Multipart from "@uppy/aws-s3-multipart";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

export default function Task() {
  const [tasks, setTasks] = useState([]);
  const { updateStats } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 10;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [users, setUsers] = useState([]);
  const [docketSuggestions, setDocketSuggestions] = useState([]);
  const [showDocketSuggestions, setShowDocketSuggestions] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState([]);
  const [statsCounts, setStatsCounts] = useState({
    overdue: 0,
    dueToday: 0,
    inProgress: 0,
    completedToday: 0,
  });
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    docket_no: "",
    task_status: "",
    country: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  const initialFormState = {
    docket_id: "",
    docket_no: "",
    work_type: "",
    task_status: "",
    territory_manager: "",
    prepared_by: "",
    review_by: "",
    final_review_by: "",
    country: "",
    remarks: "",
    client_ref_no: "",
    pct_application_no: "",
    instruction_date: "",
    internal_deadline: "",
    official_deadline: "",
    filling_date: "",
    filling_country: "",
    reporting_date: "",
    client_name: "",
    title: "",
    application_type: "",
    files: [],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState(null);

  // --- UPPY STATE ---
  const [isUppyModalOpen, setIsUppyModalOpen] = useState(false);
  const [newlyUploadedFiles, setNewlyUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  // KEY CHANGE: pendingDocType state — same as DocketPage
  const [pendingDocType, setPendingDocType] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const [timelineTask, setTimelineTask] = useState(null);

  const [serviceFeesList, setServiceFeesList] = useState([]);

  const fetchServiceFees = async () => {
    const res = await axios.get("/api/service-fees/active");
    setServiceFeesList(res.data || []);
  };
  const getTimelineStatus = (currentSubStatus, stepValue) => {
    const statusMap = { "": 0, Prepared: 1, Reviewed: 2, "Final Reviewed": 3 };
    const currentVal = statusMap[currentSubStatus || ""] || 0;
    const stepVal = statusMap[stepValue];
    return currentVal >= stepVal ? "completed" : "pending";
  };
  const handleResetFilters = () => {
    const cleanPath = window.location.origin + location.pathname;
    window.location.href = cleanPath;
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    if (location.state?.viewRecord) {
      openEditModal(location.state.viewRecord);
    }
  }, [location.state]);

  const handleModalClose = () => {
    setShowModal(false);
    if (location.state?.returnToDocket) {
      navigate("/docket", {
        state: {
          viewDocket: location.state.returnToDocket,
          showDetail: true,
        },
      });
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filters, currentPage, sortConfig]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(tasks.map((t) => t._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((itemId) => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} tasks?`)) return;
    try {
      await Promise.all(
        selectedIds.map((id) => axios.delete(`/api/tasks/${id}`)),
      );
      toast.success("Tasks deleted");
      setSelectedIds([]);
      fetchTasks();
      updateStats("tasks", -selectedIds.length);
    } catch (err) {
      toast.error("Error deleting tasks");
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key]) params.append(key, filters[key]);
      });
      params.append("page", currentPage);
      params.append("limit", recordsPerPage);
      params.append("sortBy", sortConfig.key);
      params.append("sortOrder", sortConfig.direction);
      const res = await axios.get(`/api/tasks?${params.toString()}`);
      setTasks(res.data.tasks || []);
      setTotalRecords(res.data.total || 0);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Error fetching tasks", err);
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`/api/tasks/staff-users`);
      setUsers(res.data.users || []);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Error fetching users", err);
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    }
  };

  const searchDockets = async (query) => {
    if (!query || query.length < 1) {
      setDocketSuggestions([]);
      setShowDocketSuggestions(false);
      return;
    }
    try {
      const res = await axios.get(`/api/applications/lookup-docket/${query}`);
      const results = res.data.dockets || res.data || [];
      setDocketSuggestions(results);
      setShowDocketSuggestions(true);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Error searching dockets", err);
      setDocketSuggestions([]);
      setShowDocketSuggestions(false);
    }
  };

  // --- INITIALIZE UPPY ---
  const uppy = useMemo(() => {
    const uppyInstance = new Uppy({
      id: "task-uploader",
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: 100,
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

  // KEY CHANGE: Handle Uppy events — same pattern as DocketPage
  useEffect(() => {
    const handleUploadStart = () => {
      setIsUploading(true);
    };

    const handleComplete = (result) => {
      setIsUploading(false);
      if (result.successful.length > 0) {
        // KEY CHANGE: attach documentType from pendingDocType to each file
        const files = result.successful.map((f) => ({
          key: f.meta.key,
          filename: f.name,
          fileType: f.type,
          fileSize: f.size,
          documentType: pendingDocType, // KEY CHANGE: assigned here
        }));
        setNewlyUploadedFiles((prev) => [...prev, ...files]);
        toast.success("Files uploaded!");
        setIsUppyModalOpen(false);
        uppy.cancelAll();
      }
    };

    const handleCancel = () => {
      setIsUploading(false);
    };

    uppy.on("upload", handleUploadStart);
    uppy.on("complete", handleComplete);
    uppy.on("cancel-all", handleCancel);

    return () => {
      uppy.off("upload", handleUploadStart);
      uppy.off("complete", handleComplete);
      uppy.off("cancel-all", handleCancel);
    };
  }, [uppy, pendingDocType]); // KEY CHANGE: pendingDocType in dependency array

  // Cleanup
  useEffect(() => {
    return () => uppy.close();
  }, [uppy]);

  // --- FILE HANDLERS ---
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
    } catch (error) {
      toast.error("File not found");
    }
  };

  const handleDeleteFile = async (taskId, fileKey) => {
    if (!window.confirm("Delete file?")) return;
    try {
      const res = await axios.delete(
        `/api/tasks/${taskId}/file/${encodeURIComponent(fileKey)}`,
      );
      setFormData((prev) => ({ ...prev, files: res.data.data.files }));
      toast.success("File deleted");
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  // KEY CHANGE: renderFileList now shows documentType badge — same as DocketPage
  const renderFileList = (files, allowDelete = false) => {
    if (!files || files.length === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "5px",
        }}
      >
        {files.map((file, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "6px 10px",
              backgroundColor: "#f9fafb",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
            }}
          >
            <span style={{ fontWeight: 500 }}>{file.filename}</span>

            {/* KEY CHANGE: documentType badge — same as DocketPage FileItem */}
            {file.documentType && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "4px",
                  color: "#4b5563",
                  fontWeight: "500",
                }}
              >
                {file.documentType}
              </span>
            )}

            <button
              type="button"
              onClick={() => handleDownloadFile(file.key, file.filename)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#2563eb",
                padding: 0,
              }}
            >
              <Download size={14} />
            </button>
            {allowDelete && formData._id && (
              <button
                type="button"
                onClick={() => handleDeleteFile(formData._id, file.key)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#ef4444",
                  padding: 0,
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    fetchTasks();
    fetchTaskStats();
    fetchUsers();
    fetchServiceFees();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [filters, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.docket_no && !formData.docket_id) {
        searchDockets(formData.docket_no);
      } else {
        setShowDocketSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.docket_no, formData.docket_id]);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      let filterValue = "";
      switch (statusParam) {
        case "overdue":
        case "dueToday":
        case "completedToday":
          break;
        default:
          filterValue = statusParam;
      }
      setFilters((prev) => ({
        ...prev,
        task_status: filterValue,
        special_filter: statusParam,
      }));
      setCurrentPage(1);
    }
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "docket_no") {
      setFormData({ ...formData, [name]: value, docket_id: "" });
      if (value.length === 0) setShowDocketSuggestions(false);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setCurrentPage(1);
  };

  const getOfficialFee = (service, applicantType) => {
    if (!service) return 0;
    const isSmall = [
      "Natural person",
      "Start-up",
      "Small entity",
      "Educational institution",
    ].includes(applicantType);
    return isSmall ? service.official_fee_small : service.official_fee_large;
  };

  const selectDocket = (docket) => {
    setFormData({
      ...formData,
      docket_id: docket._id,
      docket_no: docket.docket_no,
      work_type: docket.service_name,
      client_ref_no: docket.client_ref || "",
      client_name: docket.firm_name || "",
      pct_application_no: docket.application_no || "",
      country: docket.filling_country || "",
      filling_country: docket.filling_country || "",
      title: docket.title || "",
      application_type: docket.application_type || "",
      instruction_date: docket.instruction_date
        ? docket.instruction_date.split("T")[0]
        : "",
      filling_date: docket.filling_date
        ? docket.filling_date.split("T")[0]
        : "",
    });
    setShowDocketSuggestions(false);
    setDocketSuggestions([]);
  };

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const getUserName = (field) => {
    if (!field) return "";
    if (typeof field === "object" && field.name) return field.name;
    if (typeof field === "object" && field.email) return field.email;
    const user = users.find((u) => u._id === field);
    return user ? user.name || user.email : "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };

    if (!formData.docket_id) {
      return toast.error("Please select a valid docket from the list.");
    }

    try {
      if (formData._id) {
        await axios.put(`/api/tasks/${formData._id}`, {
          ...payload,
          newFiles: newlyUploadedFiles,
        });
        toast.success("Task updated successfully");
      } else {
        payload.files = newlyUploadedFiles;
        await axios.post(`/api/tasks`, payload);
        setTotalRecords((prev) => prev + 1);
        updateStats("tasks", 1);
        toast.success("Task created successfully");
      }

      fetchTasks();
      setShowModal(false);
      setFormData(initialFormState);
      setNewlyUploadedFiles([]);
      // KEY CHANGE: reset pendingDocType on submit
      setPendingDocType("");
    } catch (err) {
      toast.error(`${err?.response?.data?.message || err.message}`);
    }
  };

  // --- REPLICA HANDLER ---
  const handleReplica = (task) => {
    // Remove _id, timestamps, and version fields so it creates a new record
    const {
      _id,
      createdAt,
      updatedAt,
      __v,
      sub_status,
      prepared_by_name,
      review_by_name,
      final_review_by_name,
      ...replicaData
    } = task;

    // Clean up null date fields
    const cleanedData = { ...replicaData };
    if (cleanedData.instruction_date === null)
      cleanedData.instruction_date = "";
    if (cleanedData.internal_deadline === null)
      cleanedData.internal_deadline = "";
    if (cleanedData.official_deadline === null)
      cleanedData.official_deadline = "";
    if (cleanedData.filling_date === null) cleanedData.filling_date = "";
    if (cleanedData.reporting_date === null) cleanedData.reporting_date = "";

    // Format date fields to YYYY-MM-DD for input fields
    if (cleanedData.instruction_date)
      cleanedData.instruction_date = cleanedData.instruction_date.split("T")[0];
    if (cleanedData.internal_deadline)
      cleanedData.internal_deadline =
        cleanedData.internal_deadline.split("T")[0];
    if (cleanedData.official_deadline)
      cleanedData.official_deadline =
        cleanedData.official_deadline.split("T")[0];
    if (cleanedData.filling_date)
      cleanedData.filling_date = cleanedData.filling_date.split("T")[0];
    if (cleanedData.reporting_date)
      cleanedData.reporting_date = cleanedData.reporting_date.split("T")[0];

    // Extract IDs from populated user fields
    cleanedData.territory_manager = extractId(cleanedData.territory_manager);
    cleanedData.prepared_by = extractId(cleanedData.prepared_by);
    cleanedData.review_by = extractId(cleanedData.review_by);
    cleanedData.final_review_by = extractId(cleanedData.final_review_by);

    // Reset task status for the new copy
    cleanedData.task_status = "Pending";

    // Don't copy files - new task starts fresh
    cleanedData.files = [];

    setFormData({
      ...initialFormState,
      ...cleanedData,
    });
    setNewlyUploadedFiles([]);
    setPendingDocType("");
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setDeleteTaskId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/tasks/${deleteTaskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== deleteTaskId));
      setTotalRecords((prev) => prev - 1);
      updateStats("tasks", -1);
      toast.success("Task deleted successfully");
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Delete failed", err);
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setShowDeleteModal(false);
      setDeleteTaskId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let startPage = Math.max(1, currentPage - 1);
      let endPage = Math.min(totalPages, startPage + 2);
      if (endPage - startPage < 2) startPage = Math.max(1, endPage - 2);
      for (let i = startPage; i <= endPage; i++) pages.push(i);
    }
    return pages;
  };

  const extractId = (field) => {
    if (!field) return "";
    if (typeof field === "object" && field._id) return field._id;
    return field;
  };

  // AFTER — fetch fresh data so files added by staff are visible
  const openEditModal = async (task) => {
    try {
      // Always fetch latest so staff-uploaded files are included
      const res = await axios.get(`/api/tasks/${task._id}`);
      const fresh = res.data;

      setFormData({
        _id: fresh._id,
        docket_id: fresh.docket_id || "",
        docket_no: fresh.docket_no || "",
        work_type: fresh.work_type || "",
        task_status: fresh.task_status || "",
        territory_manager: extractId(fresh.territory_manager),
        prepared_by: extractId(fresh.prepared_by),
        review_by: extractId(fresh.review_by),
        final_review_by: extractId(fresh.final_review_by),
        country: fresh.country || "",
        remarks: fresh.remarks || "",
        client_ref_no: fresh.client_ref_no || "",
        pct_application_no: fresh.pct_application_no || "",
        client_name: fresh.client_name || "",
        title: fresh.title || "",
        application_type: fresh.application_type || "",
        filling_country: fresh.filling_country || "",
        instruction_date: fresh.instruction_date
          ? fresh.instruction_date.split("T")[0]
          : "",
        internal_deadline: fresh.internal_deadline
          ? fresh.internal_deadline.split("T")[0]
          : "",
        official_deadline: fresh.official_deadline
          ? fresh.official_deadline.split("T")[0]
          : "",
        filling_date: fresh.filling_date
          ? fresh.filling_date.split("T")[0]
          : "",
        reporting_date: fresh.reporting_date
          ? fresh.reporting_date.split("T")[0]
          : "",

        // KEY: use fresh.files so staff-uploaded files are included
        files: fresh.files || [],
      });
      setNewlyUploadedFiles([]);
      setPendingDocType("");
      setShowModal(true);
    } catch (err) {
      toast.error("Failed to load task details");
      console.error(err);
    }
  };
  const handleExport = () => {
    const dataToExport =
      selectedIds.length > 0
        ? tasks.filter((t) => selectedIds.includes(t._id))
        : tasks;
    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = dataToExport.map((task, index) => ({
      "Sr No": (currentPage - 1) * recordsPerPage + index + 1,
      Date: formatDate(task.createdAt || task.instruction_date),
      "anovIP Reference": task.docket_no || "",
      Client: task.client_ref_no || task.client_name || "",
      "Work Type": task.work_type || task.application_type || "",
      "Prepared By":
        task.prepared_by_name || getUserName(task.prepared_by) || "--",
      "Review By": task.review_by_name || getUserName(task.review_by) || "--",
      "Final Review By":
        task.final_review_by_name || getUserName(task.final_review_by) || "--",
      Country: task.country || "--",
      Remarks: task.remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
    const maxWidth = 20;
    worksheet["!cols"] = Object.keys(exportData[0]).map(() => ({
      wch: maxWidth,
    }));
    const fileName = `Tasks_Export_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Excel file downloaded successfully");
  };

  const fetchTaskStats = async () => {
    try {
      const res = await axios.get("/api/tasks/status-counts");
      setStatsCounts(res.data);
    } catch (err) {
      console.error("Failed to fetch task stats");
    }
  };

  const taskStats = [
    {
      title: "Overdue",
      count: statsCounts.overdue,
      icon: <DeadlineIcon />,
      link: "/task?status=overdue",
    },
    {
      title: "Due Today",
      count: statsCounts.dueToday,
      icon: <ApplicationIcon />,
      link: "/task?status=dueToday",
    },
    {
      title: "In Progress",
      count: statsCounts.inProgress,
      icon: <DeadlineIcon />,
      link: "/task?status=In Progress",
    },
    {
      title: "Completed Today",
      count: statsCounts.completedToday,
      icon: <DocketIcon />,
      link: "/task?status=completedToday",
    },
  ];

  return (
    <div style={styles.container}>
      <StatsRow items={taskStats} />

      <div style={styles.tableCard}>
        <div style={styles.tableHeaderRow}>
          <h3 style={styles.tableTitle}>Task</h3>
          <div style={styles.filtersRow}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Start Date</label>
              <input
                type="date"
                name="start_date"
                style={styles.filterInput}
                value={filters.start_date}
                onChange={handleFilterChange}
              />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>End Date</label>
              <input
                type="date"
                name="end_date"
                style={styles.filterInput}
                value={filters.end_date}
                onChange={handleFilterChange}
              />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Docket No.</label>
              <input
                type="text"
                name="docket_no"
                style={styles.filterInput}
                value={filters.docket_no}
                onChange={handleFilterChange}
              />
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Task Status</label>
              <select
                name="task_status"
                style={styles.filterInput}
                value={filters.task_status}
                onChange={handleFilterChange}
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Country</label>
              <input
                type="text"
                name="country"
                style={styles.filterInput}
                value={filters.country}
                onChange={handleFilterChange}
              />
            </div>
            <button style={styles.collapseBtn} onClick={handleResetFilters}>
              <RotateCw size={18} />
            </button>
            <button
              style={styles.createBtn}
              onClick={() => {
                setFormData(initialFormState);
                setPendingDocType(""); // KEY CHANGE: reset on open
                setNewlyUploadedFiles([]);
                setShowModal(true);
              }}
            >
              <Plus size={14} />
            </button>
            {/* <button style={styles.exportBtn} onClick={handleExport}>
              <DownloadIcon size={14} />
            </button> */}
          </div>
        </div>

        <DeleteConfirmModal
          show={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
          message="Are you sure you want to delete this task?"
        />

        <div style={styles.tableWrapper}>
          {selectedIds.length > 0 && (
            <div
              style={{
                backgroundColor: "#eff6ff",
                padding: "10px 15px",
                marginBottom: "10px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                gap: "15px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#1d4ed8",
                }}
              >
                {selectedIds.length} Selected
              </span>
              <button
                onClick={handleBulkDelete}
                style={{ ...styles.deleteBtn, padding: "6px 12px" }}
              >
                <Trash2 size={14} style={{ marginRight: 5 }} />
              </button>
              <button
                onClick={() => handleExport()}
                style={{ ...styles.exportBtn, padding: "6px 12px" }}
              >
                <Download size={14} style={{ marginRight: 5 }} />
              </button>
            </div>
          )}
          <table style={styles.table}>
            <thead>
              <tr>
                <th
                  style={{
                    ...styles.th,
                    ...styles.stickyHeader,
                    width: "40px",
                  }}
                >
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      tasks.length > 0 && selectedIds.length === tasks.length
                    }
                  />
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Action</th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Sr no.</th>
                <th
                  style={{
                    ...styles.th,
                    ...styles.stickyHeader,
                    cursor: "pointer",
                  }}
                  onClick={() => handleSort("createdAt")}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    Date
                    {sortConfig.key === "createdAt" &&
                      (sortConfig.direction === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      ))}
                  </div>
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  anovIP Reference
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Client</th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Worktype
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Prepared
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Review</th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Final Review
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Status / Stage
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={styles.tdCenter}>
                    Loading...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="11" style={styles.tdCenter}>
                    No records found
                  </td>
                </tr>
              ) : (
                tasks.map((task, index) => (
                  <tr key={task._id} style={styles.tr}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(task._id)}
                        onChange={() => handleSelectRow(task._id)}
                      />
                    </td>
                    <td style={styles.td}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        {/* EDIT BUTTON */}
                        <span
                          title="Edit"
                          style={styles.viewLink}
                          onClick={() => openEditModal(task)}
                        >
                          <span style={{ color: "#f97316" }}>
                            <Pencil style={{ scale: "0.7" }} />
                          </span>
                        </span>

                        {/* REPLICA BUTTON - replaced Delete */}
                        <span
                          title="Replica"
                          style={{ ...styles.viewLink, color: "#6b7280" }}
                          onClick={() => handleReplica(task)}
                        >
                          <span style={{ color: "#6b7280" }}>
                            <Copy style={{ scale: "0.7" }} />
                          </span>
                        </span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      {(currentPage - 1) * recordsPerPage + index + 1}
                    </td>
                    <td style={styles.td}>
                      {formatDate(task.createdAt || task.instruction_date)}
                    </td>
                    <td style={styles.td}>{task.docket_no}</td>
                    <td style={styles.td}>
                      {task.client_ref_no || task.client_name}
                    </td>
                    <td style={styles.td}>
                      {task.work_type || task.application_type}
                    </td>
                    <td style={styles.td}>
                      {task.prepared_by_name ||
                        getUserName(task.prepared_by) ||
                        "--"}
                    </td>
                    <td style={styles.td}>
                      {task.review_by_name ||
                        getUserName(task.review_by) ||
                        "--"}
                    </td>
                    <td style={styles.td}>
                      {task.final_review_by_name ||
                        getUserName(task.final_review_by) ||
                        "--"}
                    </td>

                    <td style={styles.td}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "600",
                            backgroundColor:
                              task.task_status === "Completed"
                                ? "#d1fae5"
                                : task.task_status === "In Progress"
                                  ? "#dbeafe"
                                  : task.task_status === "On Hold"
                                    ? "#fee2e2"
                                    : "#f3f4f6",
                            color:
                              task.task_status === "Completed"
                                ? "#065f46"
                                : task.task_status === "In Progress"
                                  ? "#1e40af"
                                  : task.task_status === "On Hold"
                                    ? "#991b1b"
                                    : "#374151",
                          }}
                        >
                          {task.task_status || "Pending"}
                        </span>
                        <div
                          onClick={() => setTimelineTask(task)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                            gap: "4px",
                          }}
                          title="View stage timeline"
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              backgroundColor: task.sub_status
                                ? "#fff7ed"
                                : "#f3f4f6",
                              color: task.sub_status ? "#f97316" : "#6b7280",
                              border: task.sub_status
                                ? "1px solid #fed7aa"
                                : "1px solid transparent",
                            }}
                          >
                            {task.sub_status || "Not Started"}
                          </span>
                          <Activity size={12} color="#f97316" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            backgroundColor: "#fff",
            borderTop: "1px solid #f3f4f6",
            padding: "10px 0 0 0",
            zIndex: 5,
          }}
        >
          <div style={styles.pagination}>
            <span style={styles.paginationInfo}>
              Showing{" "}
              <strong>
                {(currentPage - 1) * recordsPerPage + 1}-
                {Math.min(currentPage * recordsPerPage, totalRecords)}
              </strong>{" "}
              of <strong>{totalRecords.toLocaleString()}</strong> orders
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
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
      </div>

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h5 style={styles.modalTitle}>
                {formData._id ? "Edit Task" : "Create Task"}
              </h5>
              <button
                style={styles.modalCloseBtn}
                onClick={() => {
                  setShowModal(false);
                  setPendingDocType("");
                  setNewlyUploadedFiles([]);
                }}
              >
                ✕
              </button>
            </div>
            <form style={styles.modalBody} onSubmit={handleSubmit}>
              <div style={styles.formColumns}>
                {/* LEFT COLUMN */}
                <div style={styles.formColumn}>
                  <h6 style={styles.sectionTitle}>Basic</h6>
                  <div style={styles.formGrid}>
                    <div style={{ ...styles.formGroup, position: "relative" }}>
                      <label style={styles.formLabel}>Docket</label>
                      <input
                        type="text"
                        name="docket_no"
                        style={styles.formInput}
                        placeholder="Docket no."
                        value={formData.docket_no}
                        onChange={(e) => {
                          const { value } = e.target;
                          setFormData({
                            ...formData,
                            docket_no: value,
                            docket_id: "",
                          });
                        }}
                        onFocus={() => {
                          if (formData.docket_no && !formData.docket_id) {
                            setShowDocketSuggestions(true);
                          }
                        }}
                        autoComplete="off"
                        required
                      />
                      {showDocketSuggestions && (
                        <div style={styles.suggestionBox}>
                          {docketSuggestions.length > 0 ? (
                            docketSuggestions.map((d, i) => (
                              <div
                                key={i}
                                style={styles.suggestionItem}
                                onClick={() => selectDocket(d)}
                              >
                                <strong>{d.docket_no}</strong> -{" "}
                                {d.title || d.firm_name || "No title"}
                              </div>
                            ))
                          ) : (
                            <div
                              style={{
                                ...styles.suggestionItem,
                                color: "#ef4444",
                                textAlign: "center",
                                cursor: "default",
                              }}
                            >
                              No docket found matching "{formData.docket_no}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Work Type</label>
                      <select
                        name="work_type"
                        style={styles.formSelect}
                        value={formData.work_type}
                        onChange={handleInputChange}
                      >
                        {serviceFeesList.map((s) => (
                          <option key={s._id} value={s.service_name}>
                            {s.service_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Task Status</label>
                      <select
                        name="task_status"
                        style={styles.formSelect}
                        value={formData.task_status}
                        onChange={handleInputChange}
                      >
                        <option value="">Select</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Territory Manager</label>
                      <select
                        name="territory_manager"
                        style={styles.formSelect}
                        value={formData.territory_manager}
                        onChange={handleInputChange}
                      >
                        <option value="">Select</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                    Examinations
                  </h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Prepared By</label>
                      <select
                        name="prepared_by"
                        style={styles.formSelect}
                        value={formData.prepared_by}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Review & Upload</label>
                      <select
                        name="review_by"
                        style={styles.formSelect}
                        value={formData.review_by}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        Final Review & Filled By
                      </label>
                      <select
                        name="final_review_by"
                        style={styles.formSelect}
                        value={formData.final_review_by}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Select</option>
                        {users.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Country</label>
                      <input
                        type="text"
                        name="country"
                        style={styles.formInput}
                        placeholder="Country"
                        value={formData.country}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>Remarks</label>
                      <input
                        type="text"
                        name="remarks"
                        style={styles.formInput}
                        placeholder="Remarks"
                        value={formData.remarks}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={styles.formColumn}>
                  <h6 style={styles.sectionTitle}>Application Details</h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Client Ref. No.</label>
                      <input
                        type="text"
                        name="client_ref_no"
                        style={styles.formInput}
                        placeholder="Client Ref. No."
                        value={formData.client_ref_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        PCT / Application No.
                      </label>
                      <input
                        type="text"
                        name="pct_application_no"
                        style={styles.formInput}
                        placeholder="PCT / Application No."
                        value={formData.pct_application_no}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                    Application Dates
                  </h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Instruction Date</label>
                      <input
                        type="date"
                        name="instruction_date"
                        style={styles.formInput}
                        value={formData.instruction_date}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Internal Deadline</label>
                      <input
                        type="date"
                        name="internal_deadline"
                        style={styles.formInput}
                        value={formData.internal_deadline}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Official Deadline</label>
                      <input
                        type="date"
                        name="official_deadline"
                        style={styles.formInput}
                        value={formData.official_deadline}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Filling Date</label>
                      <input
                        type="date"
                        name="filling_date"
                        style={styles.formInput}
                        value={formData.filling_date}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Reporting Date</label>
                      <input
                        type="date"
                        name="reporting_date"
                        style={styles.formInput}
                        value={formData.reporting_date}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Filling Country</label>
                      <input
                        type="text"
                        name="filling_country"
                        style={styles.formInput}
                        placeholder="Filling Country"
                        value={formData.filling_country}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* KEY CHANGE: Document Type + File Upload section — same 2-col grid as DocketPage */}
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "16px",
                        }}
                      >
                        {/* Document Type selector */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "12px",
                              color: "#6b7280",
                              fontWeight: "500",
                            }}
                          >
                            Document Type *
                          </label>
                          <select
                            value={pendingDocType}
                            onChange={(e) => setPendingDocType(e.target.value)}
                            style={{
                              ...styles.formSelect,
                              borderColor: pendingDocType
                                ? "#f97316"
                                : "#e5e7eb",
                              backgroundColor: pendingDocType
                                ? "#fff7ed"
                                : "#fff",
                            }}
                          >
                            <option value="">-- Select Type --</option>
                            <option value="Input">Input</option>
                            <option value="Internal">Internal</option>
                            <option value="Output">Output</option>
                          </select>
                        </div>

                        {/* Attach Files */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <label style={styles.formLabel}>Documents</label>
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
                            disabled={isUploading}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "8px 12px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              backgroundColor: isUploading
                                ? "#e5e7eb"
                                : "#f3f4f6",
                              cursor: isUploading ? "not-allowed" : "pointer",
                              fontSize: "13px",
                              height: "40px",
                            }}
                          >
                            <Paperclip size={14} />
                            {isUploading ? "Uploading..." : "Attach Files"}
                          </button>
                        </div>
                      </div>

                      {/* Existing files list */}
                      {formData.files && formData.files.length > 0 && (
                        <div style={{ marginTop: "10px" }}>
                          <small style={{ color: "#666" }}>Existing:</small>
                          {renderFileList(formData.files, true)}
                        </div>
                      )}

                      {/* Newly uploaded files list */}
                      {newlyUploadedFiles.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <small style={{ color: "green" }}>
                            Ready to save:
                          </small>
                          {renderFileList(newlyUploadedFiles, false)}
                        </div>
                      )}
                    </div>
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
                    {isUploading ? "Uploading Files..." : "Submit"}
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
        note="Select document type before attaching files."
      />
      {timelineTask && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: "600px" }}>
            <div style={styles.modalHeader}>
              <h5 style={styles.modalTitle}>Stage Timeline</h5>
              <button
                style={styles.modalCloseBtn}
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
                Docket: <strong>{timelineTask.docket_no}</strong>
                &nbsp;|&nbsp; Status:{" "}
                <strong>{timelineTask.task_status || "Pending"}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 0",
                }}
              >
                {[
                  {
                    label: "Preparation",
                    user:
                      timelineTask.prepared_by_name ||
                      getUserName(timelineTask.prepared_by),
                    step: "Prepared",
                  },
                  {
                    label: "Review",
                    user:
                      timelineTask.review_by_name ||
                      getUserName(timelineTask.review_by),
                    step: "Reviewed",
                  },
                  {
                    label: "Final Review",
                    user:
                      timelineTask.final_review_by_name ||
                      getUserName(timelineTask.final_review_by),
                    step: "Final Reviewed",
                  },
                ].map(({ label, user, step }, i, arr) => {
                  const done =
                    getTimelineStatus(timelineTask.sub_status, step) ===
                    "completed";
                  return (
                    <React.Fragment key={step}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            backgroundColor: done ? "#22c55e" : "#e5e7eb",
                            border: `2px solid ${done ? "#22c55e" : "#d1d5db"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {done ? (
                            <Check size={18} color="#fff" />
                          ) : (
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: "bold",
                                color: "#374151",
                              }}
                            >
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          {label}
                        </span>
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>
                          {user || "Unassigned"}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div
                          style={{
                            flex: 1,
                            height: "3px",
                            margin: "0 10px",
                            marginBottom: "30px",
                            borderRadius: "2px",
                            backgroundColor: done ? "#22c55e" : "#e5e7eb",
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {},
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tableHeaderRow: { marginBottom: "20px" },
  tableTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
    margin: "0 0 15px 0",
  },
  filtersRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "16%",
  },
  filterLabel: { fontSize: "11px", color: "#6b7280", fontWeight: "500" },
  filterInput: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    width: "100%",
    outline: "none",
  },
  createBtn: {
    padding: "10px 20px",
    backgroundColor: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },
  exportBtn: {
    padding: "10px 20px",
    backgroundColor: "#fff",
    color: "#f97316",
    border: "1px solid #f97316",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
  },
  tableWrapper: {
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "calc(100vh - 320px)",
    minHeight: "200px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    backgroundColor: "#f9fafb",
    zIndex: 10,
    boxShadow: "0 2px 2px -1px rgba(0, 0, 0, 0.1)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#6b7280",
    fontWeight: "600",
    borderBottom: "1px solid #f3f4f6",
    whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f3f4f6" },
  td: { padding: "14px 10px", color: "#374151", whiteSpace: "nowrap" },
  tdCenter: { padding: "30px", textAlign: "center", color: "#9ca3af" },
  viewLink: {
    color: "#111827",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "500",
    cursor: "pointer",
  },
  viewIcon: { color: "#f97316", fontSize: "10px" },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
    overflowY: "hidden",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    width: "95%",
    maxWidth: "1000px",
    marginBottom: "20px",
    maxHeight: "95vh",
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
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#111827",
  },
  modalCloseBtn: {
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#f3f4f6",
    cursor: "pointer",
    fontSize: "14px",
  },
  modalBody: { padding: "25px", overflowY: "auto", flex: 1 },
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
  formLabel: { fontSize: "12px", color: "#6b7280", fontWeight: "500" },
  formInput: {
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    backgroundColor: "#fff",
  },
  formSelect: {
    width: "220px",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    backgroundColor: "#fff",
  },
  suggestionBox: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    border: "1px solid #e5e7eb",
    maxHeight: "200px",
    overflowY: "auto",
    backgroundColor: "#fff",
    zIndex: 10,
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  suggestionItem: {
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: "13px",
    borderBottom: "1px solid #f3f4f6",
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
  deleteBtn: {
    padding: "6px 12px",
    backgroundColor: "rgb(239, 68, 68)",
    color: "rgb(255, 255, 255)",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  collapseBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "transparent",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "9px 12px",
    fontSize: "12px",
    color: "#6b7280",
    cursor: "pointer",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
};
