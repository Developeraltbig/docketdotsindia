import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Eye,
  Search,
  X,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Icons
const DocketIcon = () => (
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
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const AttentionIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#ef4444"
    strokeWidth="2"
  >
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

// Stat Card Component
const StatCard = ({ icon, title, count, color = "#fff7ed" }) => (
  <div style={styles.statCard}>
    <div style={styles.statCardContent}>
      <div style={{ ...styles.iconWrapper, backgroundColor: color }}>
        {icon}
      </div>
      <div style={styles.statInfo}>
        <span style={styles.statTitle}>{title}</span>
        <span style={styles.statCount}>{String(count).padStart(2, "0")}</span>
      </div>
    </div>
  </div>
);

// Upcoming Deadline Card Component
const UpcomingDeadlineCard = ({ deadlines = [] }) => (
  <div style={styles.deadlineCard}>
    <div style={styles.deadlineHeader}>
      <span style={styles.deadlineTitle}>📅 Upcoming</span>
      <span style={styles.deadlineWeek}>This Week</span>
    </div>
    <div style={styles.deadlineContent}>
      {deadlines.length === 0 ? (
        <p style={styles.noDeadline}>No upcoming deadlines 🎉</p>
      ) : (
        deadlines.slice(0, 3).map((item, index) => (
          <div key={index} style={styles.deadlineItem}>
            <div style={styles.deadlineItemLeft}>
              <p style={styles.deadlineItemTitle}>{item.title}</p>
              <p style={styles.deadlineItemSub}>
                {item.docketTitle?.substring(0, 25)}
                {item.docketTitle?.length > 25 ? "..." : ""}
              </p>
            </div>
            <div style={styles.deadlineItemRight}>
              <p style={styles.deadlineRef}>{item.reference}</p>
              <p style={styles.deadlineDate}>{item.date}</p>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// Docket Detail Modal with Deadlines
const DocketDetailModal = ({ docket, deadlines = [], onClose, loading }) => {
  const [activeTab, setActiveTab] = useState("details");

  if (!docket) return null;

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

  const Section = ({ title, children }) => (
    <div style={styles.modalSection}>
      <h4 style={styles.modalSectionTitle}>{title}</h4>
      <div style={styles.modalSectionContent}>{children}</div>
    </div>
  );

  const Field = ({ label, value }) => (
    <div style={styles.modalField}>
      <span style={styles.modalLabel}>{label}</span>
      <span style={styles.modalValue}>{value || "--"}</span>
    </div>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "ON":
        return { bg: "#dcfce7", color: "#16a34a" };
      case "COMPLETED":
        return { bg: "#dbeafe", color: "#2563eb" };
      case "PENDING":
        return { bg: "#fef3c7", color: "#d97706" };
      case "OFF":
        return { bg: "#f3f4f6", color: "#6b7280" };
      default:
        return { bg: "#f3f4f6", color: "#6b7280" };
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTabs}>
            <button
              style={{
                ...styles.modalTab,
                ...(activeTab === "details" ? styles.modalTabActive : {}),
              }}
              onClick={() => setActiveTab("details")}
            >
              Docket Details
            </button>
            <button
              style={{
                ...styles.modalTab,
                ...(activeTab === "deadlines" ? styles.modalTabActive : {}),
              }}
              onClick={() => setActiveTab("deadlines")}
            >
              Deadlines ({deadlines.length})
            </button>
          </div>
          <button style={styles.modalCloseBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.modalBody}>
          {loading ? (
            <div style={styles.loadingCenter}>Loading...</div>
          ) : activeTab === "details" ? (
            <>
              <Section title="Service Information">
                <div style={styles.fieldGrid}>
                  <Field
                    label="Docket No"
                    value={docket.docket_no || docket.reference}
                  />
                  <Field
                    label="Instruction Date"
                    value={formatDate(docket.instruction_date)}
                  />
                  <Field label="Service Name" value={docket.service_name} />
                  <Field label="Client Reference" value={docket.client_ref} />
                  <Field label="Currency" value={docket.currency} />
                  <Field label="Anovip Fee" value={docket.anovipfee} />
                  <Field label="Associate Fee" value={docket.associatefee} />
                  <Field label="Official Fee" value={docket.officialfee} />
                  <Field label="Total Fee" value={docket.fee} />
                </div>
              </Section>

              <Section title="Application Details">
                <div style={styles.fieldGrid}>
                  <Field label="Title" value={docket.title} />
                  <Field
                    label="Application Type"
                    value={docket.application_type}
                  />
                  <Field
                    label="Application No"
                    value={docket.application_no || docket.application_number}
                  />
                  <Field
                    label="Filing Country"
                    value={docket.filling_country}
                  />
                  <Field
                    label="Filing Date"
                    value={formatDate(docket.filling_date)}
                  />
                  <Field label="Applicant Type" value={docket.applicant_type} />
                  <Field
                    label="Field of Invention"
                    value={docket.field_of_invention}
                  />
                  <Field
                    label="PCT Application Date"
                    value={formatDate(docket.pct_application_date)}
                  />
                  <Field
                    label="Corresponding App No"
                    value={docket.corresponding_application_no}
                  />
                </div>
              </Section>

              <Section title="Status Information">
                <div style={styles.fieldGrid}>
                  <Field
                    label="Application Status"
                    value={docket.application_status}
                  />
                  <Field label="Status" value={docket.status} />
                  <Field label="Due Date" value={formatDate(docket.due_date)} />
                </div>
              </Section>

              <Section title="Client Details">
                <div style={styles.fieldGrid}>
                  <Field label="SPOC Name" value={docket.spoc_name} />
                  <Field label="Firm Name" value={docket.firm_name} />
                  <Field label="Email" value={docket.email} />
                  <Field label="Phone" value={docket.phone_no} />
                  <Field label="Country" value={docket.country} />
                  <Field label="Address" value={docket.address} />
                </div>
              </Section>

              {(docket.associate_firm_name || docket.associate_spoc_name) && (
                <Section title="Associate Details">
                  <div style={styles.fieldGrid}>
                    <Field
                      label="Reference No"
                      value={docket.associate_ref_no}
                    />
                    <Field
                      label="SPOC Name"
                      value={docket.associate_spoc_name}
                    />
                    <Field
                      label="Firm Name"
                      value={docket.associate_firm_name}
                    />
                    <Field label="Email" value={docket.associate_email} />
                    <Field label="Phone" value={docket.associate_phone_no} />
                    <Field label="Country" value={docket.associate_country} />
                    <Field label="Address" value={docket.associate_address} />
                  </div>
                </Section>
              )}

              {docket.applicants?.length > 0 && (
                <Section title="Applicants">
                  {docket.applicants.map((app, i) => (
                    <div key={i} style={styles.listItem}>
                      <span style={styles.listIndex}>{i + 1}.</span>
                      <span>{app.name || app}</span>
                    </div>
                  ))}
                </Section>
              )}

              {docket.inventors?.length > 0 && (
                <Section title="Inventors">
                  {docket.inventors.map((inv, i) => (
                    <div key={i} style={styles.listItem}>
                      <span style={styles.listIndex}>{i + 1}.</span>
                      <span>{inv.name || inv}</span>
                    </div>
                  ))}
                </Section>
              )}

              {docket.priorities?.length > 0 && (
                <Section title="Priority Claims">
                  {docket.priorities.map((p, i) => (
                    <div key={i} style={styles.priorityItem}>
                      <Field label="Priority No" value={p.priority_no} />
                      <Field
                        label="Priority Date"
                        value={formatDate(p.priority_date)}
                      />
                      <Field label="Country" value={p.country} />
                    </div>
                  ))}
                </Section>
              )}

              {/* {docket.file_images?.length > 0 && (
                <Section title="Attached Files">
                  <div style={styles.fileList}>
                    {docket.file_images.map((file, i) => (
                      <a
                        key={i}
                        href={`/uploads/${file}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.fileLink}
                      >
                        📄 {file}
                      </a>
                    ))}
                  </div>
                </Section>
              )} */}
            </>
          ) : (
            <div style={styles.deadlinesTab}>
              {deadlines.length === 0 ? (
                <div style={styles.noDeadlinesMsg}>
                  No deadlines found for this docket
                </div>
              ) : (
                <table style={styles.deadlineTable}>
                  <thead>
                    <tr>
                      <th style={styles.deadlineTh}>Action</th>
                      <th style={styles.deadlineTh}>Deadline Date</th>
                      <th style={styles.deadlineTh}>Status</th>
                      <th style={styles.deadlineTh}>Remarks</th>
                      <th style={styles.deadlineTh}>Remainders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadlines.map((d, i) => {
                      const statusStyle = getStatusColor(d.status);
                      return (
                        <tr key={d._id || i} style={styles.deadlineTr}>
                          <td style={styles.deadlineTd}>
                            {d.worktype || "--"}
                          </td>
                          <td style={styles.deadlineTd}>
                            {formatDate(d.deadline_date)}
                          </td>
                          <td style={styles.deadlineTd}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                backgroundColor: statusStyle.bg,
                                color: statusStyle.color,
                              }}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td style={styles.deadlineTd}>
                            {d.remarks?.substring(0, 50) || "--"}
                          </td>
                          <td style={styles.deadlineTd}>
                            <div style={styles.remainderList}>
                              {d.remainder1 && (
                                <span style={styles.remainderItem}>
                                  R1: {formatDate(d.remainder1)}
                                </span>
                              )}
                              {d.remainder2 && (
                                <span style={styles.remainderItem}>
                                  R2: {formatDate(d.remainder2)}
                                </span>
                              )}
                              {d.remainder3 && (
                                <span style={styles.remainderItem}>
                                  R3: {formatDate(d.remainder3)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Client Dashboard Component
export default function ClientDashboard() {
  const [stats, setStats] = useState({
    activeDockets: 0,
    deadlines: 0,
    overdueDeadlines: 0,
  });
  const [dockets, setDockets] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedDocket, setSelectedDocket] = useState(null);
  const [docketDeadlines, setDocketDeadlines] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    application_status: "",
    start_date: "",
    end_date: "",
  });
  const recordsPerPage = 10;

  const fetchStats = async () => {
    try {
      const res = await axios.get(`/api/client/stats`);
      setStats(res.data.stats);
      setUpcomingDeadlines(res.data.upcomingDeadlines || []);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Error fetching stats", err);
      setStats({ activeDockets: 0, deadlines: 0, overdueDeadlines: 0 });
    }
  };

  const fetchDockets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", currentPage);
      params.append("limit", recordsPerPage);
      if (searchQuery) params.append("search", searchQuery);
      if (filters.status) params.append("status", filters.status);
      if (filters.application_status)
        params.append("application_status", filters.application_status);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);

      const res = await axios.get(`/api/client?${params.toString()}`);
      setDockets(res.data.dockets || []);
      setTotalRecords(res.data.total || 0);
    } catch (err) {
      if (!import.meta.env.PROD) console.error("Error fetching dockets", err);
      setDockets([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocketDetails = async (docketId) => {
    setModalLoading(true);
    try {
      const res = await axios.get(`/api/client/docket/${docketId}`);
      setSelectedDocket(res.data.docket);
      setDocketDeadlines(res.data.deadlines || []);
    } catch (err) {
      if (!import.meta.env.PROD)
        console.error("Error fetching docket details", err);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchDockets();
  }, [currentPage, searchQuery, filters]);

  const handleViewDocket = (docket) => {
    setSelectedDocket(docket);
    setDocketDeadlines([]);
    fetchDocketDetails(docket._id);
  };

  const handleCloseModal = () => {
    setSelectedDocket(null);
    setDocketDeadlines([]);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      application_status: "",
      start_date: "",
      end_date: "",
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    const date = new Date(dateStr);
    return isNaN(date.getTime())
      ? "--"
      : date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage) || 1;
  const getPageNumbers = () => {
    const pages = [];
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + 2);
    if (end - start < 2 && totalPages >= 3) start = Math.max(1, end - 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div style={styles.container}>
      {/* Stats Row */}
      <div style={styles.topRow}>
        <StatCard
          icon={<DocketIcon />}
          title="Active Dockets"
          count={stats.activeDockets}
        />
        <StatCard
          icon={<DeadlineIcon />}
          title="Total Deadlines"
          count={stats.deadlines}
          color="#fef3c7"
        />
        <StatCard
          icon={<AttentionIcon />}
          title="Overdue"
          count={stats.overdueDeadlines}
          color="#fee2e2"
        />
        <UpcomingDeadlineCard deadlines={upcomingDeadlines} />
      </div>

      {/* Docket Table */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div style={styles.tableHeaderLeft}>
            <h3 style={styles.tableTitle}>My Dockets</h3>
            <div style={styles.searchWrapper}>
              <Search size={16} color="#9ca3af" style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search docket, title, app no..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={styles.searchInput}
              />
            </div>
            <button
              style={styles.filterBtn}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} /> Filters
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div style={styles.filtersPanel}>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Status</label>
              <select
                style={styles.filterSelect}
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>Application Status</label>
              <select
                style={styles.filterSelect}
                value={filters.application_status}
                onChange={(e) =>
                  handleFilterChange("application_status", e.target.value)
                }
              >
                <option value="">All</option>
                <option value="Draft">Draft</option>
                <option value="Filed">Filed</option>
                <option value="Pending">Pending</option>
                <option value="Granted">Granted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>From Date</label>
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
              <label style={styles.filterLabel}>To Date</label>
              <input
                type="date"
                style={styles.filterInput}
                value={filters.end_date}
                onChange={(e) => handleFilterChange("end_date", e.target.value)}
              />
            </div>
            <button style={styles.clearFilterBtn} onClick={clearFilters}>
              Clear
            </button>
          </div>
        )}

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Reference</th>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Filing Date</th>
                <th style={styles.th}>Fee</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={styles.tdCenter}>
                    Loading...
                  </td>
                </tr>
              ) : dockets.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.tdCenter}>
                    No dockets found
                  </td>
                </tr>
              ) : (
                dockets.map((docket) => (
                  <tr key={docket._id} style={styles.tr}>
                    <td style={styles.td}>
                      {docket.docket_no || docket.reference || "--"}
                    </td>
                    <td style={styles.tdTitle}>{docket.title || "--"}</td>
                    <td style={styles.td}>
                      {formatDate(docket.filling_date || docket.filing_date)}
                    </td>
                    <td style={styles.td}>{docket.fee || "--"}</td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusPill,
                          backgroundColor: "#fff",
                          color: "#374151",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        {docket.application_status || "--"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={styles.viewLink}
                        onClick={() => handleViewDocket(docket)}
                      >
                        View <Eye size={16} color="#22c55e" />
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={styles.pagination}>
          <span style={styles.paginationInfo}>
            Showing{" "}
            <strong>
              {totalRecords > 0 ? (currentPage - 1) * recordsPerPage + 1 : 0}
            </strong>{" "}
            to{" "}
            <strong>
              {Math.min(currentPage * recordsPerPage, totalRecords)}
            </strong>{" "}
            of <strong>{totalRecords}</strong>
          </span>
          <div style={styles.paginationBtns}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              style={{ ...styles.pageBtn, opacity: currentPage <= 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} />
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
              disabled={currentPage >= totalPages}
              style={{
                ...styles.pageBtn,
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedDocket && (
        <DocketDetailModal
          docket={selectedDocket}
          deadlines={docketDeadlines}
          onClose={handleCloseModal}
          loading={modalLoading}
        />
      )}
    </div>
  );
}

const styles = {
  container: { padding: "0" },
  topRow: {
    display: "flex",
    gap: "15px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    minWidth: "160px",
    flex: "1",
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
  statTitle: { fontSize: "12px", color: "#6b7280", marginBottom: "5px" },
  statCount: { fontSize: "28px", fontWeight: "700", color: "#111827" },
  deadlineCard: {
    backgroundColor: "#fff7ed",
    borderRadius: "12px",
    padding: "16px",
    minWidth: "280px",
    flex: "1.5",
    border: "1px solid #fed7aa",
  },
  deadlineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  deadlineTitle: { fontSize: "14px", fontWeight: "600", color: "#374151" },
  deadlineWeek: {
    fontSize: "11px",
    color: "#22c55e",
    fontWeight: "500",
    backgroundColor: "#dcfce7",
    padding: "3px 8px",
    borderRadius: "10px",
  },
  deadlineContent: {},
  deadlineItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "8px 0",
    borderBottom: "1px solid #fed7aa",
  },
  deadlineItemLeft: { flex: 1 },
  deadlineItemRight: { textAlign: "right", marginLeft: "10px" },
  deadlineItemTitle: {
    fontSize: "12px",
    color: "#374151",
    fontWeight: "600",
    margin: "0 0 2px 0",
  },
  deadlineItemSub: { fontSize: "11px", color: "#9ca3af", margin: 0 },
  deadlineRef: {
    fontSize: "11px",
    color: "#f97316",
    fontWeight: "600",
    margin: "0 0 2px 0",
  },
  deadlineDate: {
    fontSize: "10px",
    color: "#374151",
    fontWeight: "500",
    margin: 0,
    backgroundColor: "#fef3c7",
    padding: "2px 6px",
    borderRadius: "4px",
    display: "inline-block",
  },
  noDeadline: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: "10px 0",
    textAlign: "center",
  },
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
    marginBottom: "15px",
    flexWrap: "wrap",
    gap: "15px",
  },
  tableHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
  },
  tableTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#111827",
    margin: 0,
  },
  searchWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: { position: "absolute", left: "12px" },
  searchInput: {
    padding: "8px 12px 8px 36px",
    fontSize: "13px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    backgroundColor: "#f9fafb",
    outline: "none",
    width: "220px",
  },
  filterBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    backgroundColor: "#fff",
    cursor: "pointer",
    color: "#374151",
  },
  viewAllBtn: {
    padding: "8px 20px",
    fontSize: "12px",
    border: "1px solid #f97316",
    borderRadius: "6px",
    backgroundColor: "#fff",
    color: "#f97316",
    textDecoration: "none",
    fontWeight: "500",
  },
  filtersPanel: {
    display: "flex",
    gap: "15px",
    padding: "15px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    marginBottom: "15px",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "11px", color: "#6b7280", fontWeight: "500" },
  filterSelect: {
    padding: "8px 12px",
    fontSize: "13px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    backgroundColor: "#fff",
    minWidth: "140px",
  },
  filterInput: {
    padding: "8px 12px",
    fontSize: "13px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    backgroundColor: "#fff",
  },
  clearFilterBtn: {
    padding: "8px 16px",
    fontSize: "13px",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#ef4444",
    color: "#fff",
    cursor: "pointer",
  },
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
  td: { padding: "16px 10px", color: "#374151", whiteSpace: "nowrap" },
  tdTitle: {
    padding: "16px 10px",
    color: "#374151",
    maxWidth: "300px",
    whiteSpace: "normal",
  },
  tdCenter: { padding: "40px", textAlign: "center", color: "#9ca3af" },
  statusPill: {
    padding: "6px 14px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "500",
    display: "inline-block",
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
    flexWrap: "wrap",
    gap: "10px",
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
  // Modal Styles
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
    padding: "20px",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "1000px",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#fff",
  },
  // ... existing styles ...

  modalTab: {
    padding: "16px 24px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#6b7280",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  modalTabActive: {
    color: "#f97316",
    borderBottom: "3px solid #f97316",
  },

  // ... existing styles ...
  modalCloseBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#6b7280",
    padding: "4px",
  },
  modalBody: { padding: "24px", overflowY: "auto", flex: 1 },
  modalSection: { marginBottom: "24px" },
  modalSectionTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#f97316",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #fed7aa",
  },
  modalSectionContent: {},
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  modalField: { display: "flex", flexDirection: "column", gap: "4px" },
  modalLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  modalValue: { fontSize: "14px", color: "#374151", fontWeight: "500" },
  listItem: {
    display: "flex",
    gap: "8px",
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  listIndex: { color: "#f97316", fontWeight: "600" },
  priorityItem: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    padding: "12px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    marginBottom: "8px",
  },
  fileList: { display: "flex", flexDirection: "column", gap: "8px" },
  fileLink: {
    color: "#3b82f6",
    textDecoration: "none",
    fontSize: "13px",
    padding: "8px 12px",
    backgroundColor: "#eff6ff",
    borderRadius: "6px",
  },
  loadingCenter: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "60px",
    color: "#9ca3af",
  },
  deadlinesTab: { minHeight: "300px" },
  noDeadlinesMsg: {
    textAlign: "center",
    padding: "60px",
    color: "#9ca3af",
    fontSize: "14px",
  },
  deadlineTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  deadlineTh: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#6b7280",
    fontWeight: "600",
    borderBottom: "2px solid #f3f4f6",
    backgroundColor: "#f9fafb",
  },
  deadlineTr: { borderBottom: "1px solid #f3f4f6" },
  deadlineTd: { padding: "12px 10px", color: "#374151", verticalAlign: "top" },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "600",
  },
  remainderList: { display: "flex", flexDirection: "column", gap: "2px" },
  remainderItem: { fontSize: "11px", color: "#6b7280" },
};
