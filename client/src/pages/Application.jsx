import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  Plus,
  Trash2,
  Eye,
  X,
  Edit,
  Trash,
  ArrowUp,
  ArrowDown,
  PlusIcon,
  RotateCcw,
  Pencil,
} from "lucide-react";
import Form1Generator from "./forms/Form1Generator";
import Form2Generator from "./forms/Form2Generator";
import Form3Generator from "./forms/Form3Generator";
import Form5Generator from "./forms/Form5Generator";
import Form9Generator from "./forms/Form9Generator";
import Form18Generator from "./forms/Form18Generator";
import CoverLetterGenerator from "./forms/CoverLetterGenerator";
import ReportGenerator from "./forms/ReportGenerator";
import Form26SPAGenerator from "./forms/Form26SPAGenerator.jsx";
import Form26GPAGenerator from "./forms/Form26GPAGenerator.jsx";
import { toast } from "react-toastify";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import StatsRow from "../components/StatsRow.jsx";
import useAuthStore from "../store/authStore";

const ApplicationPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAppId, setDeleteAppId] = useState(null);
  const [docketSuggestions, setDocketSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [records, setRecords] = useState([]);
  const { user, updateStats } = useAuthStore();
  const [showForm1, setShowForm1] = useState(false);
  const [showForm2, setShowForm2] = useState(false);
  const [showForm3, setShowForm3] = useState(false);
  const [showForm5, setShowForm5] = useState(false);
  const [showForm9, setShowForm9] = useState(false);
  const [showForm18, setShowForm18] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showForm26SPA, setShowForm26SPA] = useState(false);
  const [showForm26GPA, setShowForm26GPA] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 10;
  // Add these to your state definitions
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [selectedIds, setSelectedIds] = useState([]);

  const initialFormState = {
    DOC_NO: "",
    jurisdiction: "",
    application_type: "",
    applicant_category: "",
    inter_appli_no: "",
    inter_filing_date: "",
    title: "",
    applicants: [
      { name: "", nationality: "", residence_country: "", address: "" },
    ],
    inventors_same_as_applicant: "",
    inventors: [
      { name: "", citizen_country: "", residence_country: "", address: "" },
    ],
    claiming_priority: "",
    priorities: [
      {
        country: "",
        priority_no: "",
        priority_date: "",
        applicant_name: "",
        title_in_priority: "",
      },
    ],
    descrip_of_page: "",
    claims_page: "",
    drawing_page: "",
    abstract_page: 1,
    form_2_page: 1,
    sum_number_of_page: 2,
    number_of_drawing: "",
    number_of_claims: "",
    number_of_priorities: "",
    total_pages: "",
    basic_fee: 0,
    no_of_extra_page: 0,
    extra_page_charge: 0,
    no_of_extra_claims: 0,
    extra_claims_charge: 0,
    no_of_extra_priorities: 0,
    extra_priorities_charge: 0,
    request_examination: "",
    examination_charge: 0,
    sequence_listing: "",
    sequence_page: "",
    sequence_charge: 0,
    deposit_date: "",
    deposit_fee: 0,
  };

  const [formData, setFormData] = useState(initialFormState);
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    doc_number: "",
    appli_type: "",
  });

  const handleResetFilters = () => {
    const cleanPath = window.location.origin + location.pathname;
    window.location.href = cleanPath;
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
  const handleEditRecord = (record) => {
    setFormData({
      ...initialFormState,
      ...record,
      applicants:
        record.applicants?.length > 0
          ? record.applicants
          : [{ name: "", nationality: "", residence_country: "", address: "" }],
      inventors:
        record.inventors?.length > 0
          ? record.inventors
          : [
              {
                name: "",
                citizen_country: "",
                residence_country: "",
                address: "",
              },
            ],
      priorities:
        record.priorities?.length > 0
          ? record.priorities
          : [
              {
                country: "",
                priority_no: "",
                priority_date: "",
                applicant_name: "",
                title_in_priority: "",
              },
            ],
    });
    setEditingRecordId(record._id || record.id);
    setIsEditMode(true);
    setShowModal(true);
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);
      if (filters.doc_number) params.append("doc_number", filters.doc_number);
      if (filters.appli_type) params.append("appli_type", filters.appli_type);

      if (user?.role_id?.name === "staff") {
        params.append("created_by", user._id || user.id);
      }
      params.append("sortBy", sortConfig.key);
      params.append("sortOrder", sortConfig.direction);

      params.append("page", currentPage);
      params.append("limit", recordsPerPage);

      const res = await axios.get(`/api/applications?${params.toString()}`);
      setRecords(res.data.applications || res.data || []);
      setTotalRecords(res.data.total || res.data.totalRecords || 0);
    } catch (err) {
      if (!import.meta.env.PROD)
        console.error("Error fetching applications:", err);
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // fetchDashboardStats();
  }, [filters, currentPage, user]);

  // Reset to page 1 when filters change
  const handleFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
    setCurrentPage(1);
  };

  // Pagination calculations
  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 1);
      let endPage = Math.min(totalPages, startPage + 2);
      if (endPage - startPage < 2) {
        startPage = Math.max(1, endPage - 2);
      }
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  const handleDocketChange = async (e) => {
    const value = e.target.value;
    setFormData({ ...formData, DOC_NO: value });

    if (value.length > 1) {
      try {
        const res = await axios.get(`/api/applications/lookup-docket/${value}`);
        const results = res.data || [];
        setDocketSuggestions(results);
        // ALWAYS show suggestions box if length > 1, so we can show "Not found"
        setShowSuggestions(true);
      } catch (err) {
        setDocketSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setDocketSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectDocket = (docket) => {
    setFormData((prev) => ({
      ...prev,
      DOC_NO: docket.docket_no,
      title: docket.title || prev.title,
      applicants: [
        {
          name: docket.spoc_name || "",
          nationality: "",
          residence_country: docket.country || "",
          address: docket.address || "",
        },
      ],
    }));
    setShowSuggestions(false);
    setDocketSuggestions([]);
  };

  const handleDocketBlur = () =>
    setTimeout(() => setShowSuggestions(false), 200);

  const addRow = (type) => {
    const templates = {
      applicants: {
        name: "",
        nationality: "",
        residence_country: "",
        address: "",
      },
      inventors: {
        name: "",
        citizen_country: "",
        residence_country: "",
        address: "",
      },
      priorities: {
        country: "",
        priority_no: "",
        priority_date: "",
        applicant_name: "",
        title_in_priority: "",
      },
    };
    if (templates[type])
      setFormData({
        ...formData,
        [type]: [...formData[type], templates[type]],
      });
  };

  const removeRow = (type, index) => {
    const list = [...formData[type]];
    if (list.length > 1) {
      list.splice(index, 1);
      setFormData({ ...formData, [type]: list });
    }
  };

  const handleDynamicChange = (type, index, e) => {
    const { name, value } = e.target;
    const list = [...formData[type]];
    list[index][name] = value;
    setFormData({ ...formData, [type]: list });
  };

  const handleDelete = (id) => {
    setDeleteAppId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/applications/${deleteAppId}`);
      // Update local state instead of API call
      setRecords((prev) => prev.filter((r) => r._id !== deleteAppId));
      updateStats("applications", -1);
      toast.success("Application deleted successfully");
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Delete failed", err);
      toast.error(
        err?.response?.data?.message || "Something occurred. Please try again.",
      );
    } finally {
      setShowDeleteModal(false);
      setDeleteAppId(null);
    }
  };

  useEffect(() => {
    const {
      applicant_category,
      descrip_of_page,
      claims_page,
      drawing_page,
      abstract_page,
      form_2_page,
      number_of_claims,
      number_of_priorities,
      total_pages,
      request_examination,
      sequence_page,
    } = formData;

    const sumPages =
      (Number(descrip_of_page) || 0) +
      (Number(claims_page) || 0) +
      (Number(drawing_page) || 0) +
      (Number(abstract_page) || 0) +
      (Number(form_2_page) || 0);

    const isOther = applicant_category === "Other";
    const baseRate = isOther ? 8000 : 1600;
    const extraPageRate = isOther ? 800 : 160;
    const extraClaimRate = isOther ? 1600 : 320;
    const extraPriorityRate = isOther ? 8000 : 1600;
    const examRate = isOther ? 20000 : 4000;
    const seqRate = isOther ? 800 : 160;
    const seqMax = isOther ? 120000 : 24000;

    const numPages = Number(total_pages) || 0;
    const extraPages = numPages > 30 ? numPages - 30 : 0;
    const extraPageFee = extraPages * extraPageRate;

    const numClaims = Number(number_of_claims) || 0;
    const extraClaims = numClaims > 10 ? numClaims - 10 : 0;
    const extraClaimFee = extraClaims * extraClaimRate;

    const numPriorities = Number(number_of_priorities) || 0;
    const extraPriorities = numPriorities > 1 ? numPriorities - 1 : 0;
    const extraPriorityFee = extraPriorities * extraPriorityRate;

    const examFee = request_examination === "yes" ? examRate : 0;

    const seqPages = Number(sequence_page) || 0;
    let seqFee = 0;
    if (seqPages > 0) seqFee = seqPages <= 150 ? seqPages * seqRate : seqMax;

    const totalDeposit =
      baseRate +
      extraPageFee +
      extraClaimFee +
      extraPriorityFee +
      examFee +
      seqFee;

    setFormData((prev) => ({
      ...prev,
      sum_number_of_page: sumPages,
      basic_fee: baseRate,
      no_of_extra_page: extraPages,
      extra_page_charge: extraPageFee,
      no_of_extra_claims: extraClaims,
      extra_claims_charge: extraClaimFee,
      no_of_extra_priorities: extraPriorities,
      extra_priorities_charge: extraPriorityFee,
      examination_charge: examFee,
      sequence_charge: seqFee,
      deposit_fee: totalDeposit,
    }));
  }, [
    formData.applicant_category,
    formData.descrip_of_page,
    formData.claims_page,
    formData.drawing_page,
    formData.abstract_page,
    formData.form_2_page,
    formData.total_pages,
    formData.number_of_claims,
    formData.number_of_priorities,
    formData.request_examination,
    formData.sequence_page,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isUpdating = isEditMode && editingRecordId;

    // Prepare submit data with created_by for new applications
    const submitData = isUpdating
      ? formData
      : { ...formData, created_by: user?._id || user?.id };

    try {
      if (isUpdating) {
        const res = await axios.put(
          `/api/applications/${editingRecordId}`,
          submitData,
        );
        const updatedApp = res.data.application || res.data;
        // Update local records state
        setRecords((prev) =>
          prev.map((r) =>
            r._id === editingRecordId
              ? { ...r, ...updatedApp, ...formData }
              : r,
          ),
        );
        // Update selectedRecord if in detail view
        if (selectedRecord && selectedRecord._id === editingRecordId) {
          setSelectedRecord({ ...selectedRecord, ...formData });
        }
        toast.success("Application Updated Successfully");
      } else {
        const res = await axios.post(`/api/applications`, submitData);
        const newApp = res.data.application || res.data;
        // Add to local records state
        setRecords((prev) => [{ ...submitData, ...newApp }, ...prev]);
        updateStats("applications", 1);
        toast.success("Application Submitted Successfully");
      }
      setShowModal(false);
      setFormData(initialFormState);
      setIsEditMode(false);
      setEditingRecordId(null);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Submit error:", err);
      toast.error(
        isUpdating
          ? "Error updating application"
          : "Error submitting application",
      );
    }
  };

  const handleViewDetail = (record) => {
    setSelectedRecord(record);
    setIsDetailView(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 1. Sorting Handler
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // 2. Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(records.map((r) => r._id));
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
    if (!window.confirm(`Delete ${selectedIds.length} applications?`)) return;

    try {
      await Promise.all(
        selectedIds.map((id) => axios.delete(`/api/applications/${id}`)),
      );
      toast.success("Applications deleted");
      setSelectedIds([]);
      fetchApplications();
      updateStats("applications", -selectedIds.length);
    } catch (err) {
      toast.error("Error deleting applications");
    }
  };

  return (
    <div className="p-0">
      {!isDetailView ? (
        <>
          {user?.role_id?.name !== "staff" && (
            <>
              <StatsRow />
              <DeleteConfirmModal
                show={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                message="Are you sure you want to delete this Application?"
              />
            </>
          )}

          {/* Main Container Card */}
          <div style={styles.tableCard}>
            {/* Header Row with Filters & Button */}
            <div style={styles.tableHeaderRow}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Start Date</label>
                <input
                  type="date"
                  style={styles.filterInput}
                  value={filters.start_date}
                  onChange={(e) =>
                    handleFilterChange("start_date", e.target.value)
                  }
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>End Date</label>
                <input
                  type="date"
                  style={styles.filterInput}
                  value={filters.end_date}
                  onChange={(e) =>
                    handleFilterChange("end_date", e.target.value)
                  }
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>anovIP Reference</label>
                <input
                  type="text"
                  style={styles.filterInput}
                  placeholder="Docket No."
                  value={filters.doc_number}
                  onChange={(e) =>
                    handleFilterChange("doc_number", e.target.value)
                  }
                />
              </div>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Application Type</label>
                <select
                  style={styles.filterInput}
                  value={filters.appli_type}
                  onChange={(e) =>
                    handleFilterChange("appli_type", e.target.value)
                  }
                >
                  <option value="">All Types</option>
                  <option value="CONVENTION">CONVENTION</option>
                  <option value="PCT-NATIONAL-PHASE">PCT NATIONAL PHASE</option>
                </select>
              </div>
              <button style={styles.collapseBtn} onClick={handleResetFilters}>
                <RotateCcw size={18} />
              </button>
              <button
                style={styles.createBtn}
                onClick={() => {
                  setFormData(initialFormState);
                  setIsEditMode(false);
                  setEditingRecordId(null);
                  setShowModal(true);
                }}
              >
                <PlusIcon size={14} />
              </button>
            </div>

            {/* Table Section */}
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
                    className="btn btn-danger btn-sm"
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    <Trash2 size={14} style={{ marginRight: 5 }} />
                  </button>
                </div>
              )}
              <table style={styles.table}>
                <thead>
                  <tr>
                    {/* CHECKBOX COLUMN */}
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

                    {/* SORTABLE COLUMNS */}
                    <th
                      style={{
                        ...styles.th,
                        ...styles.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("DOC_NO")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Ref No
                        {sortConfig.key === "DOC_NO" &&
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
                      onClick={() => handleSort("title")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Title
                        {sortConfig.key === "title" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>

                    <th style={{ ...styles.th, ...styles.stickyHeader }}>
                      Applicant
                    </th>

                    <th
                      style={{
                        ...styles.th,
                        ...styles.stickyHeader,
                        cursor: "pointer",
                      }}
                      onClick={() => handleSort("applicant_category")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Category
                        {sortConfig.key === "applicant_category" &&
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
                      onClick={() => handleSort("application_type")}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        Application Type
                        {sortConfig.key === "application_type" &&
                          (sortConfig.direction === "asc" ? (
                            <ArrowUp size={12} />
                          ) : (
                            <ArrowDown size={12} />
                          ))}
                      </div>
                    </th>

                    {user?.role_id?.name !== "staff" && (
                      <th style={{ ...styles.th, ...styles.stickyHeader }}>
                        Created By
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={styles.tdCenter}>
                        Loading...
                      </td>
                    </tr>
                  ) : records.length > 0 ? (
                    records.map((r) => (
                      <tr
                        key={r._id}
                        style={{
                          ...styles.tr,
                          backgroundColor: selectedIds.includes(r._id)
                            ? "#eff6ff"
                            : "transparent",
                        }}
                      >
                        {/* ROW CHECKBOX */}
                        <td style={styles.td}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(r._id)}
                            onChange={() => handleSelectRow(r._id)}
                          />
                        </td>
                        <td style={styles.td}>
                          <div className="d-flex gap-2">
                            <span
                              className="text-success"
                              onClick={() => handleViewDetail(r)}
                              title="View Details"
                            >
                              <Eye style={{ scale: "0.7" }} />
                            </span>

                            <span
                              style={{ color: "#f97316" }}
                              onClick={() => handleEditRecord(r)}
                              title="Edit"
                            >
                              <Pencil style={{ scale: "0.7" }} />
                            </span>

                            {/* <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDelete(r._id)}
                              title="Delete"
                            >
                              <Trash size={14} />
                            </button> */}
                          </div>
                        </td>

                        {/* DATA CELLS */}
                        <td style={styles.td}>
                          <span className="fw-medium">{r.DOC_NO}</span>
                        </td>
                        <td style={styles.td}>
                          <div
                            style={{
                              maxWidth: "250px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={r.title}
                          >
                            {r.title}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {r.applicants?.[0]?.name || "-"}
                        </td>
                        <td style={styles.td}>
                          <span
                            className={`badge ${
                              r.applicant_category === "Other"
                                ? "bg-warning"
                                : r.applicant_category === "Natural"
                                  ? "bg-info"
                                  : r.applicant_category === "Small"
                                    ? "bg-success"
                                    : r.applicant_category === "Start"
                                      ? "bg-primary"
                                      : "bg-secondary"
                            }`}
                          >
                            {r.applicant_category || "-"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span
                            className={`badge ${
                              r.application_type === "CONVENTION"
                                ? "bg-primary"
                                : r.application_type === "PCT-NATIONAL-PHASE"
                                  ? "bg-success"
                                  : "bg-secondary"
                            }`}
                          >
                            {r.application_type || "-"}
                          </span>
                        </td>
                        {user?.role_id?.name !== "staff" && (
                          <td style={styles.td}>{r.created_by_name || "-"}</td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={styles.tdCenter}>
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {records.length > 0 && (
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
            )}
          </div>
        </>
      ) : (
        // ... Rest of your existing code (Detail View) ... : (
        <div className="card shadow border-0">
          <div className="card-header bg-white d-flex justify-content-between align-items-center py-3 border-bottom">
            <div>
              <button
                className="btn btn-warning px-4 py-1"
                onClick={() => handleEditRecord(selectedRecord)}
              >
                <Edit size={16} className="me-1" /> Edit
              </button>
            </div>
            <button
              className="btn btn-danger btn-sm p-1 rounded-1"
              onClick={() => setIsDetailView(false)}
              style={{ backgroundColor: "#ff5c33" }}
            >
              <X size={20} className="text-white" />
            </button>
          </div>
          <div className="card-body p-0">
            <div className="px-3 pt-3">
              <ul className="nav nav-tabs border-bottom-0">
                <li className="nav-item">
                  <span
                    className="nav-link active fw-normal"
                    style={{ borderTop: "2px solid #0d6efd", color: "#333" }}
                  >
                    Full Description
                  </span>
                </li>
              </ul>
            </div>
            <div className="p-4 mx-3 mb-3 border border-top-0 rounded-bottom">
              <h6 className="fw-bold mb-4" style={{ color: "#002a5c" }}>
                Application Details
              </h6>
              <div className="d-flex flex-wrap gap-2 mb-4">
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm1(true)}
                >
                  Form1
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm2(true)}
                >
                  Form2
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm3(true)}
                >
                  Form3
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm5(true)}
                >
                  Form5
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm9(true)}
                >
                  Form9
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm18(true)}
                >
                  Form18
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowCoverLetter(true)}
                >
                  Coverletter
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowReport(true)}
                >
                  Report
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm26SPA(true)}
                >
                  Form26 NP-0
                </button>
                <button
                  className="btn btn-primary btn-sm px-3"
                  onClick={() => setShowForm26GPA(true)}
                >
                  Form26 ONP-0
                </button>
              </div>
              <div className="border rounded overflow-hidden">
                <div
                  className="row g-0 border-bottom"
                  style={{ backgroundColor: "#f8f9fa" }}
                >
                  <div className="col-md-3 p-3 text-muted border-end">
                    Date :
                  </div>
                  <div className="col-md-3 p-3 border-end text-primary">
                    {selectedRecord?.deposit_date
                      ? formatDate(selectedRecord.deposit_date)
                      : "-"}
                  </div>

                  <div className="col-md-3 p-3 text-muted border-end">
                    anovIP Ref. No. :
                  </div>
                  <div className="col-md-3 p-3 text-primary">
                    {selectedRecord?.DOC_NO}
                  </div>
                </div>
                <div className="row g-0 border-bottom">
                  <div className="col-md-3 p-3 text-muted border-end">
                    Application Type :
                  </div>
                  <div className="col-md-3 p-3 border-end text-primary text-uppercase">
                    {selectedRecord?.application_type}
                  </div>
                  <div className="col-md-3 p-3 text-muted border-end">
                    Title :
                  </div>
                  <div className="col-md-3 p-3 text-primary text-uppercase">
                    {selectedRecord?.title}
                  </div>
                </div>

                <div className="row g-0" style={{ backgroundColor: "#f8f9fa" }}>
                  <div className="col-md-3 p-3 text-muted border-end">
                    Created By :
                  </div>
                  <div className="col-md-3 p-3 border-end text-primary">
                    {selectedRecord?.created_by_name || "-"}
                  </div>
                  <div className="col-md-3 p-3 text-muted border-end">
                    Created At :
                  </div>
                  <div className="col-md-3 p-3 text-primary">
                    {selectedRecord?.createdAt
                      ? formatDateDetail(selectedRecord.createdAt)
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-fullscreen p-5 ">
            <div className="modal-content rounded-3">
              <div className="modal-header">
                <h5 className="modal-title">
                  {isEditMode ? "Edit Application" : "Create Application"}
                  {isEditMode && (
                    <span className="badge bg-warning ms-2">Editing</span>
                  )}
                </h5>
                <button
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form className="modal-body" onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-lg-7">
                    <label className="form-label">
                      <u>
                        <b>Basic Details</b>
                      </u>
                    </label>
                    <div className="row small-height-input px-4">
                      <div className="col-md-3 col-12 mb-2 position-relative">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="DOC_NO"
                            className="form-control"
                            placeholder="DOCKET_NO"
                            value={formData.DOC_NO}
                            onChange={handleDocketChange}
                            onBlur={handleDocketBlur}
                            autoComplete="off"
                            required
                          />
                          <label>Docket No</label>
                        </div>
                        {showSuggestions && (
                          <div
                            className="position-absolute w-100 bg-white border rounded shadow-lg mt-1"
                            style={{
                              zIndex: 1000,
                              maxHeight: "200px",
                              overflowY: "auto",
                            }}
                          >
                            {docketSuggestions.length > 0 ? (
                              docketSuggestions.map((d, i) => (
                                <div
                                  key={i}
                                  className="p-2 border-bottom suggestion-item"
                                  style={{ cursor: "pointer" }}
                                  onMouseDown={() => selectDocket(d)}
                                >
                                  <div className="fw-bold small">
                                    {d.docket_no}
                                  </div>
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: "11px" }}
                                  >
                                    {d.title?.substring(0, 30)}...
                                  </div>
                                </div>
                              ))
                            ) : (
                              /* NO RESULTS FOUND MESSAGE */
                              <div className="p-3 text-center border-bottom text-danger small">
                                No docket found matching "
                                <strong>{formData.DOC_NO}</strong>"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="col-md-3 col-12 mb-2">
                        <div className="form-floating">
                          <select
                            className="form-control"
                            name="jurisdiction"
                            value={formData.jurisdiction}
                            onChange={handleInputChange}
                            required
                          >
                            <option value="">Select</option>
                            <option value="New Delhi">NEW DELHI</option>
                            <option value="Mumbai">MUMBAI</option>
                            <option value="Kolkata">KOLKATA</option>
                            <option value="Chennai">CHENNAI</option>
                          </select>
                          <label>Select Jurisdiction</label>
                        </div>
                      </div>
                      <div className="col-md-3 col-12 mb-3">
                        <div className="form-floating">
                          <select
                            className="form-control"
                            name="application_type"
                            value={formData.application_type}
                            onChange={handleInputChange}
                            required
                          >
                            <option value="">Select</option>
                            <option value="CONVENTION">CONVENTION</option>
                            <option value="PCT-NATIONAL-PHASE">
                              PCT NATIONAL PHASE
                            </option>
                          </select>
                          <label>Type of Application</label>
                        </div>
                      </div>
                      <div className="col-md-3 col-12 mb-3">
                        <div className="form-floating">
                          <select
                            className="form-control"
                            name="applicant_category"
                            value={formData.applicant_category}
                            onChange={handleInputChange}
                            required
                          >
                            <option value="">Select</option>
                            <option value="Natural">NATURAL PERSON</option>
                            <option value="Small">SMALL ENTITY</option>
                            <option value="Start">STARTUP</option>
                            <option value="education">EDUCATION</option>
                            <option value="Other">OTHER</option>
                          </select>
                          <label>Applicant Category</label>
                        </div>
                      </div>
                      {formData.application_type === "PCT-NATIONAL-PHASE" && (
                        <div className="col-md-12 mb-3">
                          <table className="table table-bordered">
                            <tbody>
                              <tr>
                                <td>
                                  <input
                                    type="text"
                                    name="inter_appli_no"
                                    placeholder="INTERNATIONAL APPLICATION NUMBER"
                                    className="form-control"
                                    value={formData.inter_appli_no}
                                    onChange={handleInputChange}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="date"
                                    name="inter_filing_date"
                                    className="form-control"
                                    value={formData.inter_filing_date}
                                    onChange={handleInputChange}
                                  />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="col-md-12 col-12 mb-3">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="title"
                            className="form-control"
                            placeholder="TITLE OF THE INVENTION"
                            value={formData.title}
                            onChange={handleInputChange}
                          />
                          <label>Title of the Invention</label>
                        </div>
                      </div>
                      <div className="col-md-12">
                        <label className="form-label">
                          <u>
                            <b>Applicant Details</b>
                          </u>
                        </label>
                        <table className="table table-bordered mb-4">
                          <tbody>
                            {formData.applicants.map((row, idx) => (
                              <tr key={idx}>
                                <td>
                                  <div className="form-floating">
                                    <input
                                      type="text"
                                      name="name"
                                      className="form-control"
                                      placeholder="Applicant's Name"
                                      value={row.name}
                                      onChange={(e) =>
                                        handleDynamicChange(
                                          "applicants",
                                          idx,
                                          e,
                                        )
                                      }
                                      required
                                    />
                                    <label>Applicant's Name</label>
                                  </div>
                                </td>
                                <td>
                                  <div className="form-floating">
                                    <input
                                      type="text"
                                      name="nationality"
                                      className="form-control"
                                      placeholder="Nationality"
                                      value={row.nationality}
                                      onChange={(e) =>
                                        handleDynamicChange(
                                          "applicants",
                                          idx,
                                          e,
                                        )
                                      }
                                      required
                                    />
                                    <label>Nationality</label>
                                  </div>
                                </td>
                                <td>
                                  <div className="form-floating">
                                    <input
                                      type="text"
                                      name="residence_country"
                                      className="form-control"
                                      placeholder="Country Of Residence"
                                      value={row.residence_country}
                                      onChange={(e) =>
                                        handleDynamicChange(
                                          "applicants",
                                          idx,
                                          e,
                                        )
                                      }
                                      required
                                    />
                                    <label>Country Of Residence</label>
                                  </div>
                                </td>
                                <td>
                                  <div className="form-floating">
                                    <input
                                      type="text"
                                      name="address"
                                      className="form-control"
                                      placeholder="Address"
                                      value={row.address}
                                      onChange={(e) =>
                                        handleDynamicChange(
                                          "applicants",
                                          idx,
                                          e,
                                        )
                                      }
                                      required
                                    />
                                    <label>Address</label>
                                  </div>
                                </td>
                                <td>
                                  {idx === 0 ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => addRow("applicants")}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={() =>
                                        removeRow("applicants", idx)
                                      }
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="row">
                          <label className="form-label mb-4">
                            <u>
                              <b>Inventor Details</b>
                            </u>
                          </label>
                          <div className="col-md-12 col-12 mb-4">
                            <div className="form-floating">
                              <select
                                className="form-select form-control"
                                name="inventors_same_as_applicant"
                                value={formData.inventors_same_as_applicant}
                                onChange={handleInputChange}
                                required
                              >
                                <option value="">Select</option>
                                <option value="yes">YES</option>
                                <option value="no">No</option>
                              </select>
                              <label>Inventor are same the applicant</label>
                            </div>
                          </div>
                          {formData.inventors_same_as_applicant === "no" && (
                            <div className="col-md-12 col-12">
                              <table className="table table-bordered mb-4">
                                <tbody>
                                  {formData.inventors.map((row, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <div className="form-floating">
                                          <input
                                            type="text"
                                            name="name"
                                            className="form-control"
                                            placeholder="Inventor's Name"
                                            value={row.name}
                                            onChange={(e) =>
                                              handleDynamicChange(
                                                "inventors",
                                                idx,
                                                e,
                                              )
                                            }
                                          />
                                          <label>Inventor's Name</label>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="form-floating">
                                          <input
                                            type="text"
                                            name="citizen_country"
                                            className="form-control"
                                            placeholder="Citizen of country"
                                            value={row.citizen_country}
                                            onChange={(e) =>
                                              handleDynamicChange(
                                                "inventors",
                                                idx,
                                                e,
                                              )
                                            }
                                          />
                                          <label>Citizen of Country</label>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="form-floating">
                                          <input
                                            type="text"
                                            name="residence_country"
                                            className="form-control"
                                            placeholder="Residence Country"
                                            value={row.residence_country}
                                            onChange={(e) =>
                                              handleDynamicChange(
                                                "inventors",
                                                idx,
                                                e,
                                              )
                                            }
                                          />
                                          <label>Country Of Residence</label>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="form-floating">
                                          <input
                                            type="text"
                                            name="address"
                                            className="form-control"
                                            placeholder="Inventor Address"
                                            value={row.address}
                                            onChange={(e) =>
                                              handleDynamicChange(
                                                "inventors",
                                                idx,
                                                e,
                                              )
                                            }
                                          />
                                          <label>Inventor Address</label>
                                        </div>
                                      </td>
                                      <td>
                                        {idx === 0 ? (
                                          <button
                                            type="button"
                                            className="btn btn-primary btn-sm"
                                            onClick={() => addRow("inventors")}
                                          >
                                            <Plus size={14} />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn btn-danger btn-sm"
                                            onClick={() =>
                                              removeRow("inventors", idx)
                                            }
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <label className="form-label mb-4">
                            <u>
                              <b>Priority</b>
                            </u>
                          </label>
                          <div className="col-md-12 col-12 mb-4">
                            <div className="form-floating">
                              <select
                                className="form-select form-control"
                                name="claiming_priority"
                                value={formData.claiming_priority}
                                onChange={handleInputChange}
                              >
                                <option value="">Select</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                              </select>
                              <label>Claiming Priority</label>
                            </div>
                          </div>
                        </div>
                        {formData.claiming_priority === "yes" && (
                          <table className="table table-bordered mb-4">
                            <tbody>
                              {formData.priorities.map((row, idx) => (
                                <tr key={idx}>
                                  <td>
                                    <div className="form-floating">
                                      <input
                                        type="text"
                                        name="country"
                                        className="form-control"
                                        placeholder="Priority Country"
                                        value={row.country}
                                        onChange={(e) =>
                                          handleDynamicChange(
                                            "priorities",
                                            idx,
                                            e,
                                          )
                                        }
                                      />
                                      <label>Priority Country</label>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="form-floating">
                                      <input
                                        type="text"
                                        name="priority_no"
                                        className="form-control"
                                        placeholder="Priority No"
                                        value={row.priority_no}
                                        onChange={(e) =>
                                          handleDynamicChange(
                                            "priorities",
                                            idx,
                                            e,
                                          )
                                        }
                                      />
                                      <label>Priority No</label>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="form-floating">
                                      <input
                                        type="date"
                                        name="priority_date"
                                        className="form-control"
                                        value={row.priority_date}
                                        onChange={(e) =>
                                          handleDynamicChange(
                                            "priorities",
                                            idx,
                                            e,
                                          )
                                        }
                                      />
                                      <label>Priority Date</label>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="form-floating">
                                      <input
                                        type="text"
                                        name="applicant_name"
                                        className="form-control"
                                        placeholder="Applicant Name"
                                        value={row.applicant_name}
                                        onChange={(e) =>
                                          handleDynamicChange(
                                            "priorities",
                                            idx,
                                            e,
                                          )
                                        }
                                      />
                                      <label>Applicant Name</label>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="form-floating">
                                      <input
                                        type="text"
                                        name="title_in_priority"
                                        className="form-control"
                                        placeholder="Title In Priority"
                                        value={row.title_in_priority}
                                        onChange={(e) =>
                                          handleDynamicChange(
                                            "priorities",
                                            idx,
                                            e,
                                          )
                                        }
                                      />
                                      <label>Title In Priority</label>
                                    </div>
                                  </td>
                                  <td>
                                    {idx === 0 ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => addRow("priorities")}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        onClick={() =>
                                          removeRow("priorities", idx)
                                        }
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-5">
                    <label className="form-label">
                      <u>
                        <b>Specification</b>
                      </u>
                    </label>
                    <div className="row">
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="descrip_of_page"
                            className="form-control"
                            value={formData.descrip_of_page}
                            onChange={handleInputChange}
                            required
                          />
                          <label>Description</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="claims_page"
                            className="form-control"
                            value={formData.claims_page}
                            onChange={handleInputChange}
                            required
                          />
                          <label>Claims Pages</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="drawing_page"
                            className="form-control"
                            value={formData.drawing_page}
                            onChange={handleInputChange}
                          />
                          <label>Drawing Pages</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="abstract_page"
                            className="form-control bg-light"
                            value={formData.abstract_page}
                            readOnly
                          />
                          <label>Abstract Page</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="form_2_page"
                            className="form-control bg-light"
                            value={formData.form_2_page}
                            readOnly
                          />
                          <label>Form 2</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="sum_number_of_page"
                            className="form-control bg-light"
                            value={formData.sum_number_of_page}
                            readOnly
                          />
                          <label>Sum Of Pages</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="number_of_drawing"
                            className="form-control"
                            value={formData.number_of_drawing}
                            onChange={handleInputChange}
                          />
                          <label>No of Drawing</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="number_of_claims"
                            className="form-control"
                            value={formData.number_of_claims}
                            onChange={handleInputChange}
                            required
                          />
                          <label>No. of claim</label>
                        </div>
                      </div>
                      <div className="col-md-4 col-12 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="number_of_priorities"
                            className="form-control"
                            value={formData.number_of_priorities}
                            onChange={handleInputChange}
                            required
                          />
                          <label>No. of Priorities</label>
                        </div>
                      </div>
                      <div className="col-md-8 mb-4">
                        <div className="form-floating">
                          <input
                            type="number"
                            name="total_pages"
                            className="form-control"
                            value={formData.total_pages}
                            onChange={handleInputChange}
                            required
                          />
                          <label>Total Pages</label>
                        </div>
                      </div>
                      <div className="col-md-4 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="basic_fee"
                            className="form-control bg-light"
                            value={formData.basic_fee}
                            readOnly
                          />
                          <label>Basic Fees</label>
                        </div>
                      </div>
                      <div className="col-md-8 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="no_of_extra_page"
                            className="form-control bg-light"
                            value={formData.no_of_extra_page}
                            readOnly
                          />
                          <label>Extra Pages</label>
                        </div>
                      </div>
                      <div className="col-md-4 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="extra_page_charge"
                            className="form-control bg-light"
                            value={formData.extra_page_charge}
                            readOnly
                          />
                          <label>Extra Page Fees</label>
                        </div>
                      </div>
                      <div className="col-md-8 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="no_of_extra_claims"
                            className="form-control bg-light"
                            value={formData.no_of_extra_claims}
                            readOnly
                          />
                          <label>Extra Claims</label>
                        </div>
                      </div>
                      <div className="col-md-4 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="extra_claims_charge"
                            className="form-control bg-light"
                            value={formData.extra_claims_charge}
                            readOnly
                          />
                          <label>Extra Claims Fees</label>
                        </div>
                      </div>
                      <div className="col-md-8 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="no_of_extra_priorities"
                            className="form-control bg-light"
                            value={formData.no_of_extra_priorities}
                            readOnly
                          />
                          <label>Extra Priority</label>
                        </div>
                      </div>
                      <div className="col-md-4 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="extra_priorities_charge"
                            className="form-control bg-light"
                            value={formData.extra_priorities_charge}
                            readOnly
                          />
                          <label>Extra Pr. Fees</label>
                        </div>
                      </div>
                      <div className="col-md-8 mb-4">
                        <div className="form-floating">
                          <select
                            className="form-select form-control"
                            name="request_examination"
                            value={formData.request_examination}
                            onChange={handleInputChange}
                            required
                          >
                            <option value="">Select</option>
                            <option value="yes">YES</option>
                            <option value="no">NO</option>
                          </select>
                          <label>Request For Examination</label>
                        </div>
                      </div>
                      <div className="col-md-4 mb-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="examination_charge"
                            className="form-control bg-light"
                            value={formData.examination_charge}
                            readOnly
                          />
                          <label>Examination Fees</label>
                        </div>
                      </div>
                      <div className="col-md-12 col-12 mb-4">
                        <div className="form-floating">
                          <select
                            className="form-select form-control"
                            name="sequence_listing"
                            value={formData.sequence_listing}
                            onChange={handleInputChange}
                            required
                          >
                            <option value="">Select</option>
                            <option value="yes">YES</option>
                            <option value="no">NO</option>
                          </select>
                          <label>Sequence Listing</label>
                        </div>
                      </div>
                      {formData.sequence_listing === "yes" && (
                        <div className="col-md-12 col-12">
                          <div className="row">
                            <div className="col-md-8 col-12 mb-4">
                              <div className="form-floating">
                                <input
                                  type="number"
                                  name="sequence_page"
                                  className="form-control"
                                  value={formData.sequence_page}
                                  onChange={handleInputChange}
                                />
                                <label>Sequence page</label>
                              </div>
                            </div>
                            <div className="col-md-4 col-12 mb-4">
                              <div className="form-floating">
                                <input
                                  type="text"
                                  name="sequence_charge"
                                  className="form-control bg-light"
                                  value={formData.sequence_charge}
                                  readOnly
                                />
                                <label>Sequence Fees</label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="col-8">
                        <div className="form-floating">
                          <input
                            type="date"
                            name="deposit_date"
                            className="form-control"
                            value={formData.deposit_date}
                            onChange={handleInputChange}
                          />
                          <label>Deposit Date</label>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="form-floating">
                          <input
                            type="text"
                            name="deposit_fee"
                            className="form-control bg-light"
                            value={formData.deposit_fee}
                            readOnly
                          />
                          <label>Deposit Fee</label>
                        </div>
                      </div>
                      <div className="col-12 mt-4">
                        <button type="submit" className="btn btn-primary w-100">
                          Submit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showForm1 && (
        <Form1Generator
          formData={selectedRecord}
          onClose={() => setShowForm1(false)}
        />
      )}
      {showForm2 && (
        <Form2Generator
          formData={selectedRecord}
          onClose={() => setShowForm2(false)}
        />
      )}
      {showForm3 && (
        <Form3Generator
          formData={selectedRecord}
          onClose={() => setShowForm3(false)}
        />
      )}
      {showForm5 && (
        <Form5Generator
          formData={selectedRecord}
          onClose={() => setShowForm5(false)}
        />
      )}
      {showForm9 && (
        <Form9Generator
          formData={selectedRecord}
          onClose={() => setShowForm9(false)}
        />
      )}
      {showForm18 && (
        <Form18Generator
          formData={selectedRecord}
          onClose={() => setShowForm18(false)}
        />
      )}
      {showCoverLetter && (
        <CoverLetterGenerator
          formData={selectedRecord}
          onClose={() => setShowCoverLetter(false)}
        />
      )}
      {showReport && (
        <ReportGenerator
          formData={selectedRecord}
          onClose={() => setShowReport(false)}
        />
      )}
      {showForm26SPA && (
        <Form26SPAGenerator
          formData={selectedRecord}
          onClose={() => setShowForm26SPA(false)}
        />
      )}
      {showForm26GPA && (
        <Form26GPAGenerator
          formData={selectedRecord}
          onClose={() => setShowForm26GPA(false)}
        />
      )}
      <style>{`.suggestion-item:hover { background-color: #f0f0f0; } .form-floating > .form-control, .form-floating > .form-select { height: calc(2.5em + 0.75rem + 2px); } .form-floating > label { padding: 0.5rem 0.75rem; }`}</style>
    </div>
  );
};

const paginationStyles = {
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
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
};

// ... existing imports and component code ...

// PASTE THIS AT THE VERY BOTTOM OF THE FILE (REPLACING paginationStyles)
const styles = {
  container: { padding: "20px" },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tableHeaderRow: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    marginBottom: "20px",
    gap: "15px",
    flexWrap: "wrap",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", color: "#6b7280", fontWeight: "500" },
  filterInput: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    width: "220px", // Adjusted slightly for 4 filters
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
    whiteSpace: "nowrap",
  },
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
    backgroundColor: "#f9fafb", // Important: needs background to cover scrolling content
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
  td: {
    padding: "14px 10px",
    color: "#374151",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },
  tdCenter: { padding: "30px", textAlign: "center", color: "#9ca3af" },
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
    padding: "9px 12px",
    fontSize: "12px",
    color: "#6b7280",
    cursor: "pointer",
    fontWeight: "500",
    transition: "all 0.2s ease",
  },
};

export default ApplicationPage;
