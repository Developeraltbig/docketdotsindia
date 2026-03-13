import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import {
  Plus,
  Trash2,
  Eye,
  Edit,
  Upload,
  Download,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  RotateCw,
  Pencil,
  Copy,
  ChevronDown,
  ChevronUp,
  Users,
  DollarSign,
  Paperclip,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import StatsRow, {
  ApplicationIcon,
  DeadlineIcon,
  DocketIcon,
} from "../components/StatsRow";
import useAuthStore from "../store/authStore";
import UpcomingRemindersSection from "../components/UpcomingReminders";
import { useLocation, useNavigate } from "react-router-dom";

import Uppy from "@uppy/core";
import AwsS3Multipart from "@uppy/aws-s3-multipart";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";

const APPLICATION_STATUSES = [
  "Inactive",
  "In-Process",
  "Filed",
  "Published",
  "Examination due",
  "Examination filed",
  "FER Issued",
  "Response to FER filed",
  "Hearing Issued",
  "Response to Hearing filed",
  "Granted",
];

const WORK_TYPES = [
  "Provisional",
  "Ordinary",
  "Ordinary+F18",
  "NP",
  "NP+F18",
  "Convention",
  "Convention+F18",
  "Form 3",
  "Form 4",
  "Form 6",
  "Form 8",
  "Form 9",
  "Form 13",
  "Form 18",
  "Form 25",
  "Form 26",
  "Form 27",
  "Form 28",
  "Form 29",
  "Response to Hearing",
  "Proof of Right",
  "Certificate for Translation Verification",
  "Priority Document",
  "Response to FER",
  "Annuity Fee",
  "Others",
];

const FIELD_OPTIONS = [
  { value: "", label: "Select Field" },
  { value: "emails", label: "Emails" },
  { value: "status", label: "Status" },
];

// ── Collapsible Section ──────────────────────────────────────────────
const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = false,
  accent = "#3b82f6",
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        marginBottom: "16px",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: accent,
          border: "none",
          cursor: "pointer",
          color: "#fff",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          {icon} {title}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{ padding: "18px 16px", backgroundColor: "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
};

const DeadlinePage = () => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("view");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteDeadlineId, setDeleteDeadlineId] = useState(null);
  const [docketSuggestions, setDocketSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [remindersKey, setRemindersKey] = useState(0);
  const fileInputRef = React.useRef(null);
  const [records, setRecords] = useState([]);
  const { updateStats } = useAuthStore();

  // ── NEW: Staff users for task assignment ──
  const [users, setUsers] = useState([]);

  // ── Uppy file upload state ──
  const [isUppyModalOpen, setIsUppyModalOpen] = useState(false);
  const [newlyUploadedFiles, setNewlyUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDocType, setPendingDocType] = useState("");

  const [statsCounts, setStatsCounts] = useState({
    Due_within_72_Hours: 0,
    This_Week: 0,
    This_Month: 0,
    Overdue: 0,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    docket_number: "",
    application_no: "",
    application_status: "",
    worktype: "",
    deadline_date: "",
    selected_field: "",
    dynamic_search: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "deadline_date",
    direction: "asc",
  });
  const [selectedIds, setSelectedIds] = useState([]);

  // ── Extended initialFormState with task fields ──
  const initialFormState = {
    // Deadline fields
    docket_id: "",
    docket_number: "",
    application_no: "",
    application_status: "",
    app_number: "",
    worktype: "",
    deadline_date: "",
    remarks: "",
    remainder1: "",
    remainder2: "",
    remainder3: "",
    remainder4: "",
    remainder5: "",
    remainder6: "",
    emails: [""],
    status: "ON",
    insertby: "",
    // Task / Assignment fields
    prepared_by: "",
    review_by: "",
    final_review_by: "",
    territory_manager: "",
    internal_deadline: "",
    official_deadline: "",
    in_matter: "",
    // Fee fields
    currency: "INR",
    associatefee: "",
    officialfee: "",
    anovipfee: "",
    fee: "",
    // Flag: whether to also create a task
    createTask: true,
  };
  const [formData, setFormData] = useState(initialFormState);

  const location = useLocation();
  const navigate = useNavigate();

  const handleResetFilters = () => {
    const cleanPath = window.location.origin + location.pathname;
    window.location.href = cleanPath;
  };

  const [serviceFeesList, setServiceFeesList] = useState([]);

  const fetchServiceFees = async () => {
    try {
      const res = await axios.get(`/api/service-fees/active`);
      setServiceFeesList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch service fees", err);
    }
  };
  // ── Fetch staff users ──
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`/api/tasks/staff-users`);
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  // ── Uppy instance — uses the same S3 routes as Task page ──
  const uppy = useMemo(() => {
    const uppyInstance = new Uppy({
      id: "deadline-task-uploader",
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

  // ── Uppy event handlers ──
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
        toast.success("Files uploaded!");
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

  // ── Uppy cleanup on unmount ──
  useEffect(() => {
    return () => uppy.close();
  }, [uppy]);

  // ── File helpers ──
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
      toast.error("File not found");
    }
  };

  const renderFileList = (files) => {
    if (!files || files.length === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "8px",
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
            {file.documentType && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "4px",
                  color: "#4b5563",
                  fontWeight: 500,
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
              <Download size={13} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (location.state?.viewRecord) {
      handleViewDetail(location.state.viewRecord);
    }
  }, [location.state]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get("filter");
    if (!filter) return;
    const today = new Date();
    const toISO = (d) => d.toISOString().split("T")[0];
    if (filter === "72h") {
      const plus72 = new Date(today);
      plus72.setHours(today.getHours() + 72);
      setFilters((f) => ({
        ...f,
        start_date: toISO(today),
        end_date: toISO(plus72),
      }));
    } else if (filter === "week") {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      setFilters((f) => ({
        ...f,
        start_date: toISO(today),
        end_date: toISO(endOfWeek),
      }));
    } else if (filter === "month") {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFilters((f) => ({
        ...f,
        start_date: toISO(today),
        end_date: toISO(endOfMonth),
      }));
    } else if (filter === "overdue") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      setFilters((f) => ({ ...f, start_date: "", end_date: toISO(yesterday) }));
    }
  }, [location.search]);

  const fetchDeadlines = useCallback(
    async (page = 1, currentFilters = null, currentSort = null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 10 });
        const sortKey = currentSort ? currentSort.key : sortConfig.key;
        const sortDir = currentSort
          ? currentSort.direction
          : sortConfig.direction;
        params.append("sortBy", sortKey);
        params.append("sortOrder", sortDir);
        const filtersToUse = currentFilters || filters;
        Object.entries(filtersToUse).forEach(([key, value]) => {
          if (key === "selected_field" || key === "dynamic_search") return;
          if (value)
            params.append(
              key,
              typeof value === "string" ? value.trim() : value,
            );
        });
        if (filtersToUse.selected_field && filtersToUse.dynamic_search) {
          params.append(
            filtersToUse.selected_field,
            filtersToUse.dynamic_search.trim(),
          );
        }
        const res = await axios.get(`/api/deadlines?${params.toString()}`);
        setRecords(res.data.deadlines || []);
        setPagination({
          currentPage: res.data.currentPage,
          totalPages: res.data.totalPages,
          totalRecords: res.data.totalRecords,
        });
      } catch (err) {
        console.error("Error fetching deadlines:", err);
        toast.error("Error fetching data");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchDeadlines(1, filters, sortConfig); // immediate on mount

      return;
    }

    const timer = setTimeout(() => {
      fetchDeadlines(1, filters, sortConfig);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, sortConfig, fetchDeadlines]);

  // ── On mount ──
  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchServiceFees();
  }, []);

  // ── Auto-calc total fee ──
  useEffect(() => {
    const anovip = parseFloat(formData.anovipfee) || 0;
    const associate = parseFloat(formData.associatefee) || 0;
    const official = parseFloat(formData.officialfee) || 0;
    setFormData((prev) => ({
      ...prev,
      fee: Math.round(anovip + associate + official) || "",
    }));
  }, [formData.anovipfee, formData.associatefee, formData.officialfee]);

  const handleDocketSearch = async (value) => {
    setFormData((prev) => ({ ...prev, docket_number: value, docket_id: "" }));
    if (value.length > 1) {
      try {
        const res = await axios.get(`/api/deadlines/lookup-docket/${value}`);
        setDocketSuggestions(res.data);
        setShowSuggestions(res.data.length > 0);
      } catch (err) {
        setDocketSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setDocketSuggestions([]);
      setShowSuggestions(false);
    }
  };
  const getOfficialFee = (service, applicantType) => {
    if (!service) return "";
    const isSmall = [
      "Natural person",
      "Start-up",
      "Small entity",
      "Educational institution",
    ].includes(applicantType);
    return isSmall ? service.official_fee_small : service.official_fee_large;
  };

  const handleWorktypeChange = (e) => {
    const selectedName = e.target.value;
    const service = serviceFeesList.find(
      (s) => s.service_name === selectedName,
    );

    setFormData((prev) => ({
      ...prev,
      worktype: selectedName,
      official_fee: service ? getOfficialFee(service, prev.applicant_type) : "",
      our_fee: service ? service.our_fee : "",
    }));
  };
  const selectDocket = (docket) => {
    // Find matching service from the fees list using docket's service_name
    const service = serviceFeesList.find(
      (s) => s.service_name === docket.service_name,
    );

    const officialFee = service
      ? getOfficialFee(service, docket.applicant_type)
      : docket.officialfee || "";

    setFormData((prev) => ({
      ...prev,
      docket_id: docket._id || docket.id,
      docket_number: docket.docket_no,
      application_no: docket.application_no || "",
      application_status: docket.application_status || "",

      // ── Auto-fill from docket ──
      worktype: docket.service_name || "",
      applicant_type: docket.applicant_type || "",
      officialfee: officialFee,
      anovipfee: docket.anovipfee || (service ? service.our_fee : "") || "",
      associatefee: docket.associatefee || "",
      currency: docket.currency || "INR",
    }));

    setShowSuggestions(false);
  };

  const calculateRemainders = (deadlineDateStr) => {
    if (!deadlineDateStr) return {};
    const deadlineDate = new Date(deadlineDateStr);
    const today = new Date();
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const totalDays = Math.floor(timeDiff / (1000 * 3600 * 24));
    if (totalDays <= 0) return {};
    const remainder6 = new Date(deadlineDate);
    const remainder5 = new Date(remainder6);
    remainder5.setDate(remainder6.getDate() - 1);
    const remainder1 = new Date(today);
    remainder1.setDate(today.getDate() + Math.floor(totalDays / 2));
    const totalDaysBetween = Math.floor(
      (remainder6.getTime() - remainder1.getTime()) / (1000 * 3600 * 24),
    );
    const avgStep = Math.floor(totalDaysBetween / 4);
    const remainder2 = new Date(remainder1);
    remainder2.setDate(remainder1.getDate() + avgStep);
    const remainder3 = new Date(remainder2);
    remainder3.setDate(remainder2.getDate() + avgStep);
    const remainder4 = new Date(remainder3);
    remainder4.setDate(remainder3.getDate() + avgStep);
    const formatDate = (date) => date.toISOString().split("T")[0];
    return {
      remainder1: formatDate(remainder1),
      remainder2: formatDate(remainder2),
      remainder3: formatDate(remainder3),
      remainder4: formatDate(remainder4),
      remainder5: formatDate(remainder5),
      remainder6: formatDate(remainder6),
    };
  };

  const handleDeadlineDateChange = (e) => {
    const value = e.target.value;
    const remainders = calculateRemainders(value);
    setFormData((prev) => ({ ...prev, deadline_date: value, ...remainders }));
  };

  const addEmail = () =>
    setFormData((prev) => ({ ...prev, emails: [...prev.emails, ""] }));
  const removeEmail = (index) => {
    if (formData.emails.length > 1) {
      setFormData((prev) => ({
        ...prev,
        emails: prev.emails.filter((_, i) => i !== index),
      }));
    }
  };
  const handleEmailChange = (index, value) => {
    const newEmails = [...formData.emails];
    newEmails[index] = value;
    setFormData((prev) => ({ ...prev, emails: newEmails }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateNew = () => {
    setFormData(initialFormState);
    setIsEditMode(false);
    setEditingRecordId(null);
    setShowModal(true);
  };

  const handleEdit = (record) => {
    setFormData({
      ...initialFormState,
      ...record,
      docket_id: record.docket_id || record.docket?._id || "",
      docket_number: record.docket_number || record.docket?.docket_no || "",
      deadline_date: record.deadline_date
        ? record.deadline_date.split("T")[0]
        : "",
      remainder1: record.remainder1 ? record.remainder1.split("T")[0] : "",
      remainder2: record.remainder2 ? record.remainder2.split("T")[0] : "",
      remainder3: record.remainder3 ? record.remainder3.split("T")[0] : "",
      remainder4: record.remainder4 ? record.remainder4.split("T")[0] : "",
      remainder5: record.remainder5 ? record.remainder5.split("T")[0] : "",
      remainder6: record.remainder6 ? record.remainder6.split("T")[0] : "",
      emails: record.emails?.length > 0 ? record.emails : [""],
      createTask: false, // don't re-create task on edit
    });
    setEditingRecordId(record._id);
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleReplica = (record) => {
    const { _id, createdAt, updatedAt, __v, ...replicaData } = record;
    setFormData({
      ...initialFormState,
      ...replicaData,
      docket_id: record.docket_id || record.docket?._id || "",
      docket_number: record.docket_number || record.docket?.docket_no || "",
      deadline_date: record.deadline_date
        ? record.deadline_date.split("T")[0]
        : "",
      remainder1: record.remainder1 ? record.remainder1.split("T")[0] : "",
      remainder2: record.remainder2 ? record.remainder2.split("T")[0] : "",
      remainder3: record.remainder3 ? record.remainder3.split("T")[0] : "",
      remainder4: record.remainder4 ? record.remainder4.split("T")[0] : "",
      remainder5: record.remainder5 ? record.remainder5.split("T")[0] : "",
      remainder6: record.remainder6 ? record.remainder6.split("T")[0] : "",
      emails: record.emails?.length > 0 ? [...record.emails] : [""],
      status: record.status || "ON",
      createTask: true,
    });
    setEditingRecordId(null);
    setIsEditMode(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(initialFormState);
    setIsEditMode(false);
    setEditingRecordId(null);
    setNewlyUploadedFiles([]);
    setPendingDocType("");
    uppy.cancelAll();
  };

  // ── SUBMIT: create deadline + optionally create linked task ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.docket_id && typeof payload.docket_id === "object") {
      payload.docket_id = payload.docket_id._id || payload.docket_id.id;
    }
    if (!payload.docket_id) {
      return toast.error("Please select a valid docket from the suggestions.");
    }

    try {
      if (isEditMode && editingRecordId) {
        const res = await axios.put(
          `/api/deadlines/${editingRecordId}`,
          payload,
        );
        const updatedRecord = res.data.data || res.data;
        setRecords((prev) =>
          prev.map((d) => (d._id === editingRecordId ? updatedRecord : d)),
        );
        toast.success("Deadline updated successfully");
      } else {
        const res = await axios.post(`/api/deadlines`, payload);
        const newRecord = res.data.data || res.data;
        setRecords((prev) => [newRecord, ...prev]);
        setPagination((prev) => ({
          ...prev,
          totalRecords: prev.totalRecords + 1,
        }));
        updateStats("deadlines", 1);
        toast.success("Deadline created successfully");

        // ── Also create task if toggled on ──
        if (formData.createTask && formData.prepared_by) {
          try {
            // Build task payload — only include ObjectId fields if non-empty
            // to avoid MongoDB CastError on empty strings
            const taskPayload = {
              docket_id: payload.docket_id, // required, already validated
              docket_no: formData.docket_number,
              work_type: formData.worktype || "",
              task_status: "Pending",
              prepared_by: formData.prepared_by, // required — guarded by outer if
              pct_application_no: formData.application_no || "", // correct Task field name
              remarks: formData.in_matter || formData.remarks || "",
              files: newlyUploadedFiles, // attach uploaded files
            };

            // Only attach optional ObjectId fields when they have a value
            // — sending "" causes Mongoose CastError
            if (formData.review_by) taskPayload.review_by = formData.review_by;
            if (formData.final_review_by)
              taskPayload.final_review_by = formData.final_review_by;
            if (formData.territory_manager)
              taskPayload.territory_manager = formData.territory_manager;

            // Only attach date fields when non-empty — "" causes date cast errors
            if (formData.deadline_date)
              taskPayload.official_deadline = formData.deadline_date;
            if (formData.internal_deadline)
              taskPayload.internal_deadline = formData.internal_deadline;

            await axios.post(`/api/tasks`, taskPayload);
            updateStats("tasks", 1);
            toast.success("Linked task created successfully");
          } catch (taskErr) {
            toast.warning(
              "Deadline saved but task creation failed: " +
                (taskErr?.response?.data?.message || taskErr.message),
            );
          }
        }
      }

      setRemindersKey((prev) => prev + 1);
      setNewlyUploadedFiles([]);
      setPendingDocType("");
      handleCloseModal();
    } catch (err) {
      console.error("Deadline Save Error:", err);
      toast.error(
        err.response?.data?.message || "Format error. Please re-select docket.",
      );
    }
  };

  const handleDelete = (id) => {
    setDeleteDeadlineId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/deadlines/${deleteDeadlineId}`);
      setRecords((prev) => prev.filter((r) => r._id !== deleteDeadlineId));
      setPagination((prev) => ({
        ...prev,
        totalRecords: Math.max(0, prev.totalRecords - 1),
      }));
      updateStats("deadlines", -1);
      toast.success("Deadline Deleted Successfully");
      setRemindersKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setShowDeleteModal(false);
      setDeleteDeadlineId(null);
    }
  };

  const handleViewDetail = (record) => {
    setSelectedRecord(record);
    setActiveTab("view");
    setIsDetailView(true);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const res = await axios.get(
        `/api/deadlines/export/excel?${params.toString()}`,
      );
      const exportData = res.data.map((d) => ({
        "Docket Number": d.docket_number,
        "Application No": d.application_no,
        "App Number": d.app_number,
        Action: d.worktype,
        "Deadline Date": d.deadline_date?.split("T")[0],
        Status: d.status,
        Remarks: d.remarks,
        Emails: d.emails?.join(", "),
        "Created At": d.createdAt?.split("T")[0],
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Deadlines");
      XLSX.writeFile(
        wb,
        `Deadlines_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          if (jsonData.length === 0) {
            toast.error("No data found");
            setImporting(false);
            return;
          }
          const mappedData = jsonData.map((row) => ({
            docket_number: row["Docket Number"] || "",
            application_no: row["Application No"] || "",
            app_number: row["App Number"] || "",
            worktype: row["Action"] || row["WorkType"] || "",
            deadline_date: parseExcelDate(row["Deadline Date"]),
            status: row["Status"] || "ON",
            remarks: row["Remarks"] || "",
            emails: row["Emails"]
              ? row["Emails"].split(",").map((e) => e.trim())
              : [],
            remainder1: parseExcelDate(row["Remainder 1"]),
            remainder2: parseExcelDate(row["Remainder 2"]),
            remainder3: parseExcelDate(row["Remainder 3"]),
            remainder4: parseExcelDate(row["Remainder 4"]),
            remainder5: parseExcelDate(row["Remainder 5"]),
            remainder6: parseExcelDate(row["Remainder 6"]),
          }));
          const res = await axios.post("/api/deadlines/bulk-import", {
            deadlines: mappedData,
          });
          const importedCount = res.data.imported || mappedData.length;
          toast.success(`Successfully imported ${importedCount} records`);
          fetchDeadlines(1);
          updateStats("deadlines", importedCount);
          setRemindersKey((prev) => prev + 1);
        } catch (parseError) {
          toast.error("Error parsing Excel file.");
        }
        setImporting(false);
      };
      reader.onerror = () => {
        toast.error("Error reading file");
        setImporting(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Import failed.");
      setImporting(false);
    }
    e.target.value = "";
  };

  const parseExcelDate = (value) => {
    if (!value) return "";
    if (typeof value === "string") {
      const p = new Date(value);
      return isNaN(p.getTime()) ? "" : p.toISOString().split("T")[0];
    }
    if (typeof value === "number") {
      const d = new Date(new Date(1899, 11, 30).getTime() + value * 86400000);
      return d.toISOString().split("T")[0];
    }
    return "";
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Docket Number": "SAMPLE-001",
        "Application No": "APP-001",
        "App Number": "",
        Action: "Provisional",
        "Deadline Date": "2025-02-15",
        Status: "ON",
        Remarks: "Sample remark",
        Emails: "email1@example.com",
        "Remainder 1": "",
        "Remainder 2": "",
        "Remainder 3": "",
        "Remainder 4": "",
        "Remainder 5": "",
        "Remainder 6": "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    ws["!cols"] = Object.keys(templateData[0]).map((k) => ({
      wch: Math.max(k.length, 20),
    }));
    XLSX.writeFile(wb, "deadline_import_template.xlsx");
    toast.success("Template downloaded");
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? records.map((r) => r._id) : []);
  };
  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} records?`)) return;
    try {
      await Promise.all(
        selectedIds.map((id) => axios.delete(`/api/deadlines/${id}`)),
      );
      toast.success("Records deleted");
      setSelectedIds([]);
      fetchDeadlines(1);
      updateStats("deadlines", -selectedIds.length);
      setRemindersKey((prev) => prev + 1);
    } catch (err) {
      toast.error("Error deleting records");
    }
  };

  const handleBulkExport = () => {
    const selectedData = records.filter((r) => selectedIds.includes(r._id));
    if (!selectedData.length) {
      toast.warning("No records selected");
      return;
    }
    const exportData = selectedData.map((d) => ({
      "Docket Number": d.docket_number,
      "Application No": d.application_no,
      Action: d.worktype,
      "Deadline Date": d.deadline_date?.split("T")[0],
      Status: d.status,
      Remarks: d.remarks,
      Emails: d.emails?.join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Selected_Deadlines");
    XLSX.writeFile(
      wb,
      `Selected_Deadlines_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Exported successfully");
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get("/api/deadlines/stats");
      setStatsCounts(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const deadlineStats = [
    {
      title: "Due within 72 Hours",
      count: statsCounts.Due_within_72_Hours || 0,
      icon: <DocketIcon />,
      link: "/deadline?filter=72h",
    },
    {
      title: "This Week",
      count: statsCounts.This_Week || 0,
      icon: <ApplicationIcon />,
      link: "/deadline?filter=week",
    },
    {
      title: "This Month",
      count: statsCounts.This_Month || 0,
      icon: <DeadlineIcon />,
      link: "/deadline?filter=month",
    },
    {
      title: "Overdue",
      count: statsCounts.Overdue || 0,
      icon: <DocketIcon />,
      link: "/deadline?filter=overdue",
    },
  ];

  // ── Shared label/input styles ──
  const fl = {
    fontSize: "11px",
    color: "#6b7280",
    fontWeight: 600,
    marginBottom: "4px",
    display: "block",
  };
  const fi = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  };
  const fs = { ...fi, backgroundColor: "#fff" };

  return (
    <div className="p-0">
      <style>{`
        .uppy-Container {
          position: absolute !important;
          z-index: 9999 !important;
        }
      `}</style>
      <StatsRow items={deadlineStats} />
      <UpcomingRemindersSection key={remindersKey} />
      <DeleteConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this deadline?"
      />

      {/* Filter Section */}
      <div className="card shadow-sm mb-3">
        <div className="card-body p-2">
          <div
            className="d-flex flex-nowrap align-items-end gap-2 overflow-x-auto w-100 pb-1"
            style={{ fontSize: "12px" }}
          >
            {[
              { label: "START DATE", type: "date", key: "start_date" },
              { label: "END DATE", type: "date", key: "end_date" },
            ].map(({ label, type, key }) => (
              <div
                key={key}
                className="d-flex flex-column"
                style={{ flex: "1 1 0", minWidth: "105px" }}
              >
                <label
                  className="text-muted fw-bold mb-1"
                  style={{ fontSize: "10px", whiteSpace: "nowrap" }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  className="form-control form-control-sm shadow-none"
                  value={filters[key] || ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div
              className="d-flex flex-column"
              style={{ flex: "1 1 0", minWidth: "100px" }}
            >
              <label
                className="text-muted fw-bold mb-1"
                style={{ fontSize: "10px" }}
              >
                DOCKET NO.
              </label>
              <input
                type="text"
                className="form-control form-control-sm shadow-none"
                placeholder="Search..."
                value={filters.docket_number || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, docket_number: e.target.value }))
                }
              />
            </div>
            <div
              className="d-flex flex-column"
              style={{ flex: "1 1 0", minWidth: "115px" }}
            >
              <label
                className="text-muted fw-bold mb-1"
                style={{ fontSize: "10px" }}
              >
                APP NO.
              </label>
              <input
                type="text"
                className="form-control form-control-sm shadow-none"
                placeholder="Search..."
                value={filters.application_no || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, application_no: e.target.value }))
                }
              />
            </div>
            <div
              className="d-flex flex-column"
              style={{ flex: "1 1 0", minWidth: "120px" }}
            >
              <label
                className="text-muted fw-bold mb-1"
                style={{ fontSize: "10px" }}
              >
                WORK TYPE
              </label>
              <select
                className="form-select form-select-sm shadow-none"
                value={filters.worktype || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, worktype: e.target.value }))
                }
              >
                <option value="">All Types</option>
                {WORK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="d-flex flex-column"
              style={{ flex: "1 1 0", minWidth: "130px" }}
            >
              <label
                className="text-muted fw-bold mb-1"
                style={{ fontSize: "10px" }}
              >
                STATUS
              </label>
              <select
                className="form-select form-select-sm shadow-none"
                value={filters.application_status || ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    application_status: e.target.value,
                  }))
                }
              >
                <option value="">All Statuses</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="d-flex flex-column"
              style={{ flex: "1 1 0", minWidth: "110px" }}
            >
              <label
                className="text-muted fw-bold mb-1"
                style={{ fontSize: "10px" }}
              >
                DEADLINE
              </label>
              <input
                type="date"
                className="form-control form-control-sm shadow-none"
                value={filters.deadline_date || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, deadline_date: e.target.value }))
                }
              />
            </div>
            <div
              className="d-flex flex-column"
              style={{ flex: "1 1 0", minWidth: "110px" }}
            >
              <label
                className="text-muted fw-bold mb-1"
                style={{ fontSize: "10px" }}
              >
                CUSTOM FIELD
              </label>
              <select
                className="form-select form-select-sm shadow-none"
                value={filters.selected_field || ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    selected_field: e.target.value,
                    dynamic_search: "",
                  }))
                }
              >
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {filters.selected_field && (
              <div
                className="d-flex flex-column"
                style={{ flex: "1 1 0", minWidth: "110px" }}
              >
                <label
                  className="text-muted fw-bold mb-1"
                  style={{ fontSize: "10px" }}
                >
                  SEARCH VALUE
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm shadow-none"
                  placeholder="Search..."
                  value={filters.dynamic_search || ""}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      dynamic_search: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            <div className="d-flex gap-1 flex-shrink-0 ms-1">
              <button style={styles.collapseBtn} onClick={handleResetFilters}>
                <RotateCw size={18} />
              </button>
              <button
                title="Create New"
                className="btn btn-primary d-flex align-items-center justify-content-center border-0"
                style={{
                  width: "31px",
                  height: "31px",
                  padding: 0,
                  borderRadius: "5px",
                }}
                onClick={handleCreateNew}
              >
                <Plus size={16} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".xlsx,.xls"
                onChange={handleImport}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableCard}>
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
              style={{ fontSize: "13px", fontWeight: "600", color: "#1d4ed8" }}
            >
              {selectedIds.length} Selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="btn btn-danger btn-sm d-flex align-items-center"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={handleBulkExport}
              className="btn btn-success btn-sm d-flex align-items-center"
            >
              <Download size={14} />
            </button>
          </div>
        )}
        <div style={styles.tableWrapper}>
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
                      records.length > 0 &&
                      selectedIds.length === records.length
                    }
                  />
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Action</th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Sr No.</th>
                <th
                  style={{
                    ...styles.th,
                    ...styles.stickyHeader,
                    cursor: "pointer",
                  }}
                  onClick={() => handleSort("docket_number")}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    Docket Number
                    {sortConfig.key === "docket_number" &&
                      (sortConfig.direction === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      ))}
                  </div>
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Application No
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Application Status
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>
                  Work Type
                </th>
                <th style={{ ...styles.th, ...styles.stickyHeader }}>Status</th>
                <th
                  style={{
                    ...styles.th,
                    ...styles.stickyHeader,
                    cursor: "pointer",
                  }}
                  onClick={() => handleSort("deadline_date")}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    Deadline Date
                    {sortConfig.key === "deadline_date" &&
                      (sortConfig.direction === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      ))}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={styles.tdCenter}>
                    Loading...
                  </td>
                </tr>
              ) : records.length > 0 ? (
                records.map((r, i) => (
                  <tr
                    key={r._id}
                    style={{
                      ...styles.tr,
                      backgroundColor: selectedIds.includes(r._id)
                        ? "#eff6ff"
                        : "transparent",
                    }}
                  >
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r._id)}
                        onChange={() => handleSelectRow(r._id)}
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
                        <span
                          title="Edit"
                          style={styles.viewLink}
                          onClick={() => handleEdit(r)}
                        >
                          <span style={{ color: "#f97316" }}>
                            <Pencil style={{ scale: "0.7" }} />
                          </span>
                        </span>
                        <span
                          title="Replica"
                          style={{ ...styles.viewLink }}
                          onClick={() => handleReplica(r)}
                        >
                          <span style={{ color: "#6b7280" }}>
                            <Copy style={{ scale: "0.7" }} />
                          </span>
                        </span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      {(pagination.currentPage - 1) * 10 + i + 1}
                    </td>
                    <td style={styles.td}>{r.docket_number}</td>
                    <td style={styles.td}>{r.application_no}</td>
                    <td style={styles.td}>{r.docket?.application_status}</td>
                    <td style={styles.td}>{r.worktype}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor:
                            r.status === "ON" ? "#dcfce7" : "#f3f4f6",
                          color: r.status === "ON" ? "#16a34a" : "#6b7280",
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {formatDisplayDate(r.deadline_date)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" style={styles.tdCenter}>
                    No records found.
                  </td>
                </tr>
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
                {(pagination.currentPage - 1) * 10 + 1}-
                {Math.min(pagination.currentPage * 10, pagination.totalRecords)}
              </strong>{" "}
              of <strong>{pagination.totalRecords.toLocaleString()}</strong>{" "}
              records
            </span>
            <div style={styles.paginationBtns}>
              <button
                onClick={() => fetchDeadlines(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                style={{
                  ...styles.pageBtn,
                  opacity: pagination.currentPage <= 1 ? 0.5 : 1,
                }}
              >
                ←
              </button>
              {[...Array(pagination.totalPages)]
                .map((_, i) => (
                  <button
                    key={i}
                    onClick={() => fetchDeadlines(i + 1)}
                    style={{
                      ...styles.pageBtn,
                      ...(pagination.currentPage === i + 1
                        ? styles.pageBtnActive
                        : {}),
                    }}
                  >
                    {i + 1}
                  </button>
                ))
                .slice(
                  Math.max(0, pagination.currentPage - 3),
                  pagination.currentPage + 2,
                )}
              <button
                onClick={() => fetchDeadlines(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                style={{
                  ...styles.pageBtn,
                  opacity:
                    pagination.currentPage >= pagination.totalPages ? 0.5 : 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            {/* Header */}
            <div style={styles.modalHeader}>
              <h5
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                {isEditMode ? "✏️ Edit Deadline" : "📋 Add Deadline"}
              </h5>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {!isEditMode && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept=".xlsx,.xls"
                      onChange={handleImport}
                    />
                    <button
                      type="button"
                      title="Import"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      style={{
                        ...styles.iconBtn,
                        backgroundColor: "#10b981",
                        color: "#fff",
                        border: "none",
                      }}
                    >
                      <Upload size={14} />
                    </button>
                    <button
                      type="button"
                      title="Template"
                      onClick={downloadTemplate}
                      style={{
                        ...styles.iconBtn,
                        backgroundColor: "#6b7280",
                        color: "#fff",
                        border: "none",
                      }}
                    >
                      <FileSpreadsheet size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={handleCloseModal}
                  style={{
                    ...styles.iconBtn,
                    backgroundColor: "#fee2e2",
                    color: "#ef4444",
                    border: "none",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={styles.modalBody}>
              {/* ── BASIC INFO ── */}
              <div style={{ marginBottom: "20px" }}>
                <h6 style={styles.sectionLabel}>Basic Information</h6>
                <div style={styles.grid2}>
                  {/* Docket No */}
                  <div style={{ position: "relative" }}>
                    <label style={fl}>Docket No. *</label>
                    <input
                      style={{
                        ...fi,
                        borderColor: formData.docket_id ? "#22c55e" : "#e5e7eb",
                      }}
                      type="text"
                      placeholder="Enter docket number"
                      value={formData.docket_number}
                      onChange={(e) => handleDocketSearch(e.target.value)}
                      onFocus={() => {
                        if (
                          formData.docket_number.length > 1 &&
                          !formData.docket_id
                        )
                          setShowSuggestions(true);
                      }}
                      onBlur={() =>
                        setTimeout(() => setShowSuggestions(false), 200)
                      }
                      required
                      autoComplete="off"
                    />
                    {formData.docket_number && !formData.docket_id && (
                      <small style={{ color: "#f59e0b", fontSize: "11px" }}>
                        ⚠ Select from dropdown
                      </small>
                    )}
                    {formData.docket_id && (
                      <small style={{ color: "#22c55e", fontSize: "11px" }}>
                        ✓ Docket selected
                      </small>
                    )}
                    {showSuggestions &&
                      formData.docket_number.length > 1 &&
                      !formData.docket_id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            zIndex: 1000,
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          {docketSuggestions.length > 0 ? (
                            docketSuggestions.map((d, i) => (
                              <div
                                key={i}
                                onMouseDown={() => selectDocket(d)}
                                style={{
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f3f4f6",
                                  fontSize: "13px",
                                }}
                              >
                                <strong>{d.docket_no}</strong>
                                <br />
                                <small style={{ color: "#6b7280" }}>
                                  {d.title
                                    ? d.title.substring(0, 50) + "..."
                                    : "No title"}
                                </small>
                              </div>
                            ))
                          ) : (
                            <div
                              style={{
                                padding: "14px",
                                textAlign: "center",
                                color: "#ef4444",
                                fontSize: "13px",
                              }}
                            >
                              No match found
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Correspondence App No */}
                  <div>
                    <label style={fl}>Correspondence App. No.</label>
                    <input
                      style={fi}
                      type="text"
                      name="application_no"
                      placeholder="Enter correspondence app. no."
                      value={formData.application_no}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  {/* Application No */}
                  <div>
                    <label style={fl}>Application No.</label>
                    <input
                      style={fi}
                      type="text"
                      name="app_number"
                      placeholder="e.g., US12345678"
                      value={formData.app_number}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Work Type */}
                  <div>
                    <label style={fl}>Work Type *</label>
                    <select
                      name="worktype"
                      value={formData.worktype}
                      onChange={handleWorktypeChange}
                      style={fs}
                    >
                      <option value="">Select Service</option>
                      {serviceFeesList.map((sf) => (
                        <option key={sf._id} value={sf.service_name}>
                          {sf.service_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* In Matter */}
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={fl}>In Matter</label>
                    <input
                      style={fi}
                      type="text"
                      name="in_matter"
                      placeholder="Describe the matter or subject"
                      value={formData.in_matter}
                      onChange={handleInputChange}
                    />
                  </div>

                  {/* Deadline */}
                  <div>
                    <label style={fl}>Deadline *</label>
                    <input
                      style={fi}
                      type="date"
                      name="deadline_date"
                      value={formData.deadline_date}
                      onChange={handleDeadlineDateChange}
                      required
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label style={fl}>Status</label>
                    <select
                      style={fs}
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      <option value="ON">ON</option>
                      <option value="OFF">OFF</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── REMAINDER DATES ── */}
              {formData.deadline_date && (
                <div style={{ marginBottom: "20px" }}>
                  <h6 style={styles.sectionLabel}>
                    Remainder Dates{" "}
                    <small style={{ fontWeight: 400, color: "#9ca3af" }}>
                      (Auto-calculated)
                    </small>
                  </h6>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: "10px",
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n}>
                        <label style={{ ...fl, color: "#9ca3af" }}>R{n}</label>
                        <input
                          type="date"
                          style={{ ...fi, fontSize: "11px" }}
                          name={`remainder${n}`}
                          value={formData[`remainder${n}`]}
                          onChange={handleInputChange}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ASSIGNMENT SECTION (Task fields) ── */}
              <CollapsibleSection
                title="Assignment"
                icon={<Users size={15} />}
                defaultOpen={true}
                accent="#ff6c2f"
              >
                {/* Toggle: also create task */}
                {!isEditMode && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "16px",
                      padding: "10px 14px",
                      backgroundColor: "#eff6ff",
                      borderRadius: "8px",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    <input
                      type="checkbox"
                      id="createTask"
                      checked={formData.createTask}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          createTask: e.target.checked,
                        }))
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    <label
                      htmlFor="createTask"
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1d4ed8",
                        cursor: "pointer",
                        margin: 0,
                      }}
                    >
                      Also create a linked Task with this deadline
                    </label>
                  </div>
                )}

                <div style={styles.grid2}>
                  <div>
                    <label style={fl}>Preparation (Prepared By)</label>
                    <select
                      style={fs}
                      name="prepared_by"
                      value={formData.prepared_by}
                      onChange={handleInputChange}
                      required={formData.createTask && !isEditMode}
                    >
                      <option value="">Select person</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      Person responsible for preparation
                    </small>
                  </div>
                  <div>
                    <label style={fl}>Review (Review By)</label>
                    <select
                      style={fs}
                      name="review_by"
                      value={formData.review_by}
                      onChange={handleInputChange}
                    >
                      <option value="">Select person</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      Person responsible for review
                    </small>
                  </div>
                  <div>
                    <label style={fl}>Final Review By</label>
                    <select
                      style={fs}
                      name="final_review_by"
                      value={formData.final_review_by}
                      onChange={handleInputChange}
                    >
                      <option value="">Select person</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fl}>Territory Manager</label>
                    <select
                      style={fs}
                      name="territory_manager"
                      value={formData.territory_manager}
                      onChange={handleInputChange}
                    >
                      <option value="">Select person</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fl}>Internal Deadline</label>
                    <input
                      type="date"
                      style={fi}
                      name="internal_deadline"
                      value={formData.internal_deadline}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label style={fl}>Official Deadline</label>
                    <input
                      type="date"
                      style={fi}
                      name="official_deadline"
                      value={
                        formData.official_deadline || formData.deadline_date
                      }
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* ── FEE SECTION ── */}
              <CollapsibleSection
                title="Fee"
                icon={<DollarSign size={15} />}
                defaultOpen={true}
                accent="#ff6c2f"
              >
                <div style={styles.grid2}>
                  <div>
                    <label style={fl}>Currency</label>
                    <select
                      style={fs}
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      Select currency for fee calculation
                    </small>
                  </div>
                  <div>
                    <label style={fl}>Official Fee</label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          padding: "8px 10px",
                          backgroundColor: "#f9fafb",
                          color: "#6b7280",
                          fontSize: "13px",
                          borderRight: "1px solid #e5e7eb",
                        }}
                      >
                        {formData.currency === "USD"
                          ? "$"
                          : formData.currency === "EUR"
                            ? "€"
                            : "₹"}
                      </span>
                      <input
                        type="number"
                        style={{
                          ...fi,
                          border: "none",
                          borderRadius: 0,
                          flex: 1,
                        }}
                        name="officialfee"
                        placeholder="0.00"
                        value={formData.officialfee}
                        onChange={handleInputChange}
                      />
                    </div>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      Government or official fee
                    </small>
                  </div>

                  <div>
                    <label style={fl}>Our Fee (anovIP)</label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          padding: "8px 10px",
                          backgroundColor: "#f9fafb",
                          color: "#6b7280",
                          fontSize: "13px",
                          borderRight: "1px solid #e5e7eb",
                        }}
                      >
                        {formData.currency === "USD"
                          ? "$"
                          : formData.currency === "EUR"
                            ? "€"
                            : "₹"}
                      </span>
                      <input
                        type="number"
                        style={{
                          ...fi,
                          border: "none",
                          borderRadius: 0,
                          flex: 1,
                        }}
                        name="anovipfee"
                        placeholder="0.00"
                        value={formData.anovipfee}
                        onChange={handleInputChange}
                      />
                    </div>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      Our service fee
                    </small>
                  </div>
                </div>
                {/* Total Fee */}
                <div
                  style={{
                    marginTop: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "8px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "#374151",
                    }}
                  >
                    Total Fee:
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "16px",
                      color: "#059669",
                    }}
                  >
                    {formData.currency === "USD"
                      ? "$"
                      : formData.currency === "EUR"
                        ? "€"
                        : "₹"}
                    {Number(formData.fee || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </CollapsibleSection>

              {/* ── DOCUMENTS SECTION ── */}
              <CollapsibleSection
                title="Documents"
                icon={<Paperclip size={15} />}
                defaultOpen={true}
                accent="#ff6c2f"
              >
                <div style={styles.grid2}>
                  {/* Document Type selector */}
                  <div>
                    <label style={fl}>Document Type *</label>
                    <select
                      value={pendingDocType}
                      onChange={(e) => setPendingDocType(e.target.value)}
                      style={{
                        ...fs,
                        borderColor: pendingDocType ? "#7c3aed" : "#e5e7eb",
                        backgroundColor: pendingDocType ? "#faf5ff" : "#fff",
                      }}
                    >
                      <option value="">-- Select Type --</option>
                      <option value="Input">Input</option>
                      <option value="Internal">Internal</option>
                      <option value="Output">Output</option>
                    </select>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      Select type before attaching files
                    </small>
                  </div>

                  {/* Attach Files button */}
                  <div>
                    <label style={fl}>Attach Files</label>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => {
                        if (!pendingDocType) {
                          toast.error("Please select a Document Type first!");
                          return;
                        }
                        setIsUppyModalOpen(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: "9px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        backgroundColor: isUploading ? "#e5e7eb" : "#f5f3ff",
                        cursor: isUploading ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        color: "#7c3aed",
                        fontWeight: 500,
                      }}
                    >
                      <Paperclip size={14} />
                      {isUploading ? "Uploading..." : "Attach Files"}
                    </button>
                    <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                      PDF, DOC, DOCX, JPG, PNG (Max 5GB)
                    </small>
                  </div>
                </div>

                {/* Newly uploaded files */}
                {newlyUploadedFiles.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <small
                      style={{
                        color: "#059669",
                        fontWeight: 600,
                        fontSize: "12px",
                      }}
                    >
                      ✓ {newlyUploadedFiles.length} file(s) ready to save:
                    </small>
                    {renderFileList(newlyUploadedFiles)}
                  </div>
                )}
              </CollapsibleSection>
              <div style={{ marginBottom: "20px" }}>
                <h6 style={styles.sectionLabel}>Remarks & Notifications</h6>
                <div style={{ marginBottom: "12px" }}>
                  <label style={fl}>Remarks</label>
                  <textarea
                    style={{ ...fi, height: "70px", resize: "vertical" }}
                    name="remarks"
                    placeholder="Add any additional notes or remarks"
                    value={formData.remarks}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label style={fl}>Email Addresses for Reminders</label>
                  {formData.emails.map((email, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <input
                        type="email"
                        style={fi}
                        placeholder="Enter email address"
                        value={email}
                        onChange={(e) => handleEmailChange(idx, e.target.value)}
                      />
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => removeEmail(idx)}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "#fee2e2",
                            color: "#ef4444",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEmail}
                    style={{
                      fontSize: "12px",
                      color: "#3b82f6",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    + Add Another Email
                  </button>
                </div>
              </div>

              {/* ── FOOTER BUTTONS ── */}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  paddingTop: "16px",
                  borderTop: "1px solid #f3f4f6",
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: "10px 24px",
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✕ Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.docket_id && !isEditMode}
                  style={{
                    padding: "10px 28px",
                    backgroundColor:
                      !formData.docket_id && !isEditMode
                        ? "#d1d5db"
                        : "#3b82f6",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor:
                      !formData.docket_id && !isEditMode
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  💾 {isEditMode ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UPPY DASHBOARD MODAL ── */}
      <DashboardModal
        uppy={uppy}
        open={isUppyModalOpen}
        onRequestClose={() => {
          uppy.cancelAll();
          setIsUppyModalOpen(false);
        }}
        closeModalOnClickOutside={false}
        theme="light"
        note={`Document Type: ${pendingDocType || "Not selected"}`}
      />

      {/* View Detail Modal */}
      {isDetailView && selectedRecord && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold">Deadline Details</h5>
                <button
                  className="btn-close"
                  onClick={() => setIsDetailView(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="row g-3">
                  <div className="col-md-4">
                    <strong>Docket Number:</strong>
                    <br />
                    {selectedRecord.docket_number}
                  </div>
                  <div className="col-md-4">
                    <strong>Application No:</strong>
                    <br />
                    {selectedRecord.application_no}
                  </div>
                  <div className="col-md-4">
                    <strong>App Number:</strong>
                    <br />
                    {selectedRecord.app_number || "-"}
                  </div>
                  <div className="col-md-4">
                    <strong>Action:</strong>
                    <br />
                    {selectedRecord.worktype}
                  </div>
                  <div className="col-md-4">
                    <strong>Deadline Date:</strong>
                    <br />
                    {formatDisplayDate(selectedRecord.deadline_date)}
                  </div>
                  <div className="col-md-4">
                    <strong>Status:</strong>
                    <br />
                    <span
                      className={`badge ${selectedRecord.status === "ON" ? "bg-success" : "bg-secondary"}`}
                    >
                      {selectedRecord.status}
                    </span>
                  </div>
                  <div className="col-md-12 mt-3">
                    <strong>Remarks:</strong>
                    <br />
                    {selectedRecord.remarks || "-"}
                  </div>
                  <div className="col-md-12 mt-2">
                    <strong>Emails:</strong>
                    <br />
                    {selectedRecord.emails?.join(", ") || "-"}
                  </div>
                  <div className="col-12">
                    <hr />
                  </div>
                  <div className="col-12">
                    <h6 className="fw-bold">Remainder Dates</h6>
                  </div>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div className="col-md-2 col-4" key={n}>
                      <small className="text-muted d-block">R{n}</small>
                      {formatDisplayDate(selectedRecord[`remainder${n}`])}
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer border-top">
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => {
                    handleEdit(selectedRecord);
                    setIsDetailView(false);
                  }}
                >
                  <Edit size={14} className="me-1" /> Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    handleDelete(selectedRecord._id);
                    setIsDetailView(false);
                  }}
                >
                  <Trash2 size={14} className="me-1" /> Delete
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsDetailView(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
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
    boxShadow: "0 2px 2px -1px rgba(0,0,0,0.1)",
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
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "500",
  },
  viewLink: {
    color: "#111827",
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
  collapseBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "transparent",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    color: "#6b7280",
    cursor: "pointer",
    fontWeight: "500",
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 1060,
    paddingTop: "20px",
    overflowY: "auto",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "14px",
    width: "95%",
    maxWidth: "760px",
    marginBottom: "30px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  modalBody: { padding: "24px", overflowY: "auto" },
  sectionLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#374151",
    margin: "0 0 12px 0",
    paddingBottom: "8px",
    borderBottom: "2px solid #f3f4f6",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  iconBtn: {
    width: "32px",
    height: "32px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default DeadlinePage;
