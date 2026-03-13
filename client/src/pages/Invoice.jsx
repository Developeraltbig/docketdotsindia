import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Eye,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  Plus,
  Landmark,
  RotateCw,
  Pencil,
  Copy,
  ChevronDown,
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
import html2pdf from "html2pdf.js";

// ── DOWNLOAD DROPDOWN COMPONENT ──────────────────────────────────────────────
const DownloadDropdown = ({ onDownloadPDF, onDownloadWord }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (e) => {
      if (!e.target.closest(".download-dropdown")) setOpen(false);
    };
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div
      className="download-dropdown"
      style={{ position: "relative", display: "inline-block" }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          color: "#3b82f6",
          cursor: "pointer",
          fontWeight: "500",
          fontSize: "12px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <Download size={14} />
        <ChevronDown size={10} />
      </span>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "4px",
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 50,
            minWidth: "120px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#f97316",
              borderBottom: "1px solid #f3f4f6",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#fff7ed")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDownloadPDF();
            }}
          >
            <FileText size={13} /> PDF
          </div>
          <div
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#2F4D84",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#eff6ff")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDownloadWord();
            }}
          >
            <FileText size={13} /> DOCX
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// INVOICE PAGE COMPONENT
// ============================================================
const InvoicePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateStats } = useAuthStore();

  // --- STATE ---
  const [viewMode, setViewMode] = useState("dashboard"); // dashboard | detail
  const [detailTab, setDetailTab] = useState("view"); // view | edit
  const [showModal, setShowModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 10;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [records, setRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [dockets, setDockets] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [cameFromExternal, setCameFromExternal] = useState(false);

  // ── BANK DETAILS MASTER LIST ──────────────────────────────────────────────
  const [bankDetailsList, setBankDetailsList] = useState([]);

  const [statsCounts, setStatsCounts] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    revenue: 0,
  });

  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    invoice_no: "",
    client_id: "",
    status: "",
  });

  const initialFormState = {
    invoice_no: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    status: "Draft",
    docket_id: "",
    docket_no: "",
    client_name: "",
    client_id: "",
    client_ref: "",
    spoc_name: "",
    phone_no: "",
    firm_name: "",
    country: "",
    email: "",
    address: "",
    application_type: "",
    application_number: "",
    application_no: "",
    corresponding_application_no: "",
    title: "",
    filling_country: "",
    worktype: "",
    currency: "INR",
    anovipfee: 0,
    associatefee: 0,
    officialfee: 0,
    fee: 0,
    gst_percentage: 18,
    gst_amount: 0,
    total_with_gst: 0,
    bank_detail_id: "",
    bank_name: "",
    bank_address: "",
    beneficiary_account_name: "",
    account_no: "",
    swift_code: "",
    ifsc_code: "",
    paypal: "",
    notes: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  const location = useLocation();
  const handleResetFilters = () => {
    const cleanPath = window.location.origin + location.pathname;
    window.location.href = cleanPath;
  };
  const [serviceFeesList, setServiceFeesList] = useState([]);

  const fetchServiceFees = async () => {
    const res = await axios.get("/api/service-fees/active");
    setServiceFeesList(res.data || []);
  };
  useEffect(() => {
    if (location.state?.viewRecord) {
      setSelectedRecord(location.state.viewRecord);
      setViewMode("detail");
      setDetailTab("view");
      setCameFromExternal(true);
    }
  }, [location.state]);

  // --- FETCH FUNCTIONS ---
  const fetchStatsCounts = async () => {
    try {
      const res = await axios.get("/api/invoices/status-counts");
      setStatsCounts(res.data);
    } catch (err) {
      console.error("Failed to fetch invoice stats", err);
    }
  };

  const fetchInvoices = async () => {
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

      const res = await axios.get(`/api/invoices?${params.toString()}`);
      const invoicesData = res.data.invoices || res.data.data || [];
      setRecords(invoicesData);
      const total =
        res.data.totalRecords ||
        res.data.total ||
        res.data.count ||
        invoicesData.length;
      setTotalRecords(total);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error fetching invoices.");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get("/api/auth/clients");
      setClients(res.data);
    } catch (err) {
      console.error("Failed to fetch clients", err);
    }
  };

  const fetchDockets = async () => {
    try {
      const res = await axios.get("/api/dockets?limit=9999");
      setDockets(res.data.dockets || res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch dockets", err);
    }
  };

  // ── FETCH BANK DETAILS MASTER LIST ───────────────────────────────────────
  const fetchBankDetailsList = async () => {
    try {
      const res = await axios.get("/api/bank-details/all");
      setBankDetailsList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch bank details list", err);
    }
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await axios.get("/api/invoices/next-number");
      return res.data.invoice_no;
    } catch (err) {
      console.error("Failed to get next invoice number", err);
      return `INV-${Date.now()}`;
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    fetchClients();
    fetchDockets();
    fetchStatsCounts();
    fetchBankDetailsList();
    fetchServiceFees(); // ← add this
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [filters, currentPage, sortConfig]);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    const newStatus = statusParam === "all" || !statusParam ? "" : statusParam;
    setFilters((prev) => {
      if (prev.status === newStatus) return prev;
      return { ...prev, status: newStatus };
    });
    setCurrentPage(1);
  }, [searchParams]);

  // Auto-calculate fees
  useEffect(() => {
    const anovip = parseFloat(formData.anovipfee) || 0;
    const associate = parseFloat(formData.associatefee) || 0;
    const official = parseFloat(formData.officialfee) || 0;
    const fee = Math.round(anovip + associate + official);
    const gstPct = parseFloat(formData.gst_percentage) || 0;
    const gstAmt = Math.round(fee * (gstPct / 100));
    setFormData((prev) => ({
      ...prev,
      fee,
      gst_amount: gstAmt,
      total_with_gst: fee + gstAmt,
    }));
  }, [
    formData.anovipfee,
    formData.associatefee,
    formData.officialfee,
    formData.gst_percentage,
  ]);

  // Browser back button handling
  useEffect(() => {
    if (viewMode === "detail" && !cameFromExternal) {
      window.history.pushState({ viewMode: "detail" }, "");
    }
  }, [viewMode, cameFromExternal]);

  useEffect(() => {
    const handlePopState = () => {
      if (viewMode === "detail") {
        if (cameFromExternal) {
          navigate(-1);
        } else {
          setViewMode("dashboard");
          setSelectedRecord(null);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [viewMode, cameFromExternal, navigate]);

  // --- HANDLERS ---
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setCurrentPage(1);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // ── BANK SELECT HANDLER (Create Modal) ───────────────────────────────────
  const handleBankSelect = (bankId) => {
    if (!bankId) {
      setFormData((prev) => ({
        ...prev,
        bank_detail_id: "",
        bank_name: "",
        bank_address: "",
        beneficiary_account_name: "",
        account_no: "",
        swift_code: "",
        ifsc_code: "",
        paypal: "",
      }));
      return;
    }
    const bank = bankDetailsList.find((b) => b._id === bankId);
    if (!bank) return;
    setFormData((prev) => ({
      ...prev,
      bank_detail_id: bank._id,
      bank_name: bank.bank_name || "",
      bank_address: bank.bank_address || "",
      beneficiary_account_name: bank.beneficiary_account_name || "",
      account_no: bank.account_no || "",
      swift_code: bank.swift_code || "",
      ifsc_code: bank.ifsc_code || "",
      paypal: bank.paypal || "",
    }));
    toast.success("Bank details pre-filled!");
  };

  // ── BANK SELECT HANDLER (Edit / Detail Tab) ───────────────────────────────
  const handleBankSelectDetail = (bankId) => {
    if (!bankId) {
      setSelectedRecord((prev) => ({
        ...prev,
        bank_detail_id: "",
        bank_name: "",
        bank_address: "",
        beneficiary_account_name: "",
        account_no: "",
        swift_code: "",
        ifsc_code: "",
        paypal: "",
      }));
      return;
    }
    const bank = bankDetailsList.find((b) => b._id === bankId);
    if (!bank) return;
    setSelectedRecord((prev) => ({
      ...prev,
      bank_detail_id: bank._id,
      bank_name: bank.bank_name || "",
      bank_address: bank.bank_address || "",
      beneficiary_account_name: bank.beneficiary_account_name || "",
      account_no: bank.account_no || "",
      swift_code: bank.swift_code || "",
      ifsc_code: bank.ifsc_code || "",
      paypal: bank.paypal || "",
    }));
    toast.success("Bank details pre-filled!");
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

  const handleDocketSelect = async (docketId) => {
    if (!docketId) return;
    try {
      const res = await axios.get(`/api/invoices/docket-lookup/${docketId}`);
      const d = res.data;
      let cId = "",
        cName = "";
      if (d.client_id && typeof d.client_id === "object") {
        cId = d.client_id._id;
        cName = d.client_id.name;
      } else {
        cId = d.client_id;
        const foundClient = clients.find((c) => c._id === cId);
        if (foundClient) cName = foundClient.name;
      }

      // ── NEW: look up service fee by service_name ──
      const service = serviceFeesList.find(
        (s) => s.service_name === d.service_name,
      );
      const officialFee = service
        ? getOfficialFee(service, d.applicant_type)
        : d.officialfee || 0;
      const anovipFee = service ? service.our_fee : d.anovipfee || 0;

      setFormData((prev) => ({
        ...prev,
        docket_id: d._id,
        docket_no: d.docket_no || "",
        client_id: cId,
        client_name: cName,
        client_ref: d.client_ref || "",
        spoc_name: d.spoc_name || "",
        phone_no: d.phone_no || "",
        firm_name: d.firm_name || "",
        country: d.country || "",
        email: d.email || "",
        address: d.address || "",
        application_type: d.application_type || "",
        application_number: d.application_number || "",
        application_no: d.application_no || "",
        corresponding_application_no: d.corresponding_application_no || "",
        title: d.title || "",
        filling_country: d.filling_country || "",
        currency: d.currency || "INR",
        worktype: d.service_name || "", // ← auto-fill worktype
        officialfee: officialFee, // ← recalculated
        anovipfee: anovipFee, // ← from service fee
        associatefee: d.associatefee || 0,
        fee: d.fee || 0,
      }));
      toast.success("Docket data loaded!");
    } catch (err) {
      toast.error("Failed to load docket data");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (formData._id) {
        const res = await axios.put(`/api/invoices/${formData._id}`, formData);
        setRecords((prev) =>
          prev.map((r) => (r._id === formData._id ? res.data.data : r)),
        );
        toast.success("Invoice updated successfully");
      } else {
        const res = await axios.post("/api/invoices", formData);
        setRecords((prev) => [res.data.data, ...prev]);
        setTotalRecords((prev) => prev + 1);
        toast.success("Invoice created successfully");
      }
      setShowModal(false);
      setFormData(initialFormState);
      fetchStatsCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error saving invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- REPLICA HANDLER ---
  const handleReplica = async (record) => {
    // Get a new invoice number for the copy
    const nextNo = await fetchNextInvoiceNumber();

    // Remove _id, timestamps, and version fields
    const { _id, createdAt, updatedAt, __v, ...replicaData } = record;

    // Clean up client_id if it's a populated object
    let clientId = "";
    let clientName = "";
    if (replicaData.client_id && typeof replicaData.client_id === "object") {
      clientId = replicaData.client_id._id;
      clientName = replicaData.client_id.name;
    } else {
      clientId = replicaData.client_id || "";
      const foundClient = clients.find((c) => c._id === clientId);
      clientName = foundClient
        ? foundClient.name
        : replicaData.client_name || "";
    }

    // Clean null date fields
    const cleanedData = { ...replicaData };
    if (cleanedData.invoice_date === null) cleanedData.invoice_date = "";
    if (cleanedData.due_date === null) cleanedData.due_date = "";

    // Format dates
    if (cleanedData.invoice_date)
      cleanedData.invoice_date = cleanedData.invoice_date.split("T")[0];
    if (cleanedData.due_date)
      cleanedData.due_date = cleanedData.due_date.split("T")[0];

    setFormData({
      ...initialFormState,
      ...cleanedData,
      invoice_no: nextNo, // New invoice number
      status: "Draft", // Reset status to Draft
      client_id: clientId,
      client_name: clientName,
      invoice_date: new Date().toISOString().split("T")[0], // Today's date
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setDeleteTaskId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/invoices/${deleteTaskId}`);
      setRecords((prev) => prev.filter((r) => r._id !== deleteTaskId));
      setTotalRecords((prev) => prev - 1);
      toast.success("Invoice deleted");
      setViewMode("dashboard");
      setSelectedRecord(null);
      fetchStatsCounts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setShowDeleteModal(false);
      setDeleteTaskId(null);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(records.map((r) => r._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} invoices?`)) return;
    try {
      await Promise.all(
        selectedIds.map((id) => axios.delete(`/api/invoices/${id}`)),
      );
      toast.success("Invoices deleted");
      setSelectedIds([]);
      fetchInvoices();
      fetchStatsCounts();
    } catch (err) {
      toast.error("Error deleting invoices");
    }
  };

  const handleExport = () => {
    const dataToExport =
      selectedIds.length > 0
        ? records.filter((r) => selectedIds.includes(r._id))
        : records;
    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }
    const exportData = dataToExport.map((r, i) => {
      const client = clients.find(
        (c) => c._id === (r.client_id?._id || r.client_id),
      );
      return {
        "Sr No": i + 1,
        "Invoice No": r.invoice_no || "",
        "Docket Ref": r.docket_no || "",
        Client: client ? client.name : r.client_id?.name || "",
        "Invoice Date": r.invoice_date
          ? new Date(r.invoice_date).toLocaleDateString()
          : "",
        "Due Date": r.due_date ? new Date(r.due_date).toLocaleDateString() : "",
        Currency: r.currency || "",
        Amount: r.fee || 0,
        "GST (%)": r.gst_percentage || 0,
        "GST Amount": r.gst_amount || 0,
        Total: r.total_with_gst || 0,
        Status: r.status || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;
    XLSX.writeFile(
      wb,
      `invoices_export_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(`Exported ${exportData.length} records`);
  };

  const handleDownloadPDF = async (invoiceId) => {
    const toastId = toast.loading("Generating PDF...");
    try {
      const res = await axios.get(`/api/invoices/${invoiceId}/pdf`);
      const htmlContent = res.data.html;
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const element = document.createElement("div");
      element.style.width = "100%";
      const styles = doc.querySelectorAll("style");
      styles.forEach((style) => {
        element.appendChild(style.cloneNode(true));
      });
      element.innerHTML += doc.body.innerHTML;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Invoice_${selectedRecord?.invoice_no || invoiceId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      await html2pdf().set(opt).from(element).save();
      toast.update(toastId, {
        render: "PDF Downloaded",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
    } catch (err) {
      console.error("PDF Gen Error:", err);
      toast.update(toastId, {
        render: "Failed to generate PDF",
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
    }
  };

  const handleDownloadWord = async (invoiceId) => {
    try {
      window.open(`/api/invoices/${invoiceId}/word`, "_blank");
    } catch (err) {
      toast.error("Failed to download Word doc");
    }
  };

  const handleUpdateInDetail = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `/api/invoices/${selectedRecord._id}`,
        selectedRecord,
      );
      const updatedRecord = res.data.data;
      setRecords((prev) =>
        prev.map((r) => (r._id === selectedRecord._id ? updatedRecord : r)),
      );
      setSelectedRecord(updatedRecord);
      setDetailTab("view");
      fetchStatsCounts();
      toast.success("Invoice updated");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Update failed");
    }
  };

  // --- HELPERS ---
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

  const formatCurrency = (amount, currency = "INR") => {
    const sym =
      currency === "INR"
        ? "₹"
        : currency === "USD"
          ? "$"
          : currency === "EUR"
            ? "€"
            : "";
    return `${sym}${Number(amount || 0).toLocaleString()}`;
  };

  const formatRevenueShort = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getStatusBadge = (status) => {
    const map = {
      Draft: { bg: "#f3f4f6", color: "#374151", dot: "#9ca3af" },
      Sent: { bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" },
      Paid: { bg: "#dcfce7", color: "#15803d", dot: "#22c55e" },
      Overdue: { bg: "#fee2e2", color: "#dc2626", dot: "#ef4444" },
      Cancelled: { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af" },
    };
    const s = map[status] || map.Draft;
    return (
      <span
        style={{
          padding: "4px 12px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: 500,
          backgroundColor: s.bg,
          color: s.color,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: s.dot,
          }}
        />
        {status}
      </span>
    );
  };

  const getClientName = (record) => {
    if (record.client_id?.name) return record.client_id.name;
    const client = clients.find(
      (c) => c._id === (record.client_id?._id || record.client_id),
    );
    return client ? client.name : "-";
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  // --- STATS ---
  const invoiceStats = [
    {
      title: "Draft",
      count: statsCounts.draft,
      icon: <DocketIcon />,
      link: "/invoice?status=Draft",
    },
    {
      title: "Sent",
      count: statsCounts.sent,
      icon: <ApplicationIcon />,
      status: "Active",
      link: "/invoice?status=Sent",
    },
    {
      title: "Paid",
      count: statsCounts.paid,
      icon: <ApplicationIcon />,
      status: "Active",
      link: "/invoice?status=Paid",
    },
    {
      title: "Overdue",
      count: statsCounts.overdue,
      icon: <DeadlineIcon />,
      status: "Active",
      link: "/invoice?status=Overdue",
    },
    {
      title: "Revenue",
      count: formatRevenueShort(statsCounts.revenue),
      icon: <DocketIcon />,
      link: "/invoice?status=all",
    },
  ];

  // ── BANK SELECT DROPDOWN (reusable UI) ───────────────────────────────────
  const BankSelectDropdown = ({
    value,
    onChange,
    label = "Select Bank (Auto-fill Details)",
  }) => (
    <div
      style={{
        ...stylesObj.formGroup,
        gridColumn: "span 2",
        backgroundColor: "#eff6ff",
        padding: "12px",
        borderRadius: "8px",
        border: "1px solid #3b82f6",
      }}
    >
      <label
        style={{
          ...stylesObj.formLabel,
          color: "#1d4ed8",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <Landmark size={14} />
        {label}
      </label>
      <select
        style={{ ...stylesObj.formSelect, borderColor: "#3b82f6" }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Select Bank to Pre-fill --</option>
        {bankDetailsList.map((b) => (
          <option key={b._id} value={b._id}>
            {b.bank_name}
            {b.account_no ? ` — A/C: ${b.account_no}` : ""}
            {b.beneficiary_account_name
              ? ` (${b.beneficiary_account_name})`
              : ""}
          </option>
        ))}
      </select>
      {bankDetailsList.length === 0 && (
        <small style={{ color: "#6b7280", marginTop: "4px" }}>
          No bank masters found. Add banks in User Management → Bank Details
          tab.
        </small>
      )}
    </div>
  );

  // ── SEARCHABLE DOCKET SELECT ─────────────────────────────────────────────
  const SearchableDocketSelect = ({ dockets, value, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    // Sync input text with the selected docket
    useEffect(() => {
      if (value) {
        const selected = dockets.find((d) => d._id === value);
        if (selected) {
          setSearchTerm(
            `${selected.docket_no} — ${selected.title || "No Title"}`,
          );
        }
      } else {
        setSearchTerm("");
      }
    }, [value, dockets]);

    // Filter list based on input
    const filtered = dockets.filter((d) => {
      const query = searchTerm.toLowerCase();
      const docketNo = (d.docket_no || "").toLowerCase();
      const title = (d.title || "").toLowerCase();
      return docketNo.includes(query) || title.includes(query);
    });

    // Handle click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = () => setIsOpen(false);
      if (isOpen) document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }, [isOpen]);

    return (
      <div
        style={{ position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          style={{
            ...stylesObj.formInput,
            width: "100%",
            borderColor: "#fbbf24",
            boxSizing: "border-box",
            backgroundColor: "#fff",
          }}
          placeholder="Type to search docket..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (e.target.value === "") onSelect(""); // clear selection if empty
          }}
          onClick={() => setIsOpen(true)}
        />
        {isOpen && (
          <ul
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              maxHeight: "220px",
              overflowY: "auto",
              backgroundColor: "#fff",
              border: "1px solid #fbbf24",
              borderRadius: "6px",
              zIndex: 50,
              padding: 0,
              margin: "4px 0 0 0",
              listStyle: "none",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
          >
            {filtered.length === 0 ? (
              <li
                style={{
                  padding: "10px 12px",
                  color: "#6b7280",
                  fontSize: "13px",
                }}
              >
                No dockets found
              </li>
            ) : (
              filtered.map((d) => (
                <li
                  key={d._id}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    fontSize: "13px",
                    borderBottom: "1px solid #f3f4f6",
                    transition: "background-color 0.2s",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(d._id);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.backgroundColor = "#fffbeb")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.backgroundColor = "transparent")
                  }
                >
                  <strong>{d.docket_no}</strong> — {d.title || "No Title"}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={stylesObj.container}>
      {viewMode === "dashboard" ? (
        <>
          <StatsRow items={invoiceStats} />

          {/* TABLE CARD */}
          <div style={stylesObj.tableCard}>
            {/* FILTERS */}
            <div style={stylesObj.tableHeaderRow}>
              <div style={stylesObj.filterGroup}>
                <label style={stylesObj.filterLabel}>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  style={stylesObj.filterInput}
                  value={filters.start_date}
                  onChange={handleFilterChange}
                />
              </div>
              <div style={stylesObj.filterGroup}>
                <label style={stylesObj.filterLabel}>End Date</label>
                <input
                  type="date"
                  name="end_date"
                  style={stylesObj.filterInput}
                  value={filters.end_date}
                  onChange={handleFilterChange}
                />
              </div>
              <div style={stylesObj.filterGroup}>
                <label style={stylesObj.filterLabel}>Invoice No.</label>
                <input
                  type="text"
                  name="invoice_no"
                  style={stylesObj.filterInput}
                  placeholder="Search..."
                  value={filters.invoice_no}
                  onChange={handleFilterChange}
                />
              </div>
              <div style={stylesObj.filterGroup}>
                <label style={stylesObj.filterLabel}>Client</label>
                <select
                  name="client_id"
                  style={stylesObj.filterInput}
                  value={filters.client_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={stylesObj.filterGroup}>
                <label style={stylesObj.filterLabel}>Status</label>
                <select
                  name="status"
                  style={stylesObj.filterInput}
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Paid">Paid</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <button
                style={stylesObj.collapseBtn}
                onClick={handleResetFilters}
              >
                <RotateCw size={18} />
              </button>
              <button
                style={stylesObj.createBtn}
                onClick={async () => {
                  const nextNo = await fetchNextInvoiceNumber();
                  setFormData({
                    ...initialFormState,
                    invoice_no: nextNo,
                  });
                  setShowModal(true);
                }}
              >
                <Plus size={16} style={{ marginRight: 4 }} />
              </button>
              {/* <button style={stylesObj.exportBtn} onClick={handleExport}>
                <Download size={16} />
              </button> */}
            </div>

            {/* BULK ACTION BAR */}
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
                  style={{ ...stylesObj.deleteBtn, padding: "6px 12px" }}
                >
                  <Trash2 size={14} style={{ marginRight: 5 }} />
                </button>
                <button
                  onClick={handleExport}
                  style={{ ...stylesObj.exportBtn, padding: "8px 12px" }}
                >
                  <Download size={14} style={{ marginRight: 5 }} />
                </button>
              </div>
            )}

            {/* TABLE */}
            <div style={stylesObj.tableWrapper}>
              <table style={stylesObj.table}>
                <thead>
                  <tr>
                    <th
                      style={{
                        ...stylesObj.th,
                        ...stylesObj.stickyHeader,
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
                    <th style={{ ...stylesObj.th, ...stylesObj.stickyHeader }}>
                      ACTION
                    </th>
                    <th style={{ ...stylesObj.th, ...stylesObj.stickyHeader }}>
                      #
                    </th>
                    <th
                      style={{
                        ...stylesObj.th,
                        ...stylesObj.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("invoice_no")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        INVOICE NO.
                        {sortConfig.key === "invoice_no" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>
                    <th
                      style={{
                        ...stylesObj.th,
                        ...stylesObj.stickyHeader,
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
                        DOCKET REF
                        {sortConfig.key === "docket_no" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>
                    <th
                      style={{
                        ...stylesObj.th,
                        ...stylesObj.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("client_id")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        CLIENT
                        {sortConfig.key === "client_id" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>
                    <th
                      style={{
                        ...stylesObj.th,
                        ...stylesObj.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("invoice_date")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        ISSUED
                        {sortConfig.key === "invoice_date" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>
                    <th
                      style={{
                        ...stylesObj.th,
                        ...stylesObj.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("due_date")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        DUE DATE
                        {sortConfig.key === "due_date" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>
                    <th style={{ ...stylesObj.th, ...stylesObj.stickyHeader }}>
                      AMOUNT
                    </th>
                    <th style={{ ...stylesObj.th, ...stylesObj.stickyHeader }}>
                      GST
                    </th>
                    <th style={{ ...stylesObj.th, ...stylesObj.stickyHeader }}>
                      TOTAL
                    </th>
                    <th style={{ ...stylesObj.th, ...stylesObj.stickyHeader }}>
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, index) => (
                    <tr
                      key={r._id}
                      style={{
                        ...stylesObj.tr,
                        backgroundColor: selectedIds.includes(r._id)
                          ? "#eff6ff"
                          : "transparent",
                      }}
                    >
                      <td style={stylesObj.td}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r._id)}
                          onChange={() => handleSelectRow(r._id)}
                        />
                      </td>
                      <td style={stylesObj.td}>
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
                            style={{ ...stylesObj.viewLink, color: "#f97316" }}
                            onClick={() => {
                              setSelectedRecord(r);
                              setViewMode("detail");
                              setDetailTab("edit");
                              setCameFromExternal(false);
                            }}
                          >
                            <Pencil size={14} />
                          </span>

                          {/* REPLICA BUTTON */}
                          <span
                            title="Replica"
                            style={{ ...stylesObj.viewLink, color: "#6b7280" }}
                            onClick={() => handleReplica(r)}
                          >
                            <Copy size={14} />
                          </span>

                          {/* DOWNLOAD DROPDOWN */}
                          <DownloadDropdown
                            onDownloadPDF={() => handleDownloadPDF(r._id)}
                            onDownloadWord={() => handleDownloadWord(r._id)}
                          />
                        </div>
                      </td>
                      <td style={stylesObj.td}>
                        {(currentPage - 1) * recordsPerPage + index + 1}
                      </td>
                      <td style={{ ...stylesObj.td, fontWeight: 600 }}>
                        {r.invoice_no}
                      </td>
                      <td style={stylesObj.td}>{r.docket_no || "-"}</td>
                      <td style={stylesObj.td}>{getClientName(r)}</td>
                      <td style={stylesObj.td}>{formatDate(r.invoice_date)}</td>
                      <td style={stylesObj.td}>{formatDate(r.due_date)}</td>
                      <td style={stylesObj.td}>
                        {formatCurrency(r.fee, r.currency)}
                      </td>
                      <td
                        style={{
                          ...stylesObj.td,
                          color: "#6b7280",
                          fontSize: "12px",
                        }}
                      >
                        {formatCurrency(r.gst_amount, r.currency)}
                      </td>
                      <td style={{ ...stylesObj.td, fontWeight: 600 }}>
                        {formatCurrency(r.total_with_gst, r.currency)}
                      </td>
                      <td style={stylesObj.td}>{getStatusBadge(r.status)}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="12" style={stylesObj.tdCenter}>
                        {loading ? "Loading..." : "No invoices found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
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
              <div style={stylesObj.pagination}>
                <span style={stylesObj.paginationInfo}>
                  Showing{" "}
                  <strong>
                    {totalRecords > 0
                      ? (currentPage - 1) * recordsPerPage + 1
                      : 0}
                    -{Math.min(currentPage * recordsPerPage, totalRecords)}
                  </strong>{" "}
                  of <strong>{totalRecords.toLocaleString()}</strong> invoices
                </span>
                <div style={stylesObj.paginationBtns}>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={!canGoPrev}
                    style={{
                      ...stylesObj.pageBtn,
                      opacity: !canGoPrev ? 0.5 : 1,
                      cursor: !canGoPrev ? "not-allowed" : "pointer",
                    }}
                  >
                    ←
                  </button>
                  {Array.from(
                    { length: Math.min(5, totalPages || 1) },
                    (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      return page;
                    },
                  ).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      style={{
                        ...stylesObj.pageBtn,
                        ...(currentPage === p ? stylesObj.pageBtnActive : {}),
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
                      ...stylesObj.pageBtn,
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
        /* ============================================================ */
        /* DETAIL VIEW */
        /* ============================================================ */
        <div style={stylesObj.modalOverlay}>
          <div style={stylesObj.detailCard}>
            <div style={stylesObj.detailHeader}>
              <div style={stylesObj.tabsContainer}>
                <button
                  style={{
                    ...stylesObj.tabBtn,
                    ...(detailTab === "view" ? stylesObj.tabBtnActive : {}),
                  }}
                  onClick={() => setDetailTab("view")}
                >
                  View
                </button>
                <button
                  style={{
                    ...stylesObj.tabBtn,
                    ...(detailTab === "edit" ? stylesObj.tabBtnActive : {}),
                  }}
                  onClick={() => setDetailTab("edit")}
                >
                  Edit
                </button>
              </div>
              <button
                style={stylesObj.closeBtn}
                onClick={() => {
                  setViewMode("dashboard");
                  setSelectedRecord(null);
                  setCameFromExternal(false);
                }}
              >
                ✕
              </button>
            </div>
            <div style={stylesObj.detailBody}>
              {detailTab === "view" ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "20px",
                    }}
                  >
                    <h4 style={{ margin: 0, color: "#111827" }}>
                      Invoice: {selectedRecord?.invoice_no}
                    </h4>
                    {getStatusBadge(selectedRecord?.status)}
                  </div>

                  {/* INVOICE DETAILS */}
                  <div style={{ marginBottom: "25px" }}>
                    <h6 style={stylesObj.viewSectionTitle}>Invoice Details</h6>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <p style={stylesObj.detailRow}>
                        <strong>Invoice No:</strong>{" "}
                        {selectedRecord?.invoice_no || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Docket No:</strong>{" "}
                        {selectedRecord?.docket_no || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Invoice Date:</strong>{" "}
                        {formatDate(selectedRecord?.invoice_date)}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Due Date:</strong>{" "}
                        {formatDate(selectedRecord?.due_date)}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Worktype:</strong>{" "}
                        {selectedRecord?.worktype || "-"}
                      </p>
                    </div>
                  </div>

                  {/* FEE DETAILS */}
                  <div style={{ marginBottom: "25px" }}>
                    <h6 style={stylesObj.viewSectionTitle}>Fee Details</h6>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <p style={stylesObj.detailRow}>
                        <strong>Currency:</strong>{" "}
                        {selectedRecord?.currency || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>anovIP Fee:</strong>{" "}
                        {formatCurrency(
                          selectedRecord?.anovipfee,
                          selectedRecord?.currency,
                        )}
                      </p>

                      <p style={stylesObj.detailRow}>
                        <strong>Official Fee:</strong>{" "}
                        {formatCurrency(
                          selectedRecord?.officialfee,
                          selectedRecord?.currency,
                        )}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Total Fee:</strong>{" "}
                        {formatCurrency(
                          selectedRecord?.fee,
                          selectedRecord?.currency,
                        )}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>
                          GST ({selectedRecord?.gst_percentage || 18}%):
                        </strong>{" "}
                        {formatCurrency(
                          selectedRecord?.gst_amount,
                          selectedRecord?.currency,
                        )}
                      </p>
                      <p
                        style={{
                          ...stylesObj.detailRow,
                          fontWeight: 600,
                          fontSize: "16px",
                        }}
                      >
                        <strong>Grand Total:</strong>{" "}
                        {formatCurrency(
                          selectedRecord?.total_with_gst,
                          selectedRecord?.currency,
                        )}
                      </p>
                    </div>
                  </div>

                  {/* APPLICATION DETAILS */}
                  <div style={{ marginBottom: "25px" }}>
                    <h6 style={stylesObj.viewSectionTitle}>
                      Application Details
                    </h6>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <p style={stylesObj.detailRow}>
                        <strong>Application Type:</strong>{" "}
                        {selectedRecord?.application_type || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Application Number:</strong>{" "}
                        {selectedRecord?.application_number || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>PCT/Application No:</strong>{" "}
                        {selectedRecord?.application_no || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Corresponding App No:</strong>{" "}
                        {selectedRecord?.corresponding_application_no || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Filing Country:</strong>{" "}
                        {selectedRecord?.filling_country || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Title:</strong> {selectedRecord?.title || "-"}
                      </p>
                    </div>
                  </div>

                  {/* CLIENT DETAILS */}
                  <div style={{ marginBottom: "25px" }}>
                    <h6 style={stylesObj.viewSectionTitle}>Client Details</h6>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <p style={stylesObj.detailRow}>
                        <strong>Client Ref:</strong>{" "}
                        {selectedRecord?.client_ref || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>SPOC Name:</strong>{" "}
                        {selectedRecord?.spoc_name || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Phone:</strong>{" "}
                        {selectedRecord?.phone_no || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Firm Name:</strong>{" "}
                        {selectedRecord?.firm_name || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Country:</strong>{" "}
                        {selectedRecord?.country || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Email:</strong> {selectedRecord?.email || "-"}
                      </p>
                      <p
                        style={{ ...stylesObj.detailRow, gridColumn: "span 2" }}
                      >
                        <strong>Address:</strong>{" "}
                        {selectedRecord?.address || "-"}
                      </p>
                    </div>
                  </div>

                  {/* BANK DETAILS */}
                  <div style={{ marginBottom: "25px" }}>
                    <h6 style={stylesObj.viewSectionTitle}>Bank Details</h6>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <p style={stylesObj.detailRow}>
                        <strong>Bank Name:</strong>{" "}
                        {selectedRecord?.bank_name || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Bank Address:</strong>{" "}
                        {selectedRecord?.bank_address || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Beneficiary Account:</strong>{" "}
                        {selectedRecord?.beneficiary_account_name || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Account No:</strong>{" "}
                        {selectedRecord?.account_no || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>Swift Code:</strong>{" "}
                        {selectedRecord?.swift_code || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>IFSC Code:</strong>{" "}
                        {selectedRecord?.ifsc_code || "-"}
                      </p>
                      <p style={stylesObj.detailRow}>
                        <strong>PayPal:</strong> {selectedRecord?.paypal || "-"}
                      </p>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div
                    style={{ marginTop: "30px", display: "flex", gap: "10px" }}
                  >
                    <button
                      style={stylesObj.actionBtn}
                      onClick={() => setDetailTab("edit")}
                    >
                      Edit
                    </button>
                    <button
                      style={{
                        ...stylesObj.actionBtn,
                        backgroundColor: "#f97316",
                      }}
                      onClick={() => handleDownloadPDF(selectedRecord._id)}
                    >
                      <FileText size={14} style={{ marginRight: 4 }} /> Download
                      PDF
                    </button>
                    <button
                      style={{
                        ...stylesObj.actionBtn,
                        backgroundColor: "#2F4D84",
                      }}
                      onClick={() => handleDownloadWord(selectedRecord._id)}
                    >
                      <FileText size={14} style={{ marginRight: 4 }} /> Word
                    </button>
                    <button
                      style={stylesObj.deleteBtn}
                      onClick={() => handleDelete(selectedRecord._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                /* EDIT TAB */
                <form onSubmit={handleUpdateInDetail}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "30px",
                    }}
                  >
                    {/* LEFT */}
                    <div>
                      <h6 style={stylesObj.sectionTitle}>Invoice Info</h6>
                      <div style={stylesObj.formGrid}>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>Invoice No</label>
                          <input
                            type="text"
                            style={{
                              ...stylesObj.formInput,
                              backgroundColor: "#f3f4f6",
                            }}
                            readOnly
                            value={selectedRecord?.invoice_no || ""}
                          />
                        </div>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>Status</label>
                          <select
                            style={stylesObj.formSelect}
                            value={selectedRecord?.status || "Draft"}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                status: e.target.value,
                              })
                            }
                          >
                            <option value="Draft">Draft</option>
                            <option value="Sent">Sent</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>
                            Invoice Date
                          </label>
                          <input
                            type="date"
                            style={stylesObj.formInput}
                            value={
                              selectedRecord?.invoice_date
                                ? selectedRecord.invoice_date.split("T")[0]
                                : ""
                            }
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                invoice_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>Due Date</label>
                          <input
                            type="date"
                            style={stylesObj.formInput}
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
                        <div
                          style={{
                            ...stylesObj.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={stylesObj.formLabel}>Work Type</label>
                          <select
                            name="worktype"
                            style={stylesObj.formSelect}
                            value={formData.worktype || ""}
                            onChange={handleInputChange}
                          >
                            <option value="">Select</option>
                            {serviceFeesList.map((s) => (
                              <option key={s._id} value={s.service_name}>
                                {s.service_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <h6
                        style={{ ...stylesObj.sectionTitle, marginTop: "25px" }}
                      >
                        Fee Details
                      </h6>
                      <div style={stylesObj.formGrid}>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>Currency</label>
                          <select
                            style={stylesObj.formSelect}
                            value={selectedRecord?.currency || "INR"}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                currency: e.target.value,
                              })
                            }
                          >
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>anovIP Fee</label>
                          <input
                            type="number"
                            style={stylesObj.formInput}
                            value={selectedRecord?.anovipfee || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                anovipfee: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>
                            Official Fee
                          </label>
                          <input
                            type="number"
                            style={stylesObj.formInput}
                            value={selectedRecord?.officialfee || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                officialfee: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>Total Fee</label>
                          <input
                            type="text"
                            style={{
                              ...stylesObj.formInput,
                              backgroundColor: "#f3f4f6",
                            }}
                            readOnly
                            value={selectedRecord?.fee || 0}
                          />
                        </div>
                        <div style={stylesObj.formGroup}>
                          <label style={stylesObj.formLabel}>GST %</label>
                          <input
                            type="number"
                            style={stylesObj.formInput}
                            value={selectedRecord?.gst_percentage || 18}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                gst_percentage: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {/* RIGHT */}
                    <div>
                      <h6 style={stylesObj.sectionTitle}>Client Details</h6>
                      <div style={stylesObj.formGrid}>
                        <div
                          style={{
                            ...stylesObj.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={stylesObj.formLabel}>Client Name</label>
                          <input
                            type="text"
                            style={{
                              ...stylesObj.formInput,
                              backgroundColor: "#f3f4f6",
                            }}
                            readOnly
                            value={
                              selectedRecord?.client_name ||
                              selectedRecord?.client_id?.name ||
                              ""
                            }
                          />
                        </div>
                      </div>
                      <div style={stylesObj.formGrid}>
                        {[
                          { label: "SPOC Name", key: "spoc_name" },
                          { label: "Phone No", key: "phone_no" },
                          { label: "Firm Name", key: "firm_name" },
                          { label: "Country", key: "country" },
                        ].map(({ label, key }) => (
                          <div key={key} style={stylesObj.formGroup}>
                            <label style={stylesObj.formLabel}>{label}</label>
                            <input
                              type="text"
                              style={stylesObj.formInput}
                              value={selectedRecord?.[key] || ""}
                              onChange={(e) =>
                                setSelectedRecord({
                                  ...selectedRecord,
                                  [key]: e.target.value,
                                })
                              }
                            />
                          </div>
                        ))}
                        <div
                          style={{
                            ...stylesObj.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={stylesObj.formLabel}>Email</label>
                          <input
                            type="email"
                            style={stylesObj.formInput}
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
                            ...stylesObj.formGroup,
                            gridColumn: "span 2",
                          }}
                        >
                          <label style={stylesObj.formLabel}>Address</label>
                          <input
                            type="text"
                            style={stylesObj.formInput}
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

                      <h6
                        style={{ ...stylesObj.sectionTitle, marginTop: "25px" }}
                      >
                        Bank Details
                      </h6>
                      {/* ── BANK MASTER DROPDOWN (Edit Tab) ── */}
                      <div style={stylesObj.formGrid}>
                        <BankSelectDropdown
                          value={selectedRecord?.bank_detail_id || ""}
                          onChange={handleBankSelectDetail}
                          label="Select Bank Master (Auto-fill)"
                        />
                        {[
                          { label: "Bank Name", key: "bank_name" },
                          { label: "Bank Address", key: "bank_address" },
                          {
                            label: "Beneficiary Account Name",
                            key: "beneficiary_account_name",
                          },
                          { label: "Account No", key: "account_no" },
                          { label: "Swift Code", key: "swift_code" },
                          { label: "IFSC Code", key: "ifsc_code" },
                          { label: "PayPal", key: "paypal" },
                        ].map(({ label, key }) => (
                          <div key={key} style={stylesObj.formGroup}>
                            <label style={stylesObj.formLabel}>{label}</label>
                            <input
                              type="text"
                              style={stylesObj.formInput}
                              value={selectedRecord?.[key] || ""}
                              onChange={(e) =>
                                setSelectedRecord({
                                  ...selectedRecord,
                                  [key]: e.target.value,
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: "10px", marginTop: "25px" }}
                  >
                    <button type="submit" style={stylesObj.submitBtn}>
                      Update
                    </button>
                    <button
                      type="button"
                      style={{
                        ...stylesObj.viewAllBtn,
                        flex: "none",
                        padding: "14px 30px",
                      }}
                      onClick={() => setDetailTab("view")}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      <DeleteConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        message="Are you sure you want to delete this invoice?"
      />

      {/* ============================================================ */}
      {/* CREATE INVOICE MODAL */}
      {/* ============================================================ */}
      {showModal && (
        <div style={stylesObj.modalOverlay}>
          <div style={stylesObj.modalContent}>
            <div style={stylesObj.modalHeader}>
              <h5 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                {formData._id ? "Edit Invoice" : "Create Invoice"}
              </h5>
              <button
                style={stylesObj.modalCloseBtn}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form style={stylesObj.modalBody} onSubmit={handleSubmit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "30px",
                }}
              >
                {/* LEFT COL */}
                <div>
                  <h6 style={stylesObj.sectionTitle}>Invoice Info</h6>
                  <div style={stylesObj.formGrid}>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Invoice No *</label>
                      <input
                        type="text"
                        name="invoice_no"
                        style={stylesObj.formInput}
                        required
                        value={formData.invoice_no}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Status</label>
                      <select
                        name="status"
                        style={stylesObj.formSelect}
                        value={formData.status}
                        onChange={handleInputChange}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Paid">Paid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Invoice Date *</label>
                      <input
                        type="date"
                        name="invoice_date"
                        style={stylesObj.formInput}
                        required
                        value={
                          formData.invoice_date
                            ? formData.invoice_date.split("T")[0]
                            : ""
                        }
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Due Date</label>
                      <input
                        type="date"
                        name="due_date"
                        style={stylesObj.formInput}
                        value={
                          formData.due_date
                            ? formData.due_date.split("T")[0]
                            : ""
                        }
                        onChange={handleInputChange}
                      />
                    </div>
                    <div
                      style={{
                        ...stylesObj.formGroup,
                        gridColumn: "span 2",
                        backgroundColor: "#fffbeb",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid #fbbf24",
                      }}
                    >
                      <label
                        style={{
                          ...stylesObj.formLabel,
                          color: "#92400e",
                          fontWeight: 600,
                        }}
                      >
                        Search & Select Docket (auto-fills details) *
                      </label>

                      <SearchableDocketSelect
                        dockets={dockets}
                        value={formData.docket_id}
                        onSelect={(docketId) => {
                          setFormData((prev) => ({
                            ...prev,
                            docket_id: docketId,
                          }));
                          handleDocketSelect(docketId);
                        }}
                      />

                      {/* Hidden input to maintain HTML5 'required' validation */}
                      <input
                        type="text"
                        required
                        value={formData.docket_id}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: 0,
                          height: 0,
                          pointerEvents: "none",
                        }}
                        onChange={() => {}}
                        tabIndex={-1}
                      />
                    </div>
                    <div
                      style={{ ...stylesObj.formGroup, gridColumn: "span 2" }}
                    >
                      <label style={stylesObj.formLabel}>Work Type</label>
                      <select
                        name="worktype"
                        style={stylesObj.formSelect}
                        value={formData.worktype || ""}
                        onChange={handleInputChange}
                      >
                        <option value="">Select</option>
                        {serviceFeesList.map((s) => (
                          <option key={s._id} value={s.service_name}>
                            {s.service_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <h6 style={{ ...stylesObj.sectionTitle, marginTop: "25px" }}>
                    Fee Details (Pre-filled from Docket)
                  </h6>
                  <div style={stylesObj.formGrid}>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Currency</label>
                      <select
                        name="currency"
                        style={stylesObj.formSelect}
                        value={formData.currency}
                        onChange={handleInputChange}
                      >
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>anovIP Fee</label>
                      <input
                        type="number"
                        name="anovipfee"
                        style={stylesObj.formInput}
                        value={formData.anovipfee}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Official Fee</label>
                      <input
                        type="number"
                        name="officialfee"
                        style={stylesObj.formInput}
                        value={formData.officialfee}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Total Fee</label>
                      <input
                        type="text"
                        style={{
                          ...stylesObj.formInput,
                          backgroundColor: "#f3f4f6",
                        }}
                        readOnly
                        value={formData.fee}
                      />
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>GST %</label>
                      <input
                        type="number"
                        name="gst_percentage"
                        style={stylesObj.formInput}
                        value={formData.gst_percentage}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>GST Amount</label>
                      <input
                        type="text"
                        style={{
                          ...stylesObj.formInput,
                          backgroundColor: "#f3f4f6",
                        }}
                        readOnly
                        value={formData.gst_amount}
                      />
                    </div>
                    <div style={stylesObj.formGroup}>
                      <label
                        style={{ ...stylesObj.formLabel, fontWeight: 700 }}
                      >
                        Grand Total
                      </label>
                      <input
                        type="text"
                        style={{
                          ...stylesObj.formInput,
                          backgroundColor: "#dcfce7",
                          fontWeight: 700,
                          fontSize: "15px",
                        }}
                        readOnly
                        value={formData.total_with_gst}
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COL */}
                <div>
                  <h6 style={stylesObj.sectionTitle}>
                    Client Details (Pre-filled)
                  </h6>
                  <div style={stylesObj.formGrid}>
                    <div
                      style={{ ...stylesObj.formGroup, gridColumn: "span 2" }}
                    >
                      <label style={stylesObj.formLabel}>Client Name</label>
                      <input
                        type="text"
                        style={{
                          ...stylesObj.formInput,
                          backgroundColor: "#f3f4f6",
                        }}
                        readOnly
                        value={formData.client_name || ""}
                      />
                    </div>
                  </div>
                  <div style={stylesObj.formGrid}>
                    {[
                      { label: "Client Ref", key: "client_ref" },
                      { label: "SPOC Name", key: "spoc_name" },
                      { label: "Phone No", key: "phone_no" },
                      { label: "Firm Name", key: "firm_name" },
                      { label: "Country", key: "country" },
                    ].map(({ label, key }) => (
                      <div key={key} style={stylesObj.formGroup}>
                        <label style={stylesObj.formLabel}>{label}</label>
                        <input
                          type="text"
                          name={key}
                          style={stylesObj.formInput}
                          value={formData[key]}
                          onChange={handleInputChange}
                        />
                      </div>
                    ))}
                    <div style={stylesObj.formGroup}>
                      <label style={stylesObj.formLabel}>Email</label>
                      <input
                        type="email"
                        name="email"
                        style={stylesObj.formInput}
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div
                      style={{ ...stylesObj.formGroup, gridColumn: "span 2" }}
                    >
                      <label style={stylesObj.formLabel}>Address</label>
                      <input
                        type="text"
                        name="address"
                        style={stylesObj.formInput}
                        value={formData.address}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <hr
                    style={{
                      borderTop: "5px solid #f97316",
                      opacity: "1",
                      margin: "20px 0",
                    }}
                  />

                  <h6 style={stylesObj.sectionTitle}>Bank Details</h6>
                  <div style={stylesObj.formGrid}>
                    {/* ── BANK MASTER DROPDOWN (Create Modal) ── */}
                    <BankSelectDropdown
                      value={formData.bank_detail_id}
                      onChange={handleBankSelect}
                    />
                    {[
                      { label: "Bank Name", key: "bank_name" },
                      { label: "Bank Address", key: "bank_address" },
                      {
                        label: "Beneficiary Account Name",
                        key: "beneficiary_account_name",
                      },
                      { label: "Account No", key: "account_no" },
                      { label: "Swift Code", key: "swift_code" },
                      { label: "IFSC Code", key: "ifsc_code" },
                      { label: "PayPal", key: "paypal" },
                    ].map(({ label, key }) => (
                      <div key={key} style={stylesObj.formGroup}>
                        <label style={stylesObj.formLabel}>{label}</label>
                        <input
                          type="text"
                          name={key}
                          style={stylesObj.formInput}
                          value={formData[key]}
                          onChange={handleInputChange}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ ...stylesObj.formGroup, marginTop: "15px" }}>
                    <label style={stylesObj.formLabel}>Notes</label>
                    <textarea
                      name="notes"
                      style={{
                        ...stylesObj.formInput,
                        minHeight: "60px",
                        resize: "vertical",
                      }}
                      value={formData.notes}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  ...stylesObj.submitBtn,
                  opacity: isSubmitting ? 0.6 : 1,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// STYLES (renamed to stylesObj to avoid conflict with DOM styles)
// ============================================================
const stylesObj = {
  container: {},
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tableHeaderRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1 1 180px",
    minWidth: "160px",
  },
  filterLabel: { fontSize: "12px", color: "#6b7280", fontWeight: "500" },
  filterInput: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    height: "38px",
  },
  createBtn: {
    padding: "0 20px",
    height: "38px",
    backgroundColor: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtn: {
    padding: "10px 16px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
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
  viewLink: {
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "12px",
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
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    width: "90%",
    maxHeight: "97vh",
    overflowY: "auto",
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
  viewSectionTitle: {
    color: "#374151",
    borderBottom: "2px solid #e5e7eb",
    paddingBottom: "8px",
    marginBottom: "15px",
  },
  actionBtn: {
    padding: "10px 20px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
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
  viewAllBtn: {
    padding: "0 20px",
    height: "38px",
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

export default InvoicePage;
