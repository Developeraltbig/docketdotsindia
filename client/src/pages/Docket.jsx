import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  useLocation,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import {
  Eye,
  Upload,
  Download,
  Paperclip,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Plus,
  Copy,
  Pencil,
  TimerResetIcon,
  RotateCw,
  Activity,
} from "lucide-react";
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

const COUNTRIES = [
  { code: "[AD]", name: "Andorra" },
  { code: "[AE]", name: "UAE (United Arab Emirates)" },
  { code: "[AF]", name: "Afghanistan" },
  { code: "[AG]", name: "Antigua and Barbuda" },
  { code: "[AI]", name: "Anguilla" },
  { code: "[AL]", name: "Albania" },
  { code: "[AM]", name: "Armenia" },
  { code: "[IN]", name: "India" },
  { code: "[US]", name: "USA (United States of America)" },
  { code: "[GB]", name: "Great Britain" },
];

const FileItem = ({ file, docketId, allowDelete, onDownload, onDelete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);

    const checkFile = async () => {
      try {
        await axios.get(
          `/api/dockets/download-url?fileKey=${encodeURIComponent(file.key)}`,
        );
      } catch (error) {
        if (error.response && error.response.status === 404) {
          setIsVisible(false);
        }
      }
    };

    if (file.key) checkFile();
  }, [file.key]);

  if (!isVisible) return null;

  return (
    <div
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

      {/* ADD THIS BADGE */}
      {file.documentType && (
        <span
          style={{
            fontSize: "10px",
            padding: "2px 6px",
            backgroundColor: "#e5e7eb",
            borderRadius: "4px",
            color: "#4b5563",
          }}
        >
          {file.documentType}
        </span>
      )}
      {/* ... rest of your JSX ... */}
      <button
        type="button"
        onClick={() => onDownload(file.key, file.filename)}
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
      {allowDelete && docketId && (
        <button
          type="button"
          onClick={() => onDelete(docketId, file.key)}
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
  );
};
const DocketPage = () => {
  const [searchParams, setSearchParams] = useSearchParams(); // Add this hook

  // Add these new states
  const [showStatsRow, setShowStatsRow] = useState(true);
  const [statsCounts, setStatsCounts] = useState({
    total: 0,
    granted: 0,
    pending: 0,
    inactive: 0,
  });
  const [viewMode, setViewMode] = useState("dashboard");
  const [detailTab, setDetailTab] = useState("view");
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 10;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [clients, setClients] = React.useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef(null);
  const [records, setRecords] = useState([]);
  const { updateStats } = useAuthStore();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState("identification");
  const [foreignAssociates, setForeignAssociates] = useState([]);
  const [serviceFeesList, setServiceFeesList] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const initialFormState = {
    status: "docket",
    instruction_date: "",
    client_id: "",
    docket_no: "",
    service_name: "",
    client_ref: "",
    currency: "",
    anovipfee: "",
    associatefee: "",
    officialfee: "",
    fee: "",
    spoc_name: "",
    phone_no: "",
    firm_name: "",
    country: "",
    email: "",
    address: "",
    application_status: "",
    foreign_associate_id: "",
    due_date: "",
    application_type: "",
    filling_country: "",
    filling_date: "",
    application_no: "",
    applicant_type: "",
    title: "",
    pct_application_date: "", // Add this
    field_of_invention: "", // Add this
    application_number: "",
    existing_file_image: "",
  };
  const [formData, setFormData] = useState(initialFormState);

  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    docket_no: "",
    service_name: "",
    filling_country: "",
    application_status: "",
    application_type: "",
    field_selector: "",
    dynamic_search: "",
  });

  const handleResetFilters = () => {
    const cleanPath = window.location.origin + location.pathname;
    window.location.href = cleanPath;
  };

  const [timelineDocket, setTimelineDocket] = useState(null);

  const getTimelineStatus = (currentSubStatus, stepValue) => {
    const statusMap = { "": 0, Prepared: 1, Reviewed: 2, "Final Reviewed": 3 };
    const currentVal = statusMap[currentSubStatus || ""] || 0;
    const stepVal = statusMap[stepValue];
    return currentVal >= stepVal ? "completed" : "pending";
  };

  // --- UPPY STATE ---
  const [isUppyModalOpen, setIsUppyModalOpen] = useState(false);
  const [newlyUploadedFiles, setNewlyUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDocType, setPendingDocType] = useState(""); // Empty by default // <--- ADD THIS

  // --- INITIALIZE UPPY ---
  const uppy = React.useMemo(() => {
    const uppyInstance = new Uppy({
      id: "docket-uploader",
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: 100,
        maxTotalFileSize: 5 * 1024 * 1024 * 1024, // 5 GB,
      },
    });

    uppyInstance.use(AwsS3Multipart, {
      limit: 4,
      // 1. Multipart Start
      async createMultipartUpload(file) {
        const fileType = file.type || "application/octet-stream";
        const res = await axios.post("/api/dockets/s3/multipart/start", {
          filename: file.name,
          contentType: fileType,
        });
        file.meta.key = res.data.key;
        return { uploadId: res.data.uploadId, key: res.data.key };
      },
      // 2. Multipart Sign
      async signPart(file, { uploadId, key, partNumber }) {
        const res = await axios.post("/api/dockets/s3/multipart/sign-part", {
          uploadId,
          key,
          partNumber,
        });
        return { url: res.data.url };
      },
      // 3. Multipart Complete
      async completeMultipartUpload(file, { uploadId, key, parts }) {
        const res = await axios.post("/api/dockets/s3/multipart/complete", {
          uploadId,
          key,
          parts,
        });
        return { location: res.data.location };
      },
      // 4. Multipart Abort
      async abortMultipartUpload(file, { uploadId, key }) {
        await axios.post("/api/dockets/s3/multipart/abort", { uploadId, key });
      },
      // 5. Simple Upload (For small files like .docx) - THIS WAS THE ISSUE
      async getUploadParameters(file) {
        // Fix: Explicitly handle empty file types
        const fileType =
          file.type && file.type.length > 0
            ? file.type
            : "application/octet-stream";

        const res = await axios.post("/api/dockets/s3/presigned-url", {
          filename: file.name,
          contentType: fileType,
        });

        // Store key so we can save it to DB later
        file.meta.key = res.data.key;

        return {
          method: "PUT",
          url: res.data.uploadUrl,
          headers: {
            "Content-Type": fileType, // Header must match signature
          },
        };
      },
    });

    return uppyInstance;
  }, []);

  const fetchServiceFees = async () => {
    try {
      const res = await axios.get(`/api/service-fees/active`);
      setServiceFeesList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch service fees", err);
    }
  };

  // Add this function to fetch associates
  const fetchForeignAssociates = async () => {
    try {
      // Fetch all active associates (limit set high to get all)
      const res = await axios.get(
        `/api/foreign-associates?limit=1000&status=active`,
      );
      setForeignAssociates(res.data.associates || []);
    } catch (err) {
      console.error("Failed to fetch associates", err);
    }
  };

  const fetchStatsCounts = async () => {
    try {
      const res = await axios.get("/api/dockets/status-counts");
      setStatsCounts(res.data);
    } catch (err) {
      console.error("Failed to fetch stats counts", err);
    }
  };

  const fetchRelatedRecords = async (docketNo, docketId) => {
    try {
      const [tasksRes, deadlinesRes, invoicesRes] = await Promise.allSettled([
        axios.get(
          `/api/tasks?docket_no=${encodeURIComponent(docketNo)}&limit=100`,
        ),
        axios.get(
          `/api/deadlines?docket_number=${encodeURIComponent(docketNo)}&limit=100`,
        ),
        axios.get(`/api/invoices?limit=100`),
      ]);
      if (tasksRes.status === "fulfilled") {
        setRelatedTasks(tasksRes.value.data.tasks || []);
      }
      if (deadlinesRes.status === "fulfilled") {
        setRelatedDeadlines(deadlinesRes.value.data.deadlines || []);
      }
      if (invoicesRes.status === "fulfilled") {
        const allInvoices = invoicesRes.value.data.invoices || [];
        setRelatedInvoices(
          allInvoices.filter((inv) => inv.docket_no === docketNo),
        );
      }
    } catch (err) {
      console.error("Failed to fetch related records", err);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchStatsCounts();
    fetchForeignAssociates();
    fetchServiceFees();
  }, []);

  useEffect(() => {
    const statusParam = searchParams.get("status");

    if (statusParam) {
      // 1. Collapse the Stats Row
      setShowStatsRow(false);

      // 2. Set the table filter automatically
      // 'all' clears the filter, otherwise set specific status
      setFilters((prev) => ({
        ...prev,
        application_status: statusParam === "all" ? "" : statusParam,
      }));

      // 3. Reset page to 1
      setCurrentPage(1);
    } else {
      // If no param (e.g. just navigated to /docket), show stats
      setShowStatsRow(true);
    }
  }, [searchParams]);

  // ... inside DocketPage component ...

  // Handle Uppy Events
  // Handle Uppy Events
  useEffect(() => {
    // 1. When upload starts
    const handleUploadStart = () => {
      setIsUploading(true);
    };

    // 2. When upload completes (success or failure)
    const handleComplete = (result) => {
      setIsUploading(false); // Enable button again

      if (result.successful.length > 0) {
        const uploaded = result.successful.map((file) => ({
          key: file.meta.key,
          filename: file.name,
          mimetype: file.meta.type,
          size: file.size,
          documentType: pendingDocType, // <--- Assigned here
        }));

        setNewlyUploadedFiles((prev) => [...prev, ...uploaded]);
        toast.success("Files uploaded!");
        setIsUppyModalOpen(false);
        uppy.cancelAll();
      }
    };

    // 3. If upload is cancelled
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
  }, [uppy, pendingDocType]); // <--- Dependency array includes pendingDocType// <--- ADD pendingDocType to dependency array

  // Cleanup
  useEffect(() => {
    return () => uppy.close();
  }, [uppy]);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestions1, setSuggestions1] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchDockets = async () => {
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
      const res = await axios.get(`/api/dockets?${params.toString()}`);

      const docketsData = res.data.dockets || res.data.data || [];

      setRecords(docketsData);

      // Handle multiple possible response structures
      const total =
        res.data.total ||
        res.data.totalRecords ||
        res.data.count ||
        res.data.pagination?.total ||
        docketsData.length;

      setTotalRecords(total);
    } catch (err) {
      if (!import.meta.env.PROD) {
        console.error("Error fetching dockets", err);
      }
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get(`/api/auth/clients`);
      setClients(res.data);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Failed to fetch clients", err);
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    }
  };

  useEffect(() => {
    if (location.state?.showDetail && location.state?.viewDocket) {
      setSelectedRecord(location.state.viewDocket);
      setViewMode("detail");
      setDetailTab("view");
      setActiveDetailTab("identification");
      setCameFromExternal(true);
      fetchRelatedRecords(
        location.state.viewDocket.docket_no,
        location.state.viewDocket._id,
      );
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    fetchDockets();
  }, [filters, currentPage, sortConfig]);

  // Add this useEffect after your other useEffects

  // Track if user came from external page (Dashboard)
  const [cameFromExternal, setCameFromExternal] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("identification");
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [relatedDeadlines, setRelatedDeadlines] = useState([]);
  const [relatedInvoices, setRelatedInvoices] = useState([]);

  useEffect(() => {
    if (location.state?.showDetail && location.state?.viewDocket) {
      setSelectedRecord(location.state.viewDocket);
      setViewMode("detail");
      setDetailTab("view");
      setCameFromExternal(true); // User came from Dashboard
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    // Only push history state for internal navigation (not from Dashboard)
    if (viewMode === "detail" && !cameFromExternal) {
      window.history.pushState({ viewMode: "detail" }, "");
    }
  }, [viewMode, cameFromExternal]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (viewMode === "detail") {
        if (cameFromExternal) {
          // Came from Dashboard - go back to Dashboard
          navigate(-1);
        } else {
          // Opened from DocketPage table - go back to list
          setViewMode("dashboard");
          setSelectedRecord(null);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [viewMode, cameFromExternal, navigate]);

  useEffect(() => {
    const anovip = parseFloat(formData.anovipfee) || 0;
    const associate = parseFloat(formData.associatefee) || 0;
    const official = parseFloat(formData.officialfee) || 0;
    setFormData((prev) => ({
      ...prev,
      fee: Math.round(anovip + associate + official),
    }));
  }, [formData.anovipfee, formData.associatefee, formData.officialfee]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // When applicant_type changes, recalculate official fee from selected service
    if (name === "applicant_type") {
      const service = serviceFeesList.find(
        (s) => s.service_name === formData.service_name,
      );
      setFormData((prev) => ({
        ...prev,
        applicant_type: value,
        officialfee: service
          ? getOfficialFee(service, value)
          : prev.officialfee,
      }));
      return;
    }

    setFormData({ ...formData, [name]: value });

    if (name === "country" || name === "filling_country") {
      const query = value.toUpperCase().trim();
      const matches = COUNTRIES.filter(
        (c) =>
          c.name.toUpperCase().includes(query) ||
          c.code.toUpperCase().includes(query),
      );
      if (name === "country") setSuggestions1(query ? matches : []);
      else setSuggestions(query ? matches : []);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setCurrentPage(1);
  };

  const handleFileChange = (e) => {
    setSelectedFiles(e.target.files);
  };

  const selectSuggestion = (fieldName, item) => {
    setFormData({ ...formData, [fieldName]: `${item.code} ${item.name}` });
    setSuggestions([]);
    setSuggestions1([]);
  };

  // Helper: pick correct official fee based on applicant type
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
  const handleServiceChange = (e) => {
    const selectedName = e.target.value;
    const service = serviceFeesList.find(
      (s) => s.service_name === selectedName,
    );

    setFormData((prev) => ({
      ...prev,
      service_name: selectedName,
      officialfee: service ? getOfficialFee(service, prev.applicant_type) : "",
      associatefee: "", // no foreign_associate_fee in new schema
      anovipfee: service ? service.our_fee : "",
    }));
  };

  // Same handler for the detail/edit view (selectedRecord)
  const handleServiceChangeEdit = (e) => {
    const selectedName = e.target.value;
    const service = serviceFeesList.find(
      (s) => s.service_name === selectedName,
    );

    setSelectedRecord((prev) => ({
      ...prev,
      service_name: selectedName,
      officialfee: service ? getOfficialFee(service, prev.applicant_type) : "",
      associatefee: "",
      anovipfee: service ? service.our_fee : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = {
      ...formData,
      applicants: JSON.stringify(formData.applicants),
      inventors: JSON.stringify(formData.inventors),
      priorities: JSON.stringify(formData.priorities),
    };

    try {
      if (formData._id) {
        // UPDATE
        // ✅ This part was correct, but ensure backend receives it
        const updatePayload = { ...payload, newFiles: newlyUploadedFiles };
        const res = await axios.put(
          `/api/dockets/${formData._id}`,
          updatePayload,
        );

        console.log(res);

        setRecords((prev) =>
          prev.map((r) => (r._id === formData._id ? res.data.data : r)),
        );
        setSelectedRecord(res.data.data);
        setFormData((prev) => ({ ...prev, files: res.data.data.files }));

        toast.success("Updated successfully");
      } else {
        // CREATE
        payload.files = newlyUploadedFiles;
        const res = await axios.post(`/api/dockets`, payload);
        console.log(res);

        setRecords((prev) => [res.data.data, ...prev]);
        setTotalRecords((prev) => prev + 1);
        updateStats("dockets", 1);
        toast.success("Created successfully");
      }

      setShowModal(false);
      // ✅ FIX: Clear uploaded files here
      setNewlyUploadedFiles([]);
      setSelectedFiles([]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error saving record");
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  const handleReplica = (record) => {
    const { _id, createdAt, updatedAt, __v, ...replicaData } = record;

    // Ensure date fields aren't literal nulls before setting state
    const cleanedData = { ...replicaData };
    if (cleanedData.pct_application_date === null)
      cleanedData.pct_application_date = "";
    if (cleanedData.due_date === null) cleanedData.due_date = "";
    if (cleanedData.filling_date === null) cleanedData.filling_date = "";
    if (cleanedData.instruction_date === null)
      cleanedData.instruction_date = "";

    setFormData({
      ...cleanedData,
      docket_no: replicaData.docket_no + "_copy",
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setDeleteTaskId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/dockets/${deleteTaskId}`);
      // Update local state instead of fetching
      setRecords((prev) => prev.filter((r) => r._id !== deleteTaskId));
      setTotalRecords((prev) => prev - 1);
      updateStats("dockets", -1);
      toast.success("Deleted successfully");
      setViewMode("dashboard");
      setSelectedRecord(null);
    } catch (err) {
      if (!import.meta.env.PROD) {
        console.error("Delete failed", err);
      }
      toast.error(
        err?.response?.data?.message || "Some occurred. Please try again.",
      );
    } finally {
      setShowDeleteModal(false);
      setDeleteTaskId(null);
    }
  };

  // 1. Handle Client Selection
  const handleClientChange = (e) => {
    const selectedId = e.target.value;

    // Find the full client object from your state
    const client = clients.find((c) => c._id === selectedId);

    setFormData({
      ...formData,
      client_id: selectedId,
      // Auto-fill fields if client exists, otherwise reset or keep empty
      spoc_name: client ? client.name : "",
      phone_no: client ? client.phone_no || "" : "",
      firm_name: client ? client.firm_name || "" : "",
      country: client ? client.country || "" : "",
      email: client ? client.email || "" : "",
      address: client ? client.address || "" : "",
    });
  };

  const handleAssociateChange = (e) => {
    const selectedId = e.target.value;
    const assoc = foreignAssociates.find((a) => a._id === selectedId);

    setFormData((prev) => ({
      ...prev,
      foreign_associate_id: selectedId,
      associate_ref_no: assoc ? assoc.reference_format : "",
      associate_firm_name: assoc ? assoc.firm_name : "",
      associate_country: assoc ? assoc.country : "",
      associate_spoc_name: assoc ? assoc.contact_person : "",
      associate_email: assoc ? assoc.email : "",
      associate_phone_no: assoc ? assoc.phone : "",
      associate_address: assoc ? assoc.notes : "",
    }));
  };

  const handleAssociateChangeEdit = (e) => {
    const selectedId = e.target.value;
    const assoc = foreignAssociates.find((a) => a._id === selectedId);

    setSelectedRecord((prev) => ({
      ...prev,
      foreign_associate_id: selectedId,
      associate_ref_no: assoc ? assoc.reference_format : "",
      associate_firm_name: assoc ? assoc.firm_name : "",
      associate_country: assoc ? assoc.country : "",
      associate_spoc_name: assoc ? assoc.contact_person : "",
      associate_email: assoc ? assoc.email : "",
      associate_phone_no: assoc ? assoc.phone : "",
      associate_address: assoc ? assoc.notes : "",
    }));
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

  const formatDateDetail = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "--";

    return date.toLocaleString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const handleDownloadFile = async (fileKey, filename) => {
    try {
      const res = await axios.get(
        `/api/dockets/download-url?fileKey=${encodeURIComponent(fileKey)}`,
      );
      const link = document.createElement("a");
      link.href = res.data.downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error("File not found or access denied");
    }
  };

  const handleDeleteFile = async (docketId, fileIdOrKey) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      const res = await axios.delete(
        `/api/dockets/${docketId}/file/${encodeURIComponent(fileIdOrKey)}`,
      );
      if (selectedRecord && selectedRecord._id === docketId) {
        setSelectedRecord(res.data.data);
      }
      setRecords((prev) =>
        prev.map((r) => (r._id === docketId ? res.data.data : r)),
      );
      toast.success("File deleted");
    } catch (err) {
      toast.error("Failed to delete file");
    }
  };

  // --- UPDATED RENDER FUNCTION (Uses FileItem) ---
  // Must be inside DocketPage to access handlers
  const renderFileList = (files, allowDelete = false, docketId = null) => {
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
        {files.map((file) => (
          // ✅ FIX: Use file.key or file._id as key
          <FileItem
            key={file.key || file._id}
            file={file}
            docketId={docketId}
            allowDelete={allowDelete}
            onDownload={handleDownloadFile}
            onDelete={handleDeleteFile}
          />
        ))}
      </div>
    );
  };

  // Add after confirmDelete function (around line 240)
  const handleExport = (exportAll = false) => {
    const dataToExport =
      selectedIds.length > 0
        ? records.filter((r) => selectedIds.includes(r._id))
        : records;

    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = dataToExport.map((r, index) => {
      // 1. Find the client object in the clients array that matches the ID in the record
      const client = clients.find((c) => c._id === r.client_id);

      // 2. Use the client name if found, otherwise fallback to the ID or empty string
      const clientDisplayName = client ? client.name : r.client_id || "";

      return {
        "Sr No": index + 1,
        "Instruction Date": r.instruction_date
          ? new Date(r.instruction_date).toLocaleDateString()
          : "",
        "anovIP Ref No": r.docket_no || "",
        "Client Name": clientDisplayName, // Updated this line
        Service: r.service_name || "",
        "Client Ref No": r.client_ref || "",
        Currency: r.currency || "",
        "AnovIP Fee": r.anovipfee || "",
        "Associate Fee": r.associatefee || "",
        "Official Fee": r.officialfee || "",
        "Total Fee": r.fee || "",
        "SPOC Name": r.spoc_name || "",
        "Phone No": r.phone_no || "",
        "Firm Name": r.firm_name || "",
        Country: r.country || "",
        Email: r.email || "",
        Address: r.address || "",
        "Application Status": r.application_status || "",
        "Due Date": r.due_date ? new Date(r.due_date).toLocaleDateString() : "",
        "Application Type": r.application_type || "",
        "Filing Country": r.filling_country || "",
        "Filing Date": r.filling_date
          ? new Date(r.filling_date).toLocaleDateString()
          : "",
        "Application No": r.application_no || "",
        "Applicant Type": r.applicant_type || "",
        Title: r.title || "",
        "Associate Ref No": r.associate_ref_no || "",
        "Associate SPOC Name": r.associate_spoc_name || "",
        "Associate Phone No": r.associate_phone_no || "",
        "Associate Firm Name": r.associate_firm_name || "",
        "Associate Country": r.associate_country || "",
        "Associate Email": r.associate_email || "",
        "Associate Address": r.associate_address || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dockets");

    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(
      wb,
      `dockets_export_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(`Exported ${exportData.length} records successfully`);
  };

  // Add after handleExport function
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
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast.error("No data found in the file");
            setImporting(false);
            return;
          }

          // Map Excel columns to API fields
          const mappedData = jsonData.map((row) => ({
            instruction_date: parseExcelDate(row["Instruction Date"]),
            docket_no: row["anovIP Ref No"] || row["Docket No"] || "",
            client_name: row["Client Name"] || "", // ✅ For lookup
            client_email: row["Client Email"] || "", // ✅ Alternative lookup
            service_name: row["Service"] || "",
            client_ref: row["Client Ref No"] || "",
            currency: row["Currency"] || "",
            anovipfee: row["AnovIP Fee"] || "",
            associatefee: row["Associate Fee"] || "",
            officialfee: row["Official Fee"] || "",
            fee: row["Total Fee"] || "",
            spoc_name: row["SPOC Name"] || "",
            phone_no: row["Phone No"] || "",
            firm_name: row["Firm Name"] || "",
            country: row["Country"] || "",
            email: row["Email"] || "",
            address: row["Address"] || "",
            application_status: row["Application Status"] || "",
            due_date: parseExcelDate(row["Due Date"]),
            application_type: row["Application Type"] || "",
            filling_country: row["Filing Country"] || "",
            filling_date: parseExcelDate(row["Filing Date"]),
            application_no: row["Application No"] || "",
            applicant_type: row["Applicant Type"] || "",
            title: row["Title"] || "",
            status: "docket",
          }));

          // Send to bulk import API
          const res = await axios.post("/api/dockets/bulk-import", {
            dockets: mappedData,
          });

          toast.success(
            `Successfully imported ${
              res.data.imported || mappedData.length
            } records`,
          );
          fetchDockets(); // Refresh the list
          updateStats("dockets", res.data.imported || mappedData.length);
        } catch (err) {
          console.error("Import error:", err);

          const data = err?.response?.data;

          // 1️⃣ Show summary message
          if (data?.message) {
            toast.error(data.message);
          }

          // 2️⃣ Show row-level errors
          if (Array.isArray(data?.errors)) {
            data.errors.forEach((e) => {
              toast.error(
                `Row ${e.row} | Docket: ${e.docket_no || "N/A"} — ${e.error}`,
                { autoClose: 8000 },
              );
            });
          } else {
            // Fallback
            toast.error(
              err?.message ||
                "Import failed. Please check the file and try again.",
            );
          }

          setImporting(false);
        }

        setImporting(false);
      };

      reader.onerror = () => {
        toast.error("Error reading file");
        setImporting(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Import error:", err);
      toast.error(
        err?.response?.data?.message || "Import failed. Please try again.",
      );
      setImporting(false);
    }

    // Reset file input
    e.target.value = "";
  };

  // Helper function to parse Excel dates
  // Improved helper function to parse Excel dates
  const parseExcelDate = (value) => {
    if (!value) return "";

    // If it's already a Date object
    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }

    // If it's an Excel serial number (number)
    if (typeof value === "number") {
      // Excel serial date: days since 1899-12-30
      // But Excel has a bug treating 1900 as leap year, so adjust
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + value * msPerDay);
      return date.toISOString().split("T")[0];
    }

    // If it's a string
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";

      // Try different date formats

      // Format: DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      }

      // Format: MM/DD/YYYY or MM-DD-YYYY
      const mmddyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (mmddyyyy) {
        const [, month, day, year] = mmddyyyy;
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      }

      // Format: YYYY-MM-DD or YYYY/MM/DD
      const yyyymmdd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (yyyymmdd) {
        const [, year, month, day] = yyyymmdd;
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      }

      // Try native Date parsing as fallback
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    }

    console.warn("Could not parse date:", value, typeof value);
    return "";
  };

  // Download template function
  const downloadTemplate = () => {
    const templateData = [
      {
        "Instruction Date": "2025-01-01",
        "anovIP Ref No": "SAMPLE-001",
        "Client Name": "Your Client Name Here", // ✅ Required for lookup
        Service: "Filing of Patent Application",
        "Client Ref No": "",
        Currency: "USD",
        "AnovIP Fee": "",
        "Associate Fee": "",
        "Official Fee": "",
        "Total Fee": "",
        "SPOC Name": "",
        "Phone No": "",
        "Firm Name": "",
        Country: "",
        Email: "",
        Address: "",
        "Application Status": "",
        "Due Date": "",
        "Application Type": "",
        "Filing Country": "",
        "Filing Date": "",
        "Application No": "",
        "Applicant Type": "",
        Title: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    const colWidths = Object.keys(templateData[0]).map((key) => ({
      wch: Math.max(key.length, 18),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, "docket_import_template.xlsx");
    toast.success("Template downloaded");
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const docketStats = [
    {
      title: "Total Dockets",
      count: statsCounts.total,
      icon: <DocketIcon />,
      link: "/docket?status=all", // Clicking this passes 'all' param
    },
    {
      title: "Granted",
      count: statsCounts.granted,
      icon: <ApplicationIcon />, // Changed to ApplicationIcon (looks like success/check)
      status: "Active",
      link: "/docket?status=Granted",
    },
    {
      title: "Pending",
      count: statsCounts.pending,
      icon: <DeadlineIcon />, // Clock/Time icon
      status: "Active",
      link: "/docket?status=In-Process", // Or map to a pending logic in backend
    },
    {
      title: "Inactive",
      count: statsCounts.inactive,
      icon: <DocketIcon />,
      status: "Active",
      link: "/docket?status=Inactive",
    },
  ];

  // 1. Sorting Handler
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    // Effect hook will trigger fetchDockets automatically if you add sortConfig to dependency array
  };

  // 2. Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = records.map((r) => r._id);
      setSelectedIds(allIds);
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

  // 3. Bulk Delete Handler
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} records?`)) return;

    try {
      // Ideally use a bulk delete API, but Promise.all works for now
      await Promise.all(
        selectedIds.map((id) => axios.delete(`/api/dockets/${id}`)),
      );

      toast.success("Records deleted");
      setSelectedIds([]);
      fetchDockets(); // Refresh
      updateStats("dockets", -selectedIds.length);
    } catch (err) {
      toast.error("Error deleting records");
    }
  };

  return (
    <div style={styles.container}>
      {viewMode === "dashboard" ? (
        <>
          <StatsRow items={docketStats} />
          {/* DOCKET TABLE CARD */}
          <div style={styles.tableCard}>
            {/* Header with Title and Filters */}
            <div style={styles.tableHeaderRow}>
              {/* -- FILTERS GROUP (Expands and shrinks intelligently) -- */}
              <div style={styles.filtersWrapper}>
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
                    placeholder="Search..."
                    value={filters.docket_no}
                    onChange={handleFilterChange}
                  />
                </div>
                <div style={styles.filterGroup}>
                  <select
                    name="service_name"
                    style={styles.filterInput}
                    value={filters.service_name}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Services</option>
                    {serviceFeesList.map((sf) => (
                      <option key={sf._id} value={sf.service_name}>
                        {sf.service_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Status</label>
                  <select
                    name="application_status"
                    style={styles.filterInput}
                    value={filters.application_status}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Status</option>
                    <option value="In-Process">Pending</option>
                    <option value="Filed">Filed</option>
                    <option value="Published">Published</option>
                    <option value="Examination due">Examination due</option>
                    <option value="Examination filed">Examination filed</option>
                    <option value="FER Issued">FER Issued</option>
                    <option value="Response to FER filed">
                      Response to FER filed
                    </option>
                    <option value="Hearing Issued">Hearing Issued</option>
                    <option value="Response to Hearing filed">
                      Response to Hearing filed
                    </option>
                    <option value="Granted">Granted</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={styles.filterGroup}>
                  <label style={styles.filterLabel}>Country</label>
                  <input
                    type="text"
                    name="filling_country"
                    style={styles.filterInput}
                    placeholder="Search..."
                    value={filters.filling_country}
                    onChange={handleFilterChange}
                  />
                </div>
              </div>

              {/* -- BUTTONS GROUP (Fixed width, grouped together) -- */}
              <div style={styles.actionButtons}>
                <button style={styles.collapseBtn} onClick={handleResetFilters}>
                  <RotateCw size={18} />
                </button>
                <button
                  title="Create New"
                  style={styles.createBtn}
                  onClick={() => {
                    setFormData(initialFormState);
                    setShowModal(true);
                  }}
                >
                  <Plus size={18} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                />

                {/* <button
                  title={importing ? "Importing..." : "Import"}
                  style={styles.importBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload size={18} />
                </button> */}

                {/* <button
                  title="Export"
                  style={styles.exportBtn}
                  onClick={() => handleExport(false)}
                >
                  <Download size={18} />
                </button> */}

                {/* <button
                  title="Template"
                  style={styles.templateBtn}
                  onClick={downloadTemplate}
                >
                  <FileSpreadsheet size={18} />
                </button> */}
              </div>
            </div>

            {/* Table */}
            {/* Add Bulk Action Bar above table if items selected */}
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
                  style={{ ...styles.exportBtn }}
                >
                  <Download size={14} />
                </button>
              </div>
            )}

            {/* Modified Table Container for Frozen Header */}
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {/* CHECKBOX HEADER */}
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
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Action
                    </th>
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Sr no.
                    </th>

                    {/* SORTABLE HEADERS */}
                    <th
                      style={{
                        ...styles.th,
                        ...styles.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("instruction_date")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Instruction Date
                        {sortConfig.key === "instruction_date" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>

                    <th
                      style={{
                        ...styles.th,
                        ...styles.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("docket_no")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Docket No.
                        {sortConfig.key === "docket_no" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>

                    {/* ... Repeat pattern for other columns ... */}
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Application Number
                    </th>
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Application Type
                    </th>
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Date of Filing
                    </th>
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Country
                    </th>
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Status
                    </th>
                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Insert By
                    </th>
                    {/* <th
                      style={{
                        ...styles.th,
                        ...styles.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("createdAt")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Created On
                        {sortConfig.key === "createdAt" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>

                    <th
                      style={{
                        ...styles.th,
                        ...styles.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("updatedAt")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Last Updated
                        {sortConfig.key === "updatedAt" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th> */}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, index) => (
                    <tr
                      key={r._id}
                      style={{
                        ...styles.tr,
                        backgroundColor: selectedIds.includes(r._id)
                          ? "#eff6ff"
                          : "transparent", // Highlight selected
                      }}
                    >
                      {/* CHECKBOX CELL */}
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
                          {/* EDIT BUTTON */}
                          <span
                            title="Edit"
                            style={styles.viewLink}
                            onClick={() => {
                              setSelectedRecord(r);
                              setViewMode("detail");
                              setDetailTab("edit"); // Opens directly in Edit mode
                              setActiveDetailTab("identification");
                              setCameFromExternal(false);
                              fetchRelatedRecords(r.docket_no, r._id);
                            }}
                          >
                            <span style={{ color: "#f97316" }}>
                              {" "}
                              {/* Orange color to match your theme */}
                              <Pencil style={{ scale: "0.7" }} />
                            </span>
                          </span>

                          {/* REPLICA BUTTON */}
                          <span
                            title="Replica"
                            style={{ ...styles.viewLink, color: "#6b7280" }}
                            onClick={() => handleReplica(r)}
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
                        {formatDate(r.instruction_date)}
                      </td>
                      <td style={styles.td}>{r.docket_no}</td>
                      <td style={styles.td}>{r.application_no}</td>
                      <td style={styles.td}>{r.application_type}</td>
                      <td style={styles.td}>{formatDate(r.filling_date)}</td>
                      <td style={styles.td}>{r.filling_country}</td>
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
                                r.application_status === "Granted"
                                  ? "#d1fae5"
                                  : r.application_status === "In-Process"
                                    ? "#dbeafe"
                                    : r.application_status === "Inactive"
                                      ? "#fee2e2"
                                      : "#f3f4f6",
                              color:
                                r.application_status === "Granted"
                                  ? "#065f46"
                                  : r.application_status === "In-Process"
                                    ? "#1e40af"
                                    : r.application_status === "Inactive"
                                      ? "#991b1b"
                                      : "#374151",
                            }}
                          >
                            {r.application_status || "Pending"}
                          </span>
                          <div
                            onClick={() => setTimelineDocket(r)}
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
                                backgroundColor: r.sub_status
                                  ? "#fff7ed"
                                  : "#f3f4f6",
                                color: r.sub_status ? "#f97316" : "#6b7280",
                                border: r.sub_status
                                  ? "1px solid #fed7aa"
                                  : "1px solid transparent",
                              }}
                            >
                              {r.sub_status || "Not Started"}
                            </span>
                            <Activity size={12} color="#f97316" />
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        {r.created_by
                          ? r.created_by.name || r.created_by.email
                          : "System"}
                      </td>
                      {/* <td style={styles.td}>{formatDateDetail(r.createdAt)}</td>
                      <td style={styles.td}>{formatDateDetail(r.updatedAt)}</td> */}
                    </tr>
                  ))}
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
                    disabled={currentPage === 1}
                    style={{
                      ...styles.pageBtn,

                      opacity: !canGoPrev ? 0.5 : 1,
                      cursor: !canGoPrev ? "not-allowed" : "pointer",
                    }}
                  >
                    ←
                  </button>
                  {Array.from(
                    { length: Math.min(3, totalPages || 1) },
                    (_, i) => i + 1,
                  ).map((p) => (
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
                    disabled={currentPage === totalPages}
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
        </>
      ) : (
        /* DETAIL VIEW */
        <div style={styles.modalOverlay}>
          <div style={styles.detailCard}>
            {/* TOP BAR: Edit/View tabs + Close */}
            <div style={styles.detailHeader}>
              <div style={styles.tabsContainer}>
                <button
                  title="Replica"
                  style={{
                    ...styles.replicaBtn,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  View/Edit
                </button>
              </div>
              <div style={sectionTabStyles.fieldRow}>
                <span style={sectionTabStyles.fieldLabel}>Created On</span>
                <span style={sectionTabStyles.fieldValue}>
                  {formatDateDetail(selectedRecord?.createdAt)}
                </span>
              </div>
              <div style={sectionTabStyles.fieldRow}>
                <span style={sectionTabStyles.fieldLabel}>Last Updated</span>
                <span style={sectionTabStyles.fieldValue}>
                  {formatDateDetail(selectedRecord?.updatedAt)}
                </span>
              </div>
              <button
                style={styles.closeBtn}
                onClick={() => {
                  if (cameFromExternal) {
                    navigate(-1);
                  } else {
                    setViewMode("dashboard");
                    setSelectedRecord(null);
                  }
                  setCameFromExternal(false);
                }}
              >
                ✕
              </button>
            </div>

            {/* UNIFIED EDIT VIEW WITH ALL TABS */}
            <div>
              {/* SECTION TABS - Combined edit + view-only tabs */}
              <div style={sectionTabStyles.tabBar}>
                {[
                  { key: "identification", label: "Identification" },
                  { key: "technical", label: "Technical Details" },
                  { key: "parties", label: "Parties" },
                  { key: "grant", label: "Grant Details" },
                  {
                    key: "casehistory",
                    label: `Case History${relatedTasks.length > 0 ? ` (${relatedTasks.length})` : ""}`,
                  },
                  {
                    key: "deadlines",
                    label: `Deadlines${relatedDeadlines.length > 0 ? ` (${relatedDeadlines.length})` : ""}`,
                  },
                  {
                    key: "invoice",
                    label: `Invoice${relatedInvoices.length > 0 ? ` (${relatedInvoices.length})` : ""}`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    style={{
                      ...sectionTabStyles.tab,
                      ...(activeEditTab === tab.key
                        ? sectionTabStyles.tabActive
                        : {}),
                    }}
                    onClick={() => setActiveEditTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: "30px 40px" }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(e);
                  }}
                >
                  {/* ── IDENTIFICATION TAB (EDIT) ── */}
                  {activeEditTab === "identification" && (
                    <div>
                      <h6 style={styles.sectionTitle}>Services</h6>
                      <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Instruction Date
                          </label>
                          <input
                            type="date"
                            name="instruction_date"
                            style={styles.formInput}
                            required
                            value={
                              selectedRecord?.instruction_date
                                ? selectedRecord.instruction_date.split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                instruction_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Docket No.</label>
                          <input
                            type="text"
                            name="docket_no"
                            style={styles.formInput}
                            required
                            value={selectedRecord?.docket_no || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                docket_no: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div
                          style={{
                            ...styles.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={styles.formLabel}>Service</label>
                          <select
                            name="service_name"
                            style={styles.formSelect}
                            value={selectedRecord?.service_name || ""}
                            onChange={handleServiceChangeEdit}
                          >
                            <option value="">Select</option>
                            {serviceFeesList.map((sf) => (
                              <option key={sf._id} value={sf.service_name}>
                                {sf.service_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Application No.
                          </label>
                          <input
                            type="text"
                            name="application_no"
                            style={styles.formInput}
                            value={selectedRecord?.application_no || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                application_no: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Application Type
                          </label>
                          <select
                            name="application_type"
                            style={styles.formSelect}
                            value={selectedRecord?.application_type || ""}
                            // In the edit view applicant_type select onChange:
                            onChange={(e) => {
                              const newType = e.target.value;
                              const service = serviceFeesList.find(
                                (s) =>
                                  s.service_name ===
                                  selectedRecord?.service_name,
                              );
                              setSelectedRecord((prev) => ({
                                ...prev,
                                applicant_type: newType,
                                officialfee: service
                                  ? getOfficialFee(service, newType)
                                  : prev.officialfee,
                              }));
                            }}
                          >
                            <option value="">Select</option>
                            <option value="Provisional">Provisional</option>
                            <option value="Ordinary">Ordinary</option>
                            <option value="Conventional">Conventional</option>
                            <option value="PCT-NP">PCT-NP</option>
                            <option value="Ordinary-Addition">
                              Ordinary-Addition
                            </option>
                            <option value="Conventional-Addition">
                              Conventional-Addition
                            </option>
                            <option value="PCT-NP-Addition">
                              PCT-NP-Addition
                            </option>
                            <option value="Ordinary-Divisional">
                              Ordinary-Divisional
                            </option>
                            <option value="Conventional-Divisional">
                              Conventional-Divisional
                            </option>
                            <option value="PCT-NP-Divisional">
                              PCT-NP-Divisional
                            </option>
                            <option value="others">others</option>
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Filing Date</label>
                          <input
                            type="date"
                            name="filling_date"
                            style={styles.formInput}
                            value={
                              selectedRecord?.filling_date
                                ? selectedRecord.filling_date.split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                filling_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Filing Country</label>
                          <input
                            type="text"
                            name="filling_country"
                            style={styles.formInput}
                            value={selectedRecord?.filling_country || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                filling_country: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Application Status
                          </label>
                          <select
                            name="application_status"
                            style={styles.formSelect}
                            value={selectedRecord?.application_status || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                application_status: e.target.value,
                              })
                            }
                          >
                            <option value="">Select</option>
                            <option value="Inactive">Inactive</option>
                            <option value="In-Process">In-Process</option>
                            <option value="Filed">Filed</option>
                            <option value="Published">Published</option>
                            <option value="Examination due">
                              Examination due
                            </option>
                            <option value="Examination filed">
                              Examination filed
                            </option>
                            <option value="FER Issued">FER Issued</option>
                            <option value="Response to FER filed">
                              Response to FER filed
                            </option>
                            <option value="Hearing Issued">
                              Hearing Issued
                            </option>
                            <option value="Response to Hearing filed">
                              Response to Hearing filed
                            </option>
                            <option value="Granted">Granted</option>
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Applicant Type</label>
                          <select
                            name="applicant_type"
                            style={styles.formSelect}
                            value={selectedRecord?.applicant_type || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                applicant_type: e.target.value,
                              })
                            }
                          >
                            <option value="">Select</option>
                            <option value="Natural person">
                              Natural person
                            </option>
                            <option value="Start-up">Start-up</option>
                            <option value="Small entity">Small entity</option>
                            <option value="Educational institution">
                              Educational institution
                            </option>
                            <option value="Others">
                              Others (Large Entity)
                            </option>
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Client Ref. No.
                          </label>
                          <input
                            type="text"
                            name="client_ref"
                            style={styles.formInput}
                            value={selectedRecord?.client_ref || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                client_ref: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Fee Details */}
                      <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                        Fee Details
                      </h6>
                      <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Currency</label>
                          <select
                            name="currency"
                            style={styles.formSelect}
                            value={selectedRecord?.currency || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                currency: e.target.value,
                              })
                            }
                          >
                            <option value="INR">INR</option>
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>anovIP Fee</label>
                          <input
                            type="text"
                            name="anovipfee"
                            style={styles.formInput}
                            value={selectedRecord?.anovipfee || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                anovipfee: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Official Fee</label>
                          <input
                            type="text"
                            name="officialfee"
                            style={styles.formInput}
                            value={selectedRecord?.officialfee || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                officialfee: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Total Fee</label>
                          <input
                            type="text"
                            name="fee"
                            style={{
                              ...styles.formInput,
                              backgroundColor: "#f3f4f6",
                            }}
                            readOnly
                            value={selectedRecord?.fee || ""}
                          />
                        </div>
                      </div>

                      {/* Documents */}
                      <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                        Documents
                      </h6>
                      <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                          <label style={{ ...styles.formLabel }}>
                            Document Type *
                          </label>
                          <select
                            value={pendingDocType}
                            onChange={(e) => setPendingDocType(e.target.value)}
                            style={styles.formSelect}
                          >
                            <option value="">-- Select Type --</option>
                            <option value="Input">Input</option>
                            <option value="Internal">Internal</option>
                            <option value="Output">Output</option>
                          </select>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Attach</label>
                          <button
                            type="button"
                            onClick={() => {
                              if (!pendingDocType) {
                                toast.error(
                                  "Please select Document Type first!",
                                );
                                return;
                              }
                              setIsUppyModalOpen(true);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 12px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              backgroundColor: "#f3f4f6",
                              cursor: "pointer",
                              fontSize: "13px",
                              width: "fit-content",
                            }}
                          >
                            <Paperclip size={14} /> Attach Files
                          </button>
                        </div>
                      </div>
                      {selectedRecord?.files &&
                        selectedRecord.files.length > 0 && (
                          <div style={{ marginTop: "8px" }}>
                            <small style={{ color: "#666" }}>Existing:</small>
                            {renderFileList(
                              selectedRecord.files,
                              true,
                              selectedRecord._id,
                            )}
                          </div>
                        )}
                      {newlyUploadedFiles.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <small style={{ color: "green" }}>
                            Ready to save:
                          </small>
                          {renderFileList(newlyUploadedFiles, false)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── TECHNICAL DETAILS TAB (EDIT) ── */}
                  {activeEditTab === "technical" && (
                    <div>
                      <div style={styles.formGrid}>
                        <div
                          style={{
                            ...styles.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={styles.formLabel}>
                            Title of Invention
                          </label>
                          <input
                            type="text"
                            name="title"
                            style={styles.formInput}
                            value={selectedRecord?.title || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                title: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div
                          style={{
                            ...styles.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={styles.formLabel}>
                            Technical Field / IPC Classification
                          </label>
                          <input
                            type="text"
                            name="field_of_invention"
                            style={styles.formInput}
                            value={selectedRecord?.field_of_invention || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                field_of_invention: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* APPLICANTS */}
                      <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                        Applicant Names and Nationalities
                      </h6>
                      {(selectedRecord?.applicants || []).map(
                        (applicant, index) => (
                          <div
                            key={index}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                              gap: "15px",
                              marginBottom: "15px",
                              alignItems: "end",
                            }}
                          >
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>Name</label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={applicant.name || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.applicants || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    name: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    applicants: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>
                                Nationality
                              </label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={applicant.nationality || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.applicants || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    nationality: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    applicants: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>
                                Country Residence
                              </label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={applicant.country_residence || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.applicants || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    country_residence: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    applicants: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>Address</label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={applicant.address || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.applicants || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    address: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    applicants: updated,
                                  });
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              style={{
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                padding: "10px 20px",
                                borderRadius: "6px",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                const updated = (
                                  selectedRecord.applicants || []
                                ).filter((_, i) => i !== index);
                                setSelectedRecord({
                                  ...selectedRecord,
                                  applicants: updated,
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ),
                      )}
                      <button
                        type="button"
                        style={{
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          marginBottom: "25px",
                        }}
                        onClick={() => {
                          const updated = [
                            ...(selectedRecord?.applicants || []),
                            {
                              name: "",
                              nationality: "",
                              country_residence: "",
                              address: "",
                            },
                          ];
                          setSelectedRecord({
                            ...selectedRecord,
                            applicants: updated,
                          });
                        }}
                      >
                        Add Applicant
                      </button>

                      {/* INVENTORS */}
                      <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                        Inventor Names and Countries
                      </h6>
                      {(selectedRecord?.inventors || []).map(
                        (inventor, index) => (
                          <div
                            key={index}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                              gap: "15px",
                              marginBottom: "15px",
                              alignItems: "end",
                            }}
                          >
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>Name</label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={inventor.name || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.inventors || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    name: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    inventors: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>Country</label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={inventor.country || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.inventors || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    country: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    inventors: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>
                                Nationality
                              </label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={inventor.nationality || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.inventors || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    nationality: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    inventors: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>Address</label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={inventor.address || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.inventors || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    address: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    inventors: updated,
                                  });
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              style={{
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                padding: "10px 20px",
                                borderRadius: "6px",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                const updated = (
                                  selectedRecord.inventors || []
                                ).filter((_, i) => i !== index);
                                setSelectedRecord({
                                  ...selectedRecord,
                                  inventors: updated,
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ),
                      )}
                      <button
                        type="button"
                        style={{
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          marginBottom: "25px",
                        }}
                        onClick={() => {
                          const updated = [
                            ...(selectedRecord?.inventors || []),
                            {
                              name: "",
                              country: "",
                              nationality: "",
                              address: "",
                            },
                          ];
                          setSelectedRecord({
                            ...selectedRecord,
                            inventors: updated,
                          });
                        }}
                      >
                        Add Inventor
                      </button>

                      {/* PRIORITY CLAIMS */}
                      <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                        Priority Claims
                      </h6>
                      {(selectedRecord?.priorities || []).map(
                        (priority, index) => (
                          <div
                            key={index}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr auto",
                              gap: "15px",
                              marginBottom: "15px",
                              alignItems: "end",
                            }}
                          >
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>Country</label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={priority.country || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.priorities || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    country: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    priorities: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>
                                Priority Number
                              </label>
                              <input
                                type="text"
                                style={styles.formInput}
                                value={priority.number || ""}
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.priorities || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    number: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    priorities: updated,
                                  });
                                }}
                              />
                            </div>
                            <div style={styles.formGroup}>
                              <label style={styles.formLabel}>
                                Priority Date
                              </label>
                              <input
                                type="date"
                                style={styles.formInput}
                                value={
                                  priority.date
                                    ? priority.date.split("T")[0]
                                    : ""
                                }
                                onChange={(e) => {
                                  const updated = [
                                    ...(selectedRecord.priorities || []),
                                  ];
                                  updated[index] = {
                                    ...updated[index],
                                    date: e.target.value,
                                  };
                                  setSelectedRecord({
                                    ...selectedRecord,
                                    priorities: updated,
                                  });
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              style={{
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                padding: "10px 20px",
                                borderRadius: "6px",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                const updated = (
                                  selectedRecord.priorities || []
                                ).filter((_, i) => i !== index);
                                setSelectedRecord({
                                  ...selectedRecord,
                                  priorities: updated,
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ),
                      )}
                      <button
                        type="button"
                        style={{
                          backgroundColor: "#10b981",
                          color: "white",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          const updated = [
                            ...(selectedRecord?.priorities || []),
                            { country: "", number: "", date: "" },
                          ];
                          setSelectedRecord({
                            ...selectedRecord,
                            priorities: updated,
                          });
                        }}
                      >
                        Add Priority
                      </button>
                    </div>
                  )}

                  {/* ── PARTIES TAB (EDIT) ── */}
                  {activeEditTab === "parties" && (
                    <div>
                      <h6 style={styles.sectionTitle}>
                        Agent / Client Details
                      </h6>
                      <div style={styles.formGrid}>
                        <div
                          style={{
                            ...styles.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={styles.formLabel}>Select Client</label>
                          <select
                            name="client_id"
                            style={styles.formSelect}
                            value={selectedRecord?.client_id || ""}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              const client = clients.find(
                                (c) => c._id === selectedId,
                              );
                              setSelectedRecord((prev) => ({
                                ...prev,
                                client_id: selectedId,
                                spoc_name: client ? client.name : "",
                                phone_no: client ? client.phone_no || "" : "",
                                firm_name: client ? client.firm_name || "" : "",
                                country: client ? client.country || "" : "",
                                email: client ? client.email || "" : "",
                                address: client ? client.address || "" : "",
                              }));
                            }}
                          >
                            <option value="">Select Client</option>
                            {clients.map((client) => (
                              <option key={client._id} value={client._id}>
                                {client.name} - {client.firm_name}
                              </option>
                            ))}
                          </select>
                          <Link
                            to="/user-management"
                            style={{ fontSize: "12px", marginTop: "4px" }}
                          >
                            Client not exist? Add Client
                          </Link>
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>SPOC Name</label>
                          <input
                            type="text"
                            style={styles.formInput}
                            value={selectedRecord?.spoc_name || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                spoc_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Phone No</label>
                          <input
                            type="text"
                            style={styles.formInput}
                            value={selectedRecord?.phone_no || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                phone_no: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Firm Name</label>
                          <input
                            type="text"
                            style={styles.formInput}
                            value={selectedRecord?.firm_name || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                firm_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>Country</label>
                          <input
                            type="text"
                            style={styles.formInput}
                            value={selectedRecord?.country || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                country: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div
                          style={{
                            ...styles.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={styles.formLabel}>Email</label>
                          <input
                            type="email"
                            style={styles.formInput}
                            value={selectedRecord?.email || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                email: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div
                          style={{
                            ...styles.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={styles.formLabel}>Address</label>
                          <input
                            type="text"
                            style={styles.formInput}
                            value={selectedRecord?.address || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── GRANT DETAILS TAB (EDIT) ── */}
                  {activeEditTab === "grant" && (
                    <div>
                      <div style={styles.formGrid}>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Deadline/Due Date
                          </label>
                          <input
                            type="date"
                            name="due_date"
                            style={styles.formInput}
                            value={
                              selectedRecord?.due_date
                                ? selectedRecord.due_date.split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                due_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Application Number
                          </label>
                          <input
                            type="text"
                            name="application_number"
                            style={styles.formInput}
                            value={selectedRecord?.application_number || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                application_number: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            PCT Application Date
                          </label>
                          <input
                            type="date"
                            name="pct_application_date"
                            style={styles.formInput}
                            value={
                              selectedRecord?.pct_application_date
                                ? selectedRecord.pct_application_date.split(
                                    "T",
                                  )[0]
                                : ""
                            }
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                pct_application_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.formLabel}>
                            Corresponding App. No.
                          </label>
                          <input
                            type="text"
                            name="corresponding_application_no"
                            style={styles.formInput}
                            value={
                              selectedRecord?.corresponding_application_no || ""
                            }
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                corresponding_application_no: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── CASE HISTORY (VIEW-ONLY) ── */}
                  {activeEditTab === "casehistory" && (
                    <div>
                      {relatedTasks.length === 0 ? (
                        <div style={sectionTabStyles.emptyState}>
                          No tasks found for this docket.
                        </div>
                      ) : (
                        <table style={sectionTabStyles.innerTable}>
                          <thead>
                            <tr style={{ backgroundColor: "#f9fafb" }}>
                              <th style={sectionTabStyles.innerTh}>#</th>
                              <th style={sectionTabStyles.innerTh}>
                                Work Type
                              </th>
                              <th style={sectionTabStyles.innerTh}>Status</th>
                              <th style={sectionTabStyles.innerTh}>
                                Prepared By
                              </th>
                              <th style={sectionTabStyles.innerTh}>
                                Internal Deadline
                              </th>
                              <th style={sectionTabStyles.innerTh}>
                                Official Deadline
                              </th>
                              <th style={sectionTabStyles.innerTh}>Remarks</th>
                              <th style={sectionTabStyles.innerTh}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedTasks.map((t, i) => (
                              <tr
                                key={t._id}
                                style={{ borderBottom: "1px solid #f3f4f6" }}
                              >
                                <td style={sectionTabStyles.innerTd}>
                                  {i + 1}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {t.work_type || t.application_type || "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 10,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      backgroundColor:
                                        t.task_status === "Completed"
                                          ? "#d1fae5"
                                          : t.task_status === "In Progress"
                                            ? "#dbeafe"
                                            : "#f3f4f6",
                                      color:
                                        t.task_status === "Completed"
                                          ? "#065f46"
                                          : t.task_status === "In Progress"
                                            ? "#1e40af"
                                            : "#374151",
                                    }}
                                  >
                                    {t.task_status || "Pending"}
                                  </span>
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {t.prepared_by_name ||
                                    (typeof t.prepared_by === "object"
                                      ? t.prepared_by?.name
                                      : "") ||
                                    "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {t.internal_deadline
                                    ? new Date(
                                        t.internal_deadline,
                                      ).toLocaleDateString()
                                    : "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {t.official_deadline
                                    ? new Date(
                                        t.official_deadline,
                                      ).toLocaleDateString()
                                    : "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {t.remarks || "-"}
                                </td>
                                <td style={{ cursor: "pointer" }}>
                                  <span
                                    onClick={() =>
                                      navigate("/task", {
                                        state: {
                                          viewRecord: t,
                                          returnToDocket: selectedRecord,
                                        },
                                      })
                                    }
                                  >
                                    View{" "}
                                    <span style={styles.viewIcon}>
                                      <Eye style={{ scale: "0.7" }} />
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* ── DEADLINES (VIEW-ONLY) ── */}
                  {activeEditTab === "deadlines" && (
                    <div>
                      {relatedDeadlines.length === 0 ? (
                        <div style={sectionTabStyles.emptyState}>
                          No deadlines found for this docket.
                        </div>
                      ) : (
                        <table style={sectionTabStyles.innerTable}>
                          <thead>
                            <tr style={{ backgroundColor: "#f9fafb" }}>
                              <th style={sectionTabStyles.innerTh}>#</th>
                              <th style={sectionTabStyles.innerTh}>
                                Work Type
                              </th>
                              <th style={sectionTabStyles.innerTh}>
                                Deadline Date
                              </th>
                              <th style={sectionTabStyles.innerTh}>Status</th>
                              <th style={sectionTabStyles.innerTh}>
                                Application No
                              </th>
                              <th style={sectionTabStyles.innerTh}>Remarks</th>
                              <th style={sectionTabStyles.innerTh}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedDeadlines.map((d, i) => (
                              <tr
                                key={d._id}
                                style={{ borderBottom: "1px solid #f3f4f6" }}
                              >
                                <td style={sectionTabStyles.innerTd}>
                                  {i + 1}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {d.worktype || "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {d.deadline_date
                                    ? new Date(
                                        d.deadline_date,
                                      ).toLocaleDateString("en-GB")
                                    : "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 10,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      backgroundColor:
                                        d.status === "ON"
                                          ? "#dcfce7"
                                          : "#f3f4f6",
                                      color:
                                        d.status === "ON"
                                          ? "#16a34a"
                                          : "#6b7280",
                                    }}
                                  >
                                    {d.status}
                                  </span>
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {d.application_no || "-"}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {d.remarks || "-"}
                                </td>
                                <td style={{ cursor: "pointer" }}>
                                  <span
                                    onClick={() =>
                                      navigate("/deadline", {
                                        state: {
                                          viewRecord: d,
                                          returnToDocket: selectedRecord,
                                        },
                                      })
                                    }
                                  >
                                    View{" "}
                                    <span style={styles.viewIcon}>
                                      <Eye style={{ scale: "0.7" }} />
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* ── INVOICE (VIEW-ONLY) ── */}
                  {activeEditTab === "invoice" && (
                    <div>
                      {relatedInvoices.length === 0 ? (
                        <div style={sectionTabStyles.emptyState}>
                          No invoices found for this docket.
                        </div>
                      ) : (
                        <table style={sectionTabStyles.innerTable}>
                          <thead>
                            <tr style={{ backgroundColor: "#f9fafb" }}>
                              <th style={sectionTabStyles.innerTh}>#</th>
                              <th style={sectionTabStyles.innerTh}>
                                Invoice No
                              </th>
                              <th style={sectionTabStyles.innerTh}>
                                Invoice Date
                              </th>
                              <th style={sectionTabStyles.innerTh}>Due Date</th>
                              <th style={sectionTabStyles.innerTh}>Amount</th>
                              <th style={sectionTabStyles.innerTh}>GST</th>
                              <th style={sectionTabStyles.innerTh}>Total</th>
                              <th style={sectionTabStyles.innerTh}>Status</th>
                              <th style={sectionTabStyles.innerTh}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedInvoices.map((inv, i) => (
                              <tr
                                key={inv._id}
                                style={{ borderBottom: "1px solid #f3f4f6" }}
                              >
                                <td style={sectionTabStyles.innerTd}>
                                  {i + 1}
                                </td>
                                <td
                                  style={{
                                    ...sectionTabStyles.innerTd,
                                    fontWeight: 600,
                                  }}
                                >
                                  {inv.invoice_no}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {formatDate(inv.invoice_date)}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {formatDate(inv.due_date)}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {inv.currency === "USD" ? "$" : "₹"}
                                  {Number(inv.fee || 0).toLocaleString()}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  {inv.currency === "USD" ? "$" : "₹"}
                                  {Number(inv.gst_amount || 0).toLocaleString()}
                                </td>
                                <td
                                  style={{
                                    ...sectionTabStyles.innerTd,
                                    fontWeight: 600,
                                  }}
                                >
                                  {inv.currency === "USD" ? "$" : "₹"}
                                  {Number(
                                    inv.total_with_gst || 0,
                                  ).toLocaleString()}
                                </td>
                                <td style={sectionTabStyles.innerTd}>
                                  <span
                                    style={{
                                      padding: "3px 8px",
                                      borderRadius: 10,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      backgroundColor:
                                        inv.status === "Paid"
                                          ? "#dcfce7"
                                          : inv.status === "Sent"
                                            ? "#dbeafe"
                                            : inv.status === "Overdue"
                                              ? "#fee2e2"
                                              : "#f3f4f6",
                                      color:
                                        inv.status === "Paid"
                                          ? "#16a34a"
                                          : inv.status === "Sent"
                                            ? "#1d4ed8"
                                            : inv.status === "Overdue"
                                              ? "#dc2626"
                                              : "#374151",
                                    }}
                                  >
                                    {inv.status}
                                  </span>
                                </td>
                                <td style={{ cursor: "pointer" }}>
                                  <span
                                    onClick={() =>
                                      navigate("/invoice", {
                                        state: {
                                          viewRecord: inv,
                                          returnToDocket: selectedRecord,
                                        },
                                      })
                                    }
                                  >
                                    View{" "}
                                    <span style={styles.viewIcon}>
                                      <Eye style={{ scale: "0.7" }} />
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* SUBMIT BUTTONS - only show for editable tabs */}
                  {["identification", "technical", "parties", "grant"].includes(
                    activeEditTab,
                  ) && (
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "25px",
                      }}
                    >
                      <button
                        type="submit"
                        disabled={isUploading}
                        style={{
                          ...styles.submitBtn,
                          flex: 1,
                          opacity: isUploading ? 0.6 : 1,
                          cursor: isUploading ? "not-allowed" : "pointer",
                        }}
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const updatePayload = {
                              ...selectedRecord,
                              newFiles: newlyUploadedFiles,
                            };
                            const res = await axios.put(
                              `/api/dockets/${selectedRecord._id}`,
                              updatePayload,
                            );
                            const updatedRecord = res.data.data;
                            setRecords((prev) =>
                              prev.map((r) =>
                                r._id === selectedRecord._id
                                  ? updatedRecord
                                  : r,
                              ),
                            );
                            setSelectedRecord(updatedRecord);
                            setNewlyUploadedFiles([]);
                            toast.success("Updated successfully");
                          } catch (err) {
                            if (!import.meta.env.PROD)
                              console.error("Error updating", err);
                            toast.error(
                              err?.response?.data?.message ||
                                "Something occurred. Please try again.",
                            );
                          }
                        }}
                      >
                        {isSubmitting
                          ? "Updating..."
                          : isUploading
                            ? "Uploading Files..."
                            : "Update"}
                      </button>
                      <button
                        type="button"
                        style={{
                          ...styles.viewAllBtn,
                          flex: "none",
                          padding: "14px 30px",
                        }}
                        onClick={() => {
                          setViewMode("dashboard");
                          setSelectedRecord(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      <DeleteConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this task?"
      />
      {/* CREATE/EDIT MODAL */}
      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h5 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                {formData._id ? "Edit Docket" : "Create Docket"}
              </h5>

              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {/* Only show Import/Template buttons if we are CREATING a new docket */}
                {!formData._id && (
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
                      title={importing ? "Importing..." : "Import Bulk Data"}
                      style={{
                        ...styles.importBtn,
                        width: "auto",
                        padding: "0 12px",
                        gap: "6px",
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      <Upload size={16} />
                    </button>

                    <button
                      type="button"
                      title="Download Template"
                      style={{
                        ...styles.templateBtn,
                        width: "auto",
                        padding: "0 12px",
                        gap: "6px",
                      }}
                      onClick={downloadTemplate}
                    >
                      <FileSpreadsheet size={16} />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  style={styles.modalCloseBtn}
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <form style={styles.modalBody} onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "30px",
                }}
              >
                {/* LEFT COLUMN */}
                <div>
                  <h6 style={styles.sectionTitle}>Services</h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Instruction Date</label>
                      <input
                        type="date"
                        name="instruction_date"
                        style={styles.formInput}
                        required
                        value={
                          formData.instruction_date
                            ? formData.instruction_date.split("T")[0]
                            : ""
                        }
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Docket No.</label>
                      <input
                        type="text"
                        name="docket_no"
                        style={styles.formInput}
                        required
                        value={formData.docket_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>Client</label>
                      <select
                        name="client_id"
                        style={styles.formSelect}
                        value={formData.client_id}
                        onChange={handleClientChange} // <--- CHANGED FROM handleInputChange
                        required
                      >
                        <option value="">Select Client</option>
                        {clients.map((client) => (
                          <option key={client._id} value={client._id}>
                            {client.name} - {client.firm_name}
                          </option>
                        ))}
                      </select>
                      <Link to="/user-management">
                        Client not exist? Add Client
                      </Link>

                      <label style={styles.formLabel}>Service</label>
                      <select
                        name="service_name"
                        style={styles.formSelect}
                        value={formData.service_name}
                        onChange={handleServiceChange}
                      >
                        <option value="">Select</option>
                        {serviceFeesList.map((sf) => (
                          <option key={sf._id} value={sf.service_name}>
                            {sf.service_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Client Ref. No.</label>
                      <input
                        type="text"
                        name="client_ref"
                        style={styles.formInput}
                        value={formData.client_ref}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Currency</label>
                      <select
                        name="currency"
                        style={styles.formSelect}
                        value={formData.currency}
                        onChange={handleInputChange}
                      >
                        <option value="INR">INR</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>anovIP Fee</label>
                      <input
                        type="text"
                        name="anovipfee"
                        style={styles.formInput}
                        value={formData.anovipfee}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Official Fee</label>
                      <input
                        type="text"
                        name="officialfee"
                        style={styles.formInput}
                        value={formData.officialfee}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Total Fee</label>
                      <input
                        type="text"
                        name="fee"
                        style={{
                          ...styles.formInput,
                          backgroundColor: "#f3f4f6",
                        }}
                        readOnly
                        value={formData.fee}
                      />
                    </div>
                  </div>

                  <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                    Client Details
                  </h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>SPOC Name</label>
                      <input
                        type="text"
                        name="spoc_name"
                        style={styles.formInput}
                        value={formData.spoc_name}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Phone No</label>
                      <input
                        type="text"
                        name="phone_no"
                        style={styles.formInput}
                        value={formData.phone_no}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Firm Name</label>
                      <input
                        type="text"
                        name="firm_name"
                        style={styles.formInput}
                        value={formData.firm_name}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div style={{ ...styles.formGroup, position: "relative" }}>
                      <label style={styles.formLabel}>Country</label>
                      <input
                        type="text"
                        name="country"
                        style={styles.formInput}
                        autoComplete="off"
                        value={formData.country}
                        onChange={handleInputChange}
                      />
                      {suggestions1.length > 0 && (
                        <div style={styles.suggestionBox}>
                          {suggestions1.map((s, i) => (
                            <div
                              key={i}
                              style={styles.suggestionItem}
                              onClick={() => selectSuggestion("country", s)}
                            >
                              {s.code} {s.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>Email Id</label>
                      <input
                        type="email"
                        name="email"
                        style={styles.formInput}
                        value={formData.email}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>Address</label>
                      <input
                        type="text"
                        name="address"
                        style={styles.formInput}
                        value={formData.address}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div>
                  <h6 style={styles.sectionTitle}>Status</h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Application Status</label>
                      <select
                        name="application_status"
                        style={styles.formSelect}
                        value={formData.application_status}
                        onChange={handleInputChange}
                      >
                        <option value="">Select</option>
                        <option value="Inactive">Inactive</option>
                        <option value="In-Process">In-Process</option>
                        <option value="Filed">Filed</option>
                        <option value="Published">Published</option>
                        <option value="Examination due">Examination due</option>
                        <option value="Examination filed">
                          Examination filed
                        </option>
                        <option value="FER Issued">FER Issued</option>
                        <option value="Response to FER filed">
                          Response to FER filed
                        </option>
                        <option value="Hearing Issued">Hearing Issued</option>
                        <option value="Response to Hearing filed">
                          Response to Hearing filed
                        </option>
                        <option value="Granted">Granted</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Deadline/Due Date</label>
                      <input
                        type="date"
                        name="due_date"
                        style={styles.formInput}
                        value={
                          formData.due_date
                            ? formData.due_date.split("T")[0]
                            : ""
                        }
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <h6 style={{ ...styles.sectionTitle, marginTop: "25px" }}>
                    Application Details
                  </h6>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Application Type</label>
                      <select
                        name="application_type"
                        style={styles.formSelect}
                        value={formData.application_type}
                        onChange={handleInputChange}
                      >
                        <option value="">Select</option>
                        <option value="Provisional">Provisional</option>
                        <option value="Ordinary">Ordinary</option>
                        <option value="Conventional">Conventional</option>
                        <option value="PCT-NP">PCT-NP</option>
                        <option value="Ordinary-Addition">
                          Ordinary-Addition
                        </option>
                        <option value="Conventional-Addition">
                          Conventional-Addition
                        </option>
                        <option value="PCT-NP-Addition">PCT-NP-Addition</option>
                        <option value="Ordinary-Divisional">
                          Ordinary-Divisional
                        </option>
                        <option value="Conventional-Divisional">
                          Conventional-Divisional
                        </option>
                        <option value="PCT-NP-Divisional">
                          PCT-NP-Divisional
                        </option>
                        <option value="others">others</option>
                      </select>
                    </div>

                    <div style={{ ...styles.formGroup, position: "relative" }}>
                      <label style={styles.formLabel}>Filing Country</label>
                      <input
                        type="text"
                        name="filling_country"
                        style={styles.formInput}
                        autoComplete="off"
                        value={formData.filling_country}
                        onChange={handleInputChange}
                      />
                      {suggestions.length > 0 && (
                        <div style={styles.suggestionBox}>
                          {suggestions.map((s, i) => (
                            <div
                              key={i}
                              style={styles.suggestionItem}
                              onClick={() =>
                                selectSuggestion("filling_country", s)
                              }
                            >
                              {s.code} {s.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Filing Date</label>
                      <input
                        type="date"
                        name="filling_date"
                        style={styles.formInput}
                        value={
                          formData.filling_date
                            ? formData.filling_date.split("T")[0]
                            : ""
                        }
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        PCT/Application No.
                      </label>
                      <input
                        type="text"
                        name="application_no"
                        style={styles.formInput}
                        value={formData.application_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>Applicant Type</label>
                      <select
                        name="applicant_type"
                        style={styles.formSelect}
                        value={formData.applicant_type}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Status</option>
                        <option value="Natural person">Natural person</option>
                        <option value="Start-up">Start-up</option>
                        <option value="Small entity">Small entity</option>
                        <option value="Educational institution">
                          Educational institution
                        </option>
                        <option value="Others">Others (Large Entity)</option>
                      </select>
                    </div>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.formLabel}>Title</label>
                      <input
                        type="text"
                        name="title"
                        style={styles.formInput}
                        value={formData.title}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px",
                        gridColumn: "span 2",
                      }}
                    >
                      {/* 🔹 Column 1 — Document Type */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            fontWeight: "500",
                            marginBottom: "4px",
                          }}
                        >
                          Document Type *
                        </label>

                        <select
                          value={pendingDocType}
                          onChange={(e) => setPendingDocType(e.target.value)}
                          style={{
                            ...styles.formSelect,
                            width: "100%",
                          }}
                        >
                          <option value="">-- Select Type --</option>
                          <option value="Input">Input</option>
                          <option value="Internal">Internal</option>
                          <option value="Output">Output</option>
                        </select>
                      </div>

                      {/* 🔹 Column 2 — Attach Files */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <label
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            fontWeight: "500",
                            marginBottom: "4px",
                          }}
                        >
                          Documents
                        </label>

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
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            padding: "8px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            backgroundColor: "#f3f4f6",
                            cursor: "pointer",
                            fontSize: "13px",
                            height: "38px",
                          }}
                        >
                          <Paperclip size={14} /> Attach Files
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Existing Files (if opening modal in Edit/Replica mode) */}
                  {formData.files && formData.files.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <small style={{ color: "#666" }}>Existing:</small>
                      {renderFileList(formData.files, true, formData._id)}
                    </div>
                  )}

                  {/* Newly Uploaded Files (Shows immediately after Uppy upload) */}
                  {newlyUploadedFiles.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <small style={{ color: "green" }}>Ready to save:</small>
                      {renderFileList(newlyUploadedFiles, false)}
                    </div>
                  )}
                </div>
              </div>
              {/* Find this button at the bottom of the Create/Edit Modal form */}
              <button
                type="submit"
                style={{
                  ...styles.submitBtn,
                  opacity: isUploading || isSubmitting ? 0.6 : 1,
                  cursor:
                    isUploading || isSubmitting ? "not-allowed" : "pointer",
                }}
                disabled={isUploading || isSubmitting}
              >
                {isSubmitting
                  ? "Submitting..."
                  : isUploading
                    ? "Uploading Files..."
                    : "Submit"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* UPPY MODAL */}
      <DashboardModal
        uppy={uppy}
        open={isUppyModalOpen}
        // 👇 UPDATE THIS FUNCTION
        onRequestClose={() => {
          uppy.cancelAll();
          setIsUppyModalOpen(false);
        }}
        closeModalOnClickOutside={false}
        theme="light"
        note="Files are uploaded immediately. Click 'Submit' to save changes."
      />

      {timelineDocket && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: "600px" }}>
            <div style={styles.modalHeader}>
              <h5 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                Stage Timeline
              </h5>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setTimelineDocket(null)}
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
                Docket: <strong>{timelineDocket.docket_no}</strong>
                &nbsp;|&nbsp; Status:{" "}
                <strong>
                  {timelineDocket.application_status || "Pending"}
                </strong>
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
                  { label: "Preparation", step: "Prepared" },
                  { label: "Review", step: "Reviewed" },
                  { label: "Final Review", step: "Final Reviewed" },
                ].map(({ label, step }, i, arr) => {
                  const done =
                    getTimelineStatus(timelineDocket.sub_status, step) ===
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
};
const styles = {
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },

  // --- NEW SMART HEADER ROW LAYOUT ---
  tableHeaderRow: {
    display: "flex",
    alignItems: "flex-end", // Aligns the bottoms of inputs and buttons
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    marginBottom: "20px",
    flexWrap: "nowrap", // Forces everything into one row
    overflowX: "auto", // Adds graceful scrolling on very tiny screens
    paddingBottom: "4px", // Prevent scrollbar cutting off shadows
  },
  filtersWrapper: {
    display: "flex",
    gap: "8px",
    flex: "1 1 auto", // Allows filters to grow and shrink intelligently
    minWidth: 0, // Prevents flex items from breaking layout on small screens
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1 1 0", // All inputs will distribute space equally
    minWidth: "100px", // Won't let them squeeze down past usability
  },
  filterLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#4b5563",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis", // If label is long, trims with "..."
  },
  filterInput: {
    width: "100%",
    boxSizing: "border-box", // Essential for exact width
    padding: "0 8px",
    fontSize: "12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    height: "36px", // Match the button height perfectly
    backgroundColor: "#fff",
    color: "#374151",
    outline: "none",
  },
  actionButtons: {
    display: "flex",
    gap: "6px",
    flexShrink: 0, // Prevents buttons from getting squished by inputs
  },

  // --- SQUARE ICON BUTTON DESIGNS ---
  createBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: "0",
    borderRadius: "6px",
    backgroundColor: "#f97316",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  importBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: "0",
    borderRadius: "6px",
    backgroundColor: "#10b981",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: "0",
    borderRadius: "6px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  templateBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: "0",
    borderRadius: "6px",
    backgroundColor: "#6b7280",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },

  viewAllBtn: {
    padding: "0 20px",
    height: "36px",
    backgroundColor: "#fff",
    color: "#6b7280",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // --- EXISTING STYLES (Untouched) ---
  tableWrapper: {
    overflowX: "auto",
    overflowY: "auto",
    maxHeight: "calc(100vh - 320px)", // ← KEY CHANGE: dynamic height based on viewport
    minHeight: "200px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    backgroundColor: "#f9fafb", // Must set background or content will show through
    zIndex: 10,
    boxShadow: "0 2px 2px -1px rgba(0, 0, 0, 0.1)", // Optional: shadow to separate header
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
  viewIcon: { color: "#22c55e", fontSize: "10px" },
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
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    width: "90%",
    height: "97vh",
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    borderBottom: "1px solid #f3f4f6",
  },
  tabsContainer: { display: "flex", gap: "5px" },
  tabBtn: {
    padding: "8px 16px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e5e7eb",
    borderRadius: "6px",
    backgroundColor: "#fff",
    cursor: "pointer",
    fontSize: "13px",
    color: "#6b7280",
  },
  tabBtnActive: {
    backgroundColor: "#f97316",
    color: "#fff",
    borderColor: "#f97316",
  },
  closeBtn: {
    width: "32px",
    height: "32px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#fee2e2",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: "14px",
  },
  detailBody: { padding: "50px" },
  detailRow: { margin: "0 0 12px 0", fontSize: "14px", color: "#374151" },
  statusBadgeDetail: {
    padding: "4px 10px",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: "4px",
    fontSize: "12px",
  },
  actionBtn: {
    padding: "10px 20px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  replicaBtn: {
    padding: "10px 20px",
    backgroundColor: "#6b7280",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  deleteBtn: {
    padding: "10px 20px",
    backgroundColor: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    width: "95%",
    maxWidth: "1100px",
    maxHeight: "95vh",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
    borderBottom: "1px solid #f3f4f6",
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
  sectionTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#111827",
    margin: "0 0 15px 0",
    paddingBottom: "10px",
    borderBottom: "1px solid #f3f4f6",
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
  },
  formSelect: {
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
    maxHeight: "150px",
    overflowY: "auto",
    backgroundColor: "#fff",
    zIndex: 10,
    borderRadius: "6px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
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
  iconBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    padding: "0",
    borderRadius: "6px",
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    color: "#4b5563",
    cursor: "pointer",
    transition: "all 0.2s",
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
    transition: "all 0.2s ease",
  },
};

const sectionTabStyles = {
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    padding: "0 20px",
    gap: 0,
    overflowX: "auto",
  },
  tab: {
    padding: "14px 18px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    color: "#6b7280",
    borderBottom: "2px solid transparent",
    whiteSpace: "nowrap",
  },
  tabActive: {
    color: "#f97316",
    borderBottom: "2px solid #f97316",
    fontWeight: "600",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px 32px",
  },
  fieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "10px 0",
    borderBottom: "1px solid rgb(226 227 227)",
  },
  fieldLabel: {
    fontSize: "12px",
    color: "#9ca3af",
    fontWeight: "500",
  },
  fieldValue: {
    fontSize: "14px",
    color: "#374151",
  },
  fieldValueBold: {
    fontSize: "14px",
    color: "#111827",
    fontWeight: "600",
  },
  fieldValueBox: {
    padding: "12px 16px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#374151",
    border: "1px solid #f3f4f6",
  },
  fieldBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  statusPill: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    backgroundColor: "#fff7ed",
    color: "#c2410c",
    fontSize: "12px",
    fontWeight: "600",
    border: "1px solid #fed7aa",
  },
  typeBadge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "4px",
    backgroundColor: "#eff6ff",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: "500",
  },
  sectionSubTitle: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    margin: "0 0 12px 0",
    paddingBottom: "8px",
    borderBottom: "1px solid #f3f4f6",
  },
  feeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  feeCard: {
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: "#f9fafb",
    border: "1px solid #f3f4f6",
  },
  feeCardHighlight: {
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
  },
  feeLabelText: {
    fontSize: "12px",
    color: "#9ca3af",
    marginBottom: 6,
  },
  feeAmount: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#111827",
  },
  docsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  docItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    border: "1px solid #f3f4f6",
  },
  docDownloadBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#9ca3af",
    fontSize: "16px",
  },
  partyCard: {
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    backgroundColor: "#fff",
  },
  partyCardHeader: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  partyIcon: {
    fontSize: "16px",
  },
  newBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    backgroundColor: "#f97316",
    color: "#fff",
    borderRadius: "4px",
    marginLeft: 6,
  },
  innerTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  },
  innerTh: {
    textAlign: "left",
    padding: "10px 12px",
    color: "#6b7280",
    fontWeight: "600",
    fontSize: "12px",
    borderBottom: "1px solid #e5e7eb",
  },
  innerTd: {
    padding: "12px 12px",
    color: "#374151",
  },
  emptyState: {
    textAlign: "center",
    padding: "50px",
    color: "#9ca3af",
    fontSize: "14px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
  },
};

export default DocketPage;
