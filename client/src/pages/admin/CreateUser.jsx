import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import DeleteConfirmModal from "../../components/DeleteConfirmModal";
import * as XLSX from "xlsx";
import {
  Upload,
  Download,
  LogIn,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  Trash,
  Pencil,
  Landmark,
  IndianRupee,
  Search,
} from "lucide-react";

// Helper: detect if selected role is "client"
const isClientRole = (roleId, roles) => {
  const role = roles.find((r) => r._id === roleId);
  return role?.name?.toLowerCase() === "client";
};

// Helper: format currency in INR
const formatINR = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
};

export default function UserManagement() {
  const initialFormState = {
    name: "",
    email: "",
    department: "",
    role_id: "",
    status: "active",
    phone_no: "",
    firm_name: "",
    country: "",
    address: "",
  };

  const initialBankForm = {
    bank_name: "",
    bank_address: "",
    beneficiary_account_name: "",
    account_no: "",
    swift_code: "",
    ifsc_code: "",
    paypal: "",
    notes: "",
  };

  const initialServiceFeeForm = {
    service_name: "",
    official_fee_small: "",
    official_fee_large: "",
    our_fee: "",
    description: "",
    status: "active",
  };

  // ── TABS ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("users");

  // ── USER STATE ────────────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState(initialFormState);
  const [editForm, setEditForm] = useState(initialFormState);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef(null);

  // ── USER PAGINATION ───────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // ── LOGIN HISTORY PAGINATION ──────────────────────────────────────────────
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPerPage] = useState(10);

  // ── BANK DETAILS STATE ────────────────────────────────────────────────────
  const [bankDetails, setBankDetails] = useState([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankPage, setBankPage] = useState(1);
  const bankPerPage = 10;
  const [bankLoading, setBankLoading] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState(initialBankForm);
  const [editingBankId, setEditingBankId] = useState(null);
  const [showBankDeleteModal, setShowBankDeleteModal] = useState(false);
  const [deleteBankId, setDeleteBankId] = useState(null);
  const [bankSearch, setBankSearch] = useState("");

  // ── SERVICE FEE STATE ─────────────────────────────────────────────────────
  const [serviceFees, setServiceFees] = useState([]);
  const [serviceFeeTotal, setServiceFeeTotal] = useState(0);
  const [serviceFeePage, setServiceFeePage] = useState(1);
  const serviceFeePerPage = 10;
  const [serviceFeeLoading, setServiceFeeLoading] = useState(false);
  const [showServiceFeeModal, setShowServiceFeeModal] = useState(false);
  const [serviceFeeForm, setServiceFeeForm] = useState(initialServiceFeeForm);
  const [editingServiceFeeId, setEditingServiceFeeId] = useState(null);
  const [showServiceFeeDeleteModal, setShowServiceFeeDeleteModal] =
    useState(false);
  const [deleteServiceFeeId, setDeleteServiceFeeId] = useState(null);
  const [serviceFeeSearch, setServiceFeeSearch] = useState("");

  // ── NEW STATE: SELECTION & SORTING ────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  // ── LOGIC: SORTING ────────────────────────────────────────────────────────
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedUsers = React.useMemo(() => {
    let sortableItems = [...users];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue =
          sortConfig.key === "role"
            ? a.role_id?.name || ""
            : a[sortConfig.key] || "";
        let bValue =
          sortConfig.key === "role"
            ? b.role_id?.name || ""
            : b[sortConfig.key] || "";
        if (typeof aValue === "string") aValue = aValue.toLowerCase();
        if (typeof bValue === "string") bValue = bValue.toLowerCase();
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [users, sortConfig]);

  // ── LOGIC: SELECTION ──────────────────────────────────────────────────────
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(users.map((u) => u._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  // ── LOGIC: BULK EXPORT ────────────────────────────────────────────────────
  const handleBulkExport = () => {
    if (selectedIds.length === 0) {
      toast.error("No users selected to export");
      return;
    }
    const dataToExport = sortedUsers.filter((u) => selectedIds.includes(u._id));
    const exportData = dataToExport.map((user, index) => ({
      "#": index + 1,
      Name: user.name || "",
      Email: user.email || "",
      "E-ID": user.e_id || "",
      Department: user.department || "",
      Role: user.role_id?.name || "",
      Status: user.status || "",
      Phone: user.phone_no || "",
      "Created At": user.createdAt
        ? new Date(user.createdAt).toLocaleDateString()
        : "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Selected Users");
    XLSX.writeFile(wb, `selected_users_export_${new Date().getTime()}.xlsx`);
    toast.success(`Exported ${dataToExport.length} selected users`);
  };

  // ── LOGIC: BULK DELETE ────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} users?`,
      )
    )
      return;
    try {
      await Promise.all(
        selectedIds.map((id) => axios.delete(`/api/auth/users/${id}`)),
      );
      setUsers((prev) => prev.filter((u) => !selectedIds.includes(u._id)));
      setSelectedIds([]);
      toast.success("Users deleted successfully!");
    } catch (err) {
      toast.error("Error deleting some users");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchRoles();
    fetchUsers();
    fetchLoginHistory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [users.length]);

  useEffect(() => {
    if (activeTab === "history") setHistoryPage(1);
    if (activeTab === "bank") fetchBankDetails(1, "");
    if (activeTab === "services") fetchServiceFees(1, "");
  }, [activeTab]);

  // ── USER PAGINATION CALC ──────────────────────────────────────────────────
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstItem, indexOfLastItem);
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // ── HISTORY PAGINATION CALC ───────────────────────────────────────────────
  const totalHistoryPages = Math.ceil(loginHistory.length / historyPerPage);
  const indexOfLastHistory = historyPage * historyPerPage;
  const indexOfFirstHistory = indexOfLastHistory - historyPerPage;
  const currentHistory = loginHistory.slice(
    indexOfFirstHistory,
    indexOfLastHistory,
  );
  const canGoNextHistory = historyPage < totalHistoryPages;
  const canGoPrevHistory = historyPage > 1;

  const handleHistoryPageChange = (page) => {
    if (page >= 1 && page <= totalHistoryPages) setHistoryPage(page);
  };

  // ── BANK PAGINATION CALC ──────────────────────────────────────────────────
  const bankTotalPages = Math.ceil(bankTotal / bankPerPage);

  // ── SERVICE FEE PAGINATION CALC ───────────────────────────────────────────
  const serviceFeeTotalPages = Math.ceil(serviceFeeTotal / serviceFeePerPage);

  // ── FETCH FUNCTIONS ───────────────────────────────────────────────────────
  const fetchRoles = async () => {
    try {
      const res = await axios.get(`/api/rbac/roles`);
      setRoles(res.data);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Failed to fetch roles");
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`/api/auth/users`);
      setUsers(res.data);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Failed to fetch users");
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const res = await axios.get(`/api/auth/login-history`);
      setLoginHistory(res.data);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Failed to fetch login history");
      toast.error(
        err?.response?.data?.message || "Failed to load login history",
      );
    }
  };

  const fetchBankDetails = async (page = bankPage, search = bankSearch) => {
    setBankLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: bankPerPage });
      if (search) params.append("search", search);
      const res = await axios.get(`/api/bank-details?${params}`);
      setBankDetails(res.data.bankDetails || []);
      setBankTotal(res.data.total || 0);
      setBankPage(page);
    } catch (err) {
      toast.error("Failed to fetch bank details");
    } finally {
      setBankLoading(false);
    }
  };

  const fetchServiceFees = async (
    page = serviceFeePage,
    search = serviceFeeSearch,
  ) => {
    setServiceFeeLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: serviceFeePerPage });
      if (search) params.append("search", search);
      const res = await axios.get(`/api/service-fees?${params}`);
      setServiceFees(res.data.serviceFees || []);
      setServiceFeeTotal(res.data.total || 0);
      setServiceFeePage(page);
    } catch (err) {
      toast.error("Failed to fetch service fees");
    } finally {
      setServiceFeeLoading(false);
    }
  };

  const getRoleById = (roleId) => roles.find((r) => r._id === roleId) || null;

  // ── USER HANDLERS ─────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`/api/auth/create`, {
        ...createForm,
        status: "active",
      });
      const newUser = res.data.user || res.data;
      setUsers((prev) => [
        {
          ...createForm,
          ...newUser,
          status: "active",
          role_id: getRoleById(createForm.role_id) || createForm.role_id,
        },
        ...prev,
      ]);
      setCreateForm(initialFormState);
      toast.success(
        <div>
          <p>User created successfully!</p>
          <strong>E-ID:</strong> {res.data.e_id}
          <br />
          <strong>Password:</strong> {res.data.password}
        </div>,
      );
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Failed to create user");
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditForm({
      name: user.name,
      email: user.email,
      department: user.department,
      role_id: user.role_id?._id || user.role_id,
      status: user.status,
      phone_no: user.phone_no || "",
      firm_name: user.firm_name || "",
      country: user.country || "",
      address: user.address || "",
    });
    setEditingUserId(user._id);
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`/api/auth/users/${editingUserId}`, editForm);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === editingUserId
            ? {
                ...u,
                ...editForm,
                role_id: getRoleById(editForm.role_id) || editForm.role_id,
              }
            : u,
        ),
      );
      setShowEditModal(false);
      setEditingUserId(null);
      setEditForm(initialFormState);
      toast.success("User updated successfully!");
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Failed to update user");
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteUserId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/auth/users/${deleteUserId}`);
      setUsers((prev) => prev.filter((u) => u._id !== deleteUserId));
      toast.success("User deleted successfully!");
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Delete failed");
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setShowDeleteModal(false);
      setDeleteUserId(null);
    }
  };

  const submitResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await axios.post(`/api/auth/reset-password/${resetUserId}`, {
        password: newPassword,
      });
      toast.success("Password updated successfully!");
      setShowResetModal(false);
      setNewPassword("");
      setResetUserId(null);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Reset failed");
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUserId(null);
    setEditForm(initialFormState);
  };

  const handleExport = () => {
    if (users.length === 0) {
      toast.error("No users to export");
      return;
    }
    const exportData = users.map((user, index) => ({
      "#": index + 1,
      Name: user.name || "",
      Email: user.email || "",
      "E-ID": user.e_id || "",
      Department: user.department || "",
      Role: user.role_id?.name || getRoleById(user.role_id)?.name || "",
      Status: user.status || "",
      "Created At": user.createdAt
        ? new Date(user.createdAt).toLocaleDateString()
        : "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    ws["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
    ];
    XLSX.writeFile(
      wb,
      `users_export_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(`Exported ${users.length} users successfully`);
  };

  const handleExportHistory = () => {
    if (loginHistory.length === 0) {
      toast.error("No history to export");
      return;
    }
    const exportData = loginHistory.map((log, index) => ({
      "#": index + 1,
      User: log.user_id?.name || "Unknown",
      Action: log.action || "",
      Timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString() : "",
      "IP Address": log.ip_address || "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Login History");
    ws["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
    ];
    XLSX.writeFile(
      wb,
      `login_history_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(`Exported ${loginHistory.length} records successfully`);
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
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          if (jsonData.length === 0) {
            toast.error("No data found in the file");
            setImporting(false);
            return;
          }
          const mappedData = jsonData.map((row) => ({
            name: row["Name"] || row["name"] || "",
            email: row["Email"] || row["email"] || "",
            department: row["Department"] || row["department"] || "",
            role_name: row["Role"] || row["role"] || row["Role Name"] || "",
            status: row["Status"] || row["status"] || "active",
          }));
          const res = await axios.post("/api/auth/bulk-import", {
            users: mappedData,
          });
          const { imported, failed, errors, credentials } = res.data;
          if (imported > 0) {
            toast.success(
              <div>
                <p>Successfully imported {imported} users!</p>
                {credentials && credentials.length > 0 && (
                  <small>Check console for login credentials</small>
                )}
              </div>,
            );
            if (credentials && credentials.length > 0) {
              console.log("=== NEW USER CREDENTIALS ===");
              console.table(credentials);
            }
            fetchUsers();
          }
          if (failed > 0) {
            toast.warning(`${failed} users failed to import`);
          }
        } catch (parseError) {
          toast.error(
            parseError.response?.data?.message ||
              "Error parsing Excel file. Please check the format.",
          );
        }
        setImporting(false);
      };
      reader.onerror = () => {
        toast.error("Error reading file");
        setImporting(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Import failed");
      setImporting(false);
    }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const roleNames = roles.map((r) => r.name).join(", ");
    const templateData = [
      {
        Name: "John Doe",
        Email: "john@example.com",
        Department: "IP Management",
        Role: roles.length > 0 ? roles[0].name : "admin",
        Status: "active",
      },
    ];
    const instructionsData = [
      { Field: "Name", Required: "Yes", Description: "Full name of the user" },
      {
        Field: "Email",
        Required: "Yes",
        Description: "Valid email address (must be unique)",
      },
      {
        Field: "Department",
        Required: "Yes",
        Description: "IP Management, Research, Legal, Finance, HR",
      },
      {
        Field: "Role",
        Required: "Yes",
        Description: `Available roles: ${roleNames || "admin, user, manager"}`,
      },
      {
        Field: "Status",
        Required: "No",
        Description: "active (default) or inactive",
      },
    ];
    const rolesData = roles.map((r, i) => ({
      "#": i + 1,
      "Role Name (Use This)": r.name,
      Description: r.description || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
    const wsRoles = XLSX.utils.json_to_sheet(rolesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
    XLSX.utils.book_append_sheet(wb, wsRoles, "Valid Roles");
    ws["!cols"] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 10 },
    ];
    XLSX.writeFile(wb, "user_import_template.xlsx");
    toast.success(
      "Template downloaded - Check 'Valid Roles' sheet for role names",
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── BANK DETAIL HANDLERS ──────────────────────────────────────────────────
  const handleBankSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBankId) {
        const res = await axios.put(
          `/api/bank-details/${editingBankId}`,
          bankForm,
        );
        setBankDetails((prev) =>
          prev.map((b) => (b._id === editingBankId ? res.data.data : b)),
        );
        toast.success("Bank detail updated successfully!");
      } else {
        await axios.post(`/api/bank-details`, bankForm);
        fetchBankDetails(1, bankSearch);
        toast.success("Bank detail created successfully!");
      }
      setShowBankModal(false);
      setBankForm(initialBankForm);
      setEditingBankId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  const handleBankEdit = (b) => {
    setBankForm({
      bank_name: b.bank_name || "",
      bank_address: b.bank_address || "",
      beneficiary_account_name: b.beneficiary_account_name || "",
      account_no: b.account_no || "",
      swift_code: b.swift_code || "",
      ifsc_code: b.ifsc_code || "",
      paypal: b.paypal || "",
      notes: b.notes || "",
    });
    setEditingBankId(b._id);
    setShowBankModal(true);
  };

  const handleBankDelete = (id) => {
    setDeleteBankId(id);
    setShowBankDeleteModal(true);
  };

  const confirmBankDelete = async () => {
    try {
      await axios.delete(`/api/bank-details/${deleteBankId}`);
      setBankDetails((prev) => prev.filter((b) => b._id !== deleteBankId));
      setBankTotal((p) => p - 1);
      toast.success("Bank detail deleted successfully!");
    } catch (err) {
      toast.error("Delete failed");
    } finally {
      setShowBankDeleteModal(false);
      setDeleteBankId(null);
    }
  };

  const handleBankExport = () => {
    if (bankDetails.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = bankDetails.map((b, i) => ({
      "#": i + 1,
      "Bank Name": b.bank_name,
      "Bank Address": b.bank_address || "",
      "Beneficiary Account Name": b.beneficiary_account_name || "",
      "Account No": b.account_no || "",
      "Swift Code": b.swift_code || "",
      "IFSC Code": b.ifsc_code || "",
      PayPal: b.paypal || "",
      Notes: b.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Details");
    ws["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 30 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
      { wch: 30 },
    ];
    XLSX.writeFile(
      wb,
      `bank_details_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(`Exported ${bankDetails.length} bank details successfully`);
  };

  // ── SERVICE FEE HANDLERS ──────────────────────────────────────────────────
  const handleServiceFeeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingServiceFeeId) {
        const res = await axios.put(
          `/api/service-fees/${editingServiceFeeId}`,
          serviceFeeForm,
        );
        setServiceFees((prev) =>
          prev.map((s) => (s._id === editingServiceFeeId ? res.data.data : s)),
        );
        toast.success("Service fee updated successfully!");
      } else {
        await axios.post(`/api/service-fees`, serviceFeeForm);
        fetchServiceFees(1, serviceFeeSearch);
        toast.success("Service fee created successfully!");
      }
      setShowServiceFeeModal(false);
      setServiceFeeForm(initialServiceFeeForm);
      setEditingServiceFeeId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save failed");
    }
  };

  const handleServiceFeeEdit = (s) => {
    setServiceFeeForm({
      service_name: s.service_name || "",
      official_fee_small: s.official_fee_small || "",
      official_fee_large: s.official_fee_large || "",
      our_fee: s.our_fee || "",
      description: s.description || "",
      status: s.status || "active",
    });
    setEditingServiceFeeId(s._id);
    setShowServiceFeeModal(true);
  };

  const handleServiceFeeDelete = (id) => {
    setDeleteServiceFeeId(id);
    setShowServiceFeeDeleteModal(true);
  };

  const confirmServiceFeeDelete = async () => {
    try {
      await axios.delete(`/api/service-fees/${deleteServiceFeeId}`);
      setServiceFees((prev) =>
        prev.filter((s) => s._id !== deleteServiceFeeId),
      );
      setServiceFeeTotal((p) => p - 1);
      toast.success("Service fee deleted successfully!");
    } catch (err) {
      toast.error("Delete failed");
    } finally {
      setShowServiceFeeDeleteModal(false);
      setDeleteServiceFeeId(null);
    }
  };

  const handleServiceFeeExport = () => {
    if (serviceFees.length === 0) {
      toast.error("No data to export");
      return;
    }
    const data = serviceFees.map((s, i) => ({
      "#": i + 1,
      "Service Name": s.service_name,
      "Official Fee - Small Entity (₹)": s.official_fee_small || 0,
      "Official Fee - Large Entity (₹)": s.official_fee_large || 0,
      "Our Fee (₹)": s.our_fee || 0,
      Description: s.description || "",
      Status: s.status || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Service Fees");
    ws["!cols"] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 28 },
      { wch: 28 },
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
    ];
    XLSX.writeFile(
      wb,
      `service_fees_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success(`Exported ${serviceFees.length} service fees successfully`);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="container mt-4">
      {/* ── TAB NAVIGATION ─────────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="card-header p-0">
          <ul className="nav nav-tabs card-header-tabs mb-0">
            <li className="nav-item">
              <button
                className={`text-dark nav-link ${activeTab === "users" ? "active" : ""}`}
                onClick={() => setActiveTab("users")}
              >
                User Management
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`text-dark nav-link ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                Login History
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`text-dark nav-link ${activeTab === "bank" ? "active" : ""}`}
                onClick={() => setActiveTab("bank")}
              >
                Bank Details
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`text-dark nav-link ${activeTab === "services" ? "active" : ""}`}
                onClick={() => setActiveTab("services")}
              >
                Services &amp; Fee
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          USER MANAGEMENT TAB  (unchanged — copy from your working version)
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "users" && (
        <>
          <h3 className="mb-4 text-center">Create User</h3>
          <form onSubmit={handleCreate} className="card p-4 shadow mb-4">
            <div className="row g-3">
              <div className="col-md-6">
                <input
                  type="text"
                  name="name"
                  className="form-control"
                  placeholder="Full Name"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-md-6">
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  placeholder="Email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="col-md-6">
                <select
                  name="department"
                  className="form-select"
                  value={createForm.department}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, department: e.target.value })
                  }
                  required
                >
                  <option value="">Select Department</option>
                  <option value="IP Management">IP Management</option>
                  <option value="Research">Research</option>
                  <option value="Legal">Legal</option>
                  <option value="Finance">Finance</option>
                  <option value="HR">HR</option>
                </select>
              </div>
              <div className="col-md-6">
                <select
                  name="role_id"
                  className="form-select"
                  value={createForm.role_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, role_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((role) => (
                    <option key={role._id} value={role._id}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {isClientRole(createForm.role_id, roles) && (
                <>
                  <div className="col-12">
                    <div
                      style={{
                        borderTop: "2px solid #f97316",
                        margin: "4px 0 8px",
                      }}
                    />
                    <p
                      className="mb-2 fw-semibold"
                      style={{ color: "#f97316", fontSize: 14 }}
                    >
                      Client Details
                    </p>
                  </div>
                  <div className="col-md-6">
                    <label
                      className="form-label text-muted"
                      style={{ fontSize: 13 }}
                    >
                      SPOC Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={createForm.name}
                      readOnly
                      style={{ background: "#f8f9fa", color: "#6c757d" }}
                    />
                    <small className="text-muted">
                      Same as Full Name above
                    </small>
                  </div>
                  <div className="col-md-6">
                    <label
                      className="form-label text-muted"
                      style={{ fontSize: 13 }}
                    >
                      Phone No.
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Phone number"
                      value={createForm.phone_no}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          phone_no: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-md-6">
                    <label
                      className="form-label text-muted"
                      style={{ fontSize: 13 }}
                    >
                      Firm Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Firm / Company name"
                      value={createForm.firm_name}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          firm_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-md-6">
                    <label
                      className="form-label text-muted"
                      style={{ fontSize: 13 }}
                    >
                      Country
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Country"
                      value={createForm.country}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          country: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12">
                    <label
                      className="form-label text-muted"
                      style={{ fontSize: 13 }}
                    >
                      Address
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Full address"
                      value={createForm.address}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}
              <div className="col-12">
                <button className="btn btn-primary w-100" disabled={loading}>
                  {loading ? "Creating..." : "Create User"}
                </button>
              </div>
            </div>
          </form>

          <div className="card p-4 shadow">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Users</h5>
              <div className="d-flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                />
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload size={16} className="me-1" />
                  {importing ? "Importing..." : ""}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleExport}
                  disabled={users.length === 0}
                >
                  <Download size={16} className="me-1" />
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={downloadTemplate}
                >
                  <FileSpreadsheet size={16} className="me-1" />
                </button>
              </div>
            </div>
            {selectedIds.length > 0 && (
              <div className="d-flex align-items-center justify-content-between p-2 mb-3 bg-light border rounded">
                <span className="fw-bold text-primary px-2">
                  {selectedIds.length} selected
                </span>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 size={14} className="me-1" />
                  </button>
                  <button
                    className="btn btn-outline-success btn-sm"
                    onClick={handleBulkExport}
                  >
                    <Download size={14} className="me-1" />
                  </button>
                </div>
              </div>
            )}
            <div
              className="table-responsive"
              style={{
                maxHeight: "600px",
                overflowY: "auto",
                border: "1px solid #dee2e6",
              }}
            >
              <table className="table table-bordered table-hover mb-0">
                <thead
                  className="table-light"
                  style={{ position: "sticky", top: 0, zIndex: 5 }}
                >
                  <tr>
                    <th
                      style={{
                        width: "40px",
                        textAlign: "center",
                        backgroundColor: "#f8f9fa",
                      }}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input"
                        onChange={handleSelectAll}
                        checked={
                          users.length > 0 &&
                          selectedIds.length === users.length
                        }
                      />
                    </th>
                    <th width="260" style={{ backgroundColor: "#f8f9fa" }}>
                      Actions
                    </th>
                    <th
                      onClick={() => handleSort("name")}
                      style={{ cursor: "pointer", backgroundColor: "#f8f9fa" }}
                    >
                      <div className="d-flex align-items-center gap-1">
                        Name{" "}
                        {sortConfig.key === "name" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("email")}
                      style={{ cursor: "pointer", backgroundColor: "#f8f9fa" }}
                    >
                      <div className="d-flex align-items-center gap-1">
                        Email{" "}
                        {sortConfig.key === "email" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("department")}
                      style={{ cursor: "pointer", backgroundColor: "#f8f9fa" }}
                    >
                      <div className="d-flex align-items-center gap-1">
                        Department{" "}
                        {sortConfig.key === "department" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("role")}
                      style={{ cursor: "pointer", backgroundColor: "#f8f9fa" }}
                    >
                      <div className="d-flex align-items-center gap-1">
                        Role{" "}
                        {sortConfig.key === "role" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th style={{ backgroundColor: "#f8f9fa" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map((user) => (
                    <tr
                      key={user._id}
                      style={{
                        backgroundColor: selectedIds.includes(user._id)
                          ? "#f0f9ff"
                          : "inherit",
                      }}
                    >
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedIds.includes(user._id)}
                          onChange={() => handleSelectRow(user._id)}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-info me-1"
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-warning me-1"
                          onClick={() => {
                            setResetUserId(user._id);
                            setNewPassword("");
                            setShowResetModal(true);
                          }}
                        >
                          Reset Password
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(user._id)}
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.department}</td>
                      <td>
                        {user.role_id?.name ||
                          getRoleById(user.role_id)?.name ||
                          "-"}
                      </td>
                      <td>
                        <span
                          className={`badge ${user.status === "active" ? "bg-success" : "bg-secondary"}`}
                        >
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {users.length > 0 && (
              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="text-muted" style={{ fontSize: "14px" }}>
                  Showing <strong>{currentUsers.length}</strong> of{" "}
                  <strong>{users.length}</strong> users
                </div>
                <div className="d-flex align-items-center gap-1">
                  <button
                    className="btn btn-sm btn-outline-secondary px-2"
                    onClick={() => handlePageChange(currentPage - 1)}
                    style={{
                      minWidth: "32px",
                      opacity: !canGoPrev ? 0.5 : 1,
                      cursor: !canGoPrev ? "not-allowed" : "pointer",
                    }}
                  >
                    ←
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        className={`btn btn-sm px-2 ${currentPage === page ? "btn-primary text-white" : "btn-outline-secondary"}`}
                        onClick={() => handlePageChange(page)}
                        style={{ minWidth: "32px" }}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <button
                    className="btn btn-sm btn-outline-secondary px-2"
                    onClick={() => handlePageChange(currentPage + 1)}
                    style={{
                      minWidth: "32px",
                      opacity: !canGoNext ? 0.5 : 1,
                      cursor: !canGoNext ? "not-allowed" : "pointer",
                    }}
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LOGIN HISTORY TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="card p-4 shadow">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Login History</h5>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportHistory}
              disabled={loginHistory.length === 0}
            >
              <Download size={16} className="me-1" />
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead className="table-light">
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Timestamp</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {currentHistory.map((log) => (
                  <tr key={log._id}>
                    <td>{log.user_id?.name || "Unknown"}</td>
                    <td>
                      <span
                        className={`badge ${log.action === "login" ? "bg-success" : "bg-secondary"}`}
                      >
                        {log.action === "login" ? (
                          <>
                            <LogIn size={14} className="me-1" />
                            Login
                          </>
                        ) : (
                          <>
                            <LogOut size={14} className="me-1" />
                            Logout
                          </>
                        )}
                      </span>
                    </td>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      <code>{log.ip_address || "-"}</code>
                    </td>
                  </tr>
                ))}
                {loginHistory.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-4">
                      No login history found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loginHistory.length > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted" style={{ fontSize: "14px" }}>
                Showing <strong>{currentHistory.length}</strong> of{" "}
                <strong>{loginHistory.length}</strong> records
              </div>
              <div className="d-flex align-items-center gap-1">
                <button
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() => handleHistoryPageChange(historyPage - 1)}
                  style={{
                    minWidth: "32px",
                    opacity: !canGoPrevHistory ? 0.5 : 1,
                    cursor: !canGoPrevHistory ? "not-allowed" : "pointer",
                  }}
                >
                  ←
                </button>
                {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`btn btn-sm px-2 ${historyPage === page ? "btn-primary text-white" : "btn-outline-secondary"}`}
                      onClick={() => handleHistoryPageChange(page)}
                      style={{ minWidth: "32px" }}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() => handleHistoryPageChange(historyPage + 1)}
                  style={{
                    minWidth: "32px",
                    opacity: !canGoNextHistory ? 0.5 : 1,
                    cursor: !canGoNextHistory ? "not-allowed" : "pointer",
                  }}
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          BANK DETAILS TAB
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "bank" && (
        <div className="card p-4 shadow">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h5 className="mb-0">
              <Landmark size={18} className="me-2 text-primary" />
              Bank Details Master
            </h5>
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search bank / account name..."
                style={{ width: 230 }}
                value={bankSearch}
                onChange={(e) => {
                  setBankSearch(e.target.value);
                  fetchBankDetails(1, e.target.value);
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBankExport}
                disabled={bankDetails.length === 0}
              >
                <Download size={16} className="me-1" />
              </button>
              <button
                className="btn btn-sm text-white"
                style={{ backgroundColor: "#f97316" }}
                onClick={() => {
                  setBankForm(initialBankForm);
                  setEditingBankId(null);
                  setShowBankModal(true);
                }}
              >
                <Plus size={16} className="me-1" />
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Bank Name</th>
                  <th>Bank Address</th>
                  <th>Beneficiary Account Name</th>
                  <th>Account No</th>
                  <th>Swift Code</th>
                  <th>IFSC Code</th>
                  <th>PayPal</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bankLoading ? (
                  <tr>
                    <td colSpan="10" className="text-center py-4">
                      Loading...
                    </td>
                  </tr>
                ) : bankDetails.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-4">
                      No bank details found. Click <strong>+ Add Bank</strong>{" "}
                      to create one.
                    </td>
                  </tr>
                ) : (
                  bankDetails.map((b, i) => (
                    <tr key={b._id}>
                      <td>{(bankPage - 1) * bankPerPage + i + 1}</td>
                      <td>
                        <strong>{b.bank_name}</strong>
                      </td>
                      <td>{b.bank_address || "-"}</td>
                      <td>{b.beneficiary_account_name || "-"}</td>
                      <td>
                        <code>{b.account_no || "-"}</code>
                      </td>
                      <td>{b.swift_code || "-"}</td>
                      <td>{b.ifsc_code || "-"}</td>
                      <td>{b.paypal || "-"}</td>
                      <td
                        style={{
                          maxWidth: 150,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={b.notes}
                      >
                        {b.notes || "-"}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-info me-1"
                          onClick={() => handleBankEdit(b)}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleBankDelete(b._id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {bankTotal > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted" style={{ fontSize: "14px" }}>
                Showing <strong>{bankDetails.length}</strong> of{" "}
                <strong>{bankTotal}</strong> records
              </div>
              <div className="d-flex align-items-center gap-1">
                <button
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() => fetchBankDetails(bankPage - 1, bankSearch)}
                  disabled={bankPage === 1}
                  style={{
                    minWidth: "32px",
                    opacity: bankPage === 1 ? 0.5 : 1,
                    cursor: bankPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ←
                </button>
                {Array.from({ length: bankTotalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, bankPage - 3), bankPage + 2)
                  .map((p) => (
                    <button
                      key={p}
                      className={`btn btn-sm px-2 ${bankPage === p ? "btn-primary text-white" : "btn-outline-secondary"}`}
                      onClick={() => fetchBankDetails(p, bankSearch)}
                      style={{ minWidth: "32px" }}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() => fetchBankDetails(bankPage + 1, bankSearch)}
                  disabled={bankPage === bankTotalPages}
                  style={{
                    minWidth: "32px",
                    opacity: bankPage === bankTotalPages ? 0.5 : 1,
                    cursor:
                      bankPage === bankTotalPages ? "not-allowed" : "pointer",
                  }}
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SERVICES & FEE TAB  (UPDATED — two-tier official fees)
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "services" && (
        <div className="card p-4 shadow">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h5 className="mb-0">Services &amp; Fee Master</h5>
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <div
                className="input-group input-group-sm"
                style={{ width: 250 }}
              >
                <span className="input-group-text">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search service name..."
                  value={serviceFeeSearch}
                  onChange={(e) => {
                    setServiceFeeSearch(e.target.value);
                    fetchServiceFees(1, e.target.value);
                  }}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleServiceFeeExport}
                disabled={serviceFees.length === 0}
                title="Export to Excel"
              >
                <Download size={16} className="me-1" />
              </button>
              <button
                className="btn btn-sm text-white"
                style={{ backgroundColor: "#f97316" }}
                onClick={() => {
                  setServiceFeeForm(initialServiceFeeForm);
                  setEditingServiceFeeId(null);
                  setShowServiceFeeModal(true);
                }}
                title="Add New Service"
              >
                <Plus size={16} className="me-1" />
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Service Name</th>
                  <th
                    className="text-end"
                    style={{ backgroundColor: "#eff6ff" }}
                  >
                    Official Fee (₹)
                    <br />
                    <small className="fw-normal text-primary">
                      Small Entity
                    </small>
                  </th>
                  <th
                    className="text-end"
                    style={{ backgroundColor: "#fef3c7" }}
                  >
                    Official Fee (₹)
                    <br />
                    <small className="fw-normal" style={{ color: "#92400e" }}>
                      Large Entity
                    </small>
                  </th>
                  <th className="text-end">Our Fee (₹)</th>
                  <th>Description</th>
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {serviceFeeLoading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      Loading...
                    </td>
                  </tr>
                ) : serviceFees.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      No services found. Click <strong>+ Add Service</strong> to
                      create one.
                    </td>
                  </tr>
                ) : (
                  serviceFees.map((s, i) => (
                    <tr key={s._id}>
                      <td>
                        {(serviceFeePage - 1) * serviceFeePerPage + i + 1}
                      </td>
                      <td>
                        <strong>{s.service_name}</strong>
                      </td>
                      <td
                        className="text-end"
                        style={{ backgroundColor: "#f0f9ff" }}
                      >
                        {formatINR(s.official_fee_small)}
                      </td>
                      <td
                        className="text-end"
                        style={{ backgroundColor: "#fffbeb" }}
                      >
                        {formatINR(s.official_fee_large)}
                      </td>
                      <td className="text-end">{formatINR(s.our_fee)}</td>
                      <td
                        style={{
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={s.description}
                      >
                        {s.description || "-"}
                      </td>
                      <td>
                        <span
                          className={`badge ${s.status === "active" ? "bg-success" : "bg-secondary"}`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-info me-1"
                          onClick={() => handleServiceFeeEdit(s)}
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleServiceFeeDelete(s._id)}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {serviceFeeTotal > 0 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted" style={{ fontSize: "14px" }}>
                Showing <strong>{serviceFees.length}</strong> of{" "}
                <strong>{serviceFeeTotal}</strong> services
              </div>
              <div className="d-flex align-items-center gap-1">
                <button
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() =>
                    fetchServiceFees(serviceFeePage - 1, serviceFeeSearch)
                  }
                  disabled={serviceFeePage === 1}
                  style={{
                    minWidth: "32px",
                    opacity: serviceFeePage === 1 ? 0.5 : 1,
                    cursor: serviceFeePage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ←
                </button>
                {Array.from({ length: serviceFeeTotalPages }, (_, i) => i + 1)
                  .slice(Math.max(0, serviceFeePage - 3), serviceFeePage + 2)
                  .map((p) => (
                    <button
                      key={p}
                      className={`btn btn-sm px-2 ${serviceFeePage === p ? "btn-primary text-white" : "btn-outline-secondary"}`}
                      onClick={() => fetchServiceFees(p, serviceFeeSearch)}
                      style={{ minWidth: "32px" }}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  className="btn btn-sm btn-outline-secondary px-2"
                  onClick={() =>
                    fetchServiceFees(serviceFeePage + 1, serviceFeeSearch)
                  }
                  disabled={serviceFeePage === serviceFeeTotalPages}
                  style={{
                    minWidth: "32px",
                    opacity: serviceFeePage === serviceFeeTotalPages ? 0.5 : 1,
                    cursor:
                      serviceFeePage === serviceFeeTotalPages
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
      )}

      {/* ════════════════════════════════════════════════════════════════════
          SERVICE FEE CREATE / EDIT MODAL  (UPDATED)
      ════════════════════════════════════════════════════════════════════ */}
      {showServiceFeeModal && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div
                className="modal-header text-white"
                style={{
                  background: "linear-gradient(135deg, #f97316, #fb923c)",
                  borderBottom: "none",
                }}
              >
                <h5 className="modal-title">
                  {editingServiceFeeId ? "Edit" : "Add"} Service &amp; Fee
                </h5>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowServiceFeeModal(false);
                    setServiceFeeForm(initialServiceFeeForm);
                    setEditingServiceFeeId(null);
                  }}
                />
              </div>
              <form onSubmit={handleServiceFeeSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Service Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Patent Filing, Trademark Registration"
                        value={serviceFeeForm.service_name}
                        onChange={(e) =>
                          setServiceFeeForm({
                            ...serviceFeeForm,
                            service_name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={serviceFeeForm.status}
                        onChange={(e) =>
                          setServiceFeeForm({
                            ...serviceFeeForm,
                            status: e.target.value,
                          })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    {/* Fee Section Divider */}
                    <div className="col-12">
                      <div
                        style={{
                          borderTop: "2px solid #f97316",
                          margin: "4px 0 8px",
                        }}
                      />
                      <p
                        className="mb-1 fw-semibold d-flex align-items-center"
                        style={{ color: "#f97316", fontSize: 14 }}
                      >
                        <IndianRupee size={14} className="me-1" />
                        Fee Structure (INR)
                      </p>
                    </div>

                    {/* Official Fee — Small Entity */}
                    <div className="col-md-6">
                      <label
                        className="form-label text-muted"
                        style={{ fontSize: 13 }}
                      >
                        Official Fee —{" "}
                        <span className="text-primary fw-semibold">
                          Small Entity
                        </span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={serviceFeeForm.official_fee_small}
                          onChange={(e) =>
                            setServiceFeeForm({
                              ...serviceFeeForm,
                              official_fee_small: e.target.value,
                            })
                          }
                        />
                      </div>
                      <small className="text-muted">
                        Natural person, Start-up, Small entity, Educational
                        institution
                      </small>
                    </div>

                    {/* Official Fee — Large Entity */}
                    <div className="col-md-6">
                      <label
                        className="form-label text-muted"
                        style={{ fontSize: 13 }}
                      >
                        Official Fee —{" "}
                        <span
                          style={{ color: "#92400e" }}
                          className="fw-semibold"
                        >
                          Large Entity
                        </span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={serviceFeeForm.official_fee_large}
                          onChange={(e) =>
                            setServiceFeeForm({
                              ...serviceFeeForm,
                              official_fee_large: e.target.value,
                            })
                          }
                        />
                      </div>
                      <small className="text-muted">
                        Others (Large Entity)
                      </small>
                    </div>

                    {/* Our Fee */}
                    <div className="col-md-6">
                      <label
                        className="form-label text-muted"
                        style={{ fontSize: 13 }}
                      >
                        Our Fee (anovIP)
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={serviceFeeForm.our_fee}
                          onChange={(e) =>
                            setServiceFeeForm({
                              ...serviceFeeForm,
                              our_fee: e.target.value,
                            })
                          }
                        />
                      </div>
                      <small className="text-muted">Our service fee</small>
                    </div>

                    {/* Description */}
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Brief description of this service..."
                        value={serviceFeeForm.description}
                        onChange={(e) =>
                          setServiceFeeForm({
                            ...serviceFeeForm,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowServiceFeeModal(false);
                      setServiceFeeForm(initialServiceFeeForm);
                      setEditingServiceFeeId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white"
                    style={{ backgroundColor: "#f97316" }}
                  >
                    {editingServiceFeeId ? "Update" : "Save"} Service
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          EDIT USER MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {showEditModal && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit User</h5>
                <button className="btn-close" onClick={closeEditModal} />
              </div>
              <form onSubmit={handleUpdate}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Department</label>
                      <select
                        className="form-select"
                        value={editForm.department}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            department: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Select Department</option>
                        <option value="IP Management">IP Management</option>
                        <option value="Research">Research</option>
                        <option value="Legal">Legal</option>
                        <option value="Finance">Finance</option>
                        <option value="HR">HR</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Role</label>
                      <select
                        className="form-select"
                        value={editForm.role_id}
                        onChange={(e) =>
                          setEditForm({ ...editForm, role_id: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Role</option>
                        {roles.map((role) => (
                          <option key={role._id} value={role._id}>
                            {role.name.charAt(0).toUpperCase() +
                              role.name.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status: e.target.value })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    {isClientRole(editForm.role_id, roles) && (
                      <>
                        <div className="col-12">
                          <div
                            style={{
                              borderTop: "2px solid #f97316",
                              margin: "4px 0 8px",
                            }}
                          />
                          <p
                            className="mb-2 fw-semibold"
                            style={{ color: "#f97316", fontSize: 14 }}
                          >
                            Client Details
                          </p>
                        </div>
                        <div className="col-md-6">
                          <label
                            className="form-label text-muted"
                            style={{ fontSize: 13 }}
                          >
                            SPOC Name
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={editForm.name}
                            readOnly
                            style={{ background: "#f8f9fa", color: "#6c757d" }}
                          />
                          <small className="text-muted">
                            Same as Full Name above
                          </small>
                        </div>
                        <div className="col-md-6">
                          <label
                            className="form-label text-muted"
                            style={{ fontSize: 13 }}
                          >
                            Phone No.
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Phone number"
                            value={editForm.phone_no}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                phone_no: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label
                            className="form-label text-muted"
                            style={{ fontSize: 13 }}
                          >
                            Firm Name
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Firm / Company name"
                            value={editForm.firm_name}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                firm_name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label
                            className="form-label text-muted"
                            style={{ fontSize: 13 }}
                          >
                            Country
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Country"
                            value={editForm.country}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                country: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="col-12">
                          <label
                            className="form-label text-muted"
                            style={{ fontSize: 13 }}
                          >
                            Address
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Full address"
                            value={editForm.address}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                address: e.target.value,
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeEditModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Updating..." : "Update User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          BANK DETAIL CREATE / EDIT MODAL
      ════════════════════════════════════════════════════════════════════ */}
      {showBankModal && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <Landmark size={18} className="me-2" />
                  {editingBankId ? "Edit" : "Add"} Bank Detail
                </h5>
                <button
                  className="btn-close"
                  onClick={() => {
                    setShowBankModal(false);
                    setBankForm(initialBankForm);
                    setEditingBankId(null);
                  }}
                />
              </div>
              <form onSubmit={handleBankSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Bank Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. HDFC Bank"
                        value={bankForm.bank_name}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            bank_name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Bank Address</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Branch address"
                        value={bankForm.bank_address}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            bank_address: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">
                        Beneficiary Account Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Account holder name"
                        value={bankForm.beneficiary_account_name}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            beneficiary_account_name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Account No</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Bank account number"
                        value={bankForm.account_no}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            account_no: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Swift Code</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. HDFCINBB"
                        value={bankForm.swift_code}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            swift_code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">IFSC Code</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. HDFC0001234"
                        value={bankForm.ifsc_code}
                        onChange={(e) =>
                          setBankForm({
                            ...bankForm,
                            ifsc_code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">PayPal</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="PayPal email or ID"
                        value={bankForm.paypal}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, paypal: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        placeholder="Any additional notes..."
                        value={bankForm.notes}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowBankModal(false);
                      setBankForm(initialBankForm);
                      setEditingBankId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingBankId ? "Update" : "Save"} Bank Detail
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODALS */}
      {showDeleteModal && (
        <DeleteConfirmModal
          show={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
          message="Are you sure you want to delete this user?"
        />
      )}
      {showBankDeleteModal && (
        <DeleteConfirmModal
          show={showBankDeleteModal}
          onClose={() => setShowBankDeleteModal(false)}
          onConfirm={confirmBankDelete}
          message="Are you sure you want to delete this bank detail?"
        />
      )}
      {showServiceFeeDeleteModal && (
        <DeleteConfirmModal
          show={showServiceFeeDeleteModal}
          onClose={() => setShowServiceFeeDeleteModal(false)}
          onConfirm={confirmServiceFeeDelete}
          message="Are you sure you want to delete this service fee?"
        />
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && (
        <div
          className="modal fade show d-block"
          style={{ background: "rgba(0,0,0,.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Reset Password</h5>
                <button
                  className="btn-close"
                  onClick={() => {
                    setShowResetModal(false);
                    setNewPassword("");
                    setResetUserId(null);
                  }}
                />
              </div>
              <div className="modal-body">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowResetModal(false);
                    setNewPassword("");
                    setResetUserId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={submitResetPassword}
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
