import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import useAuthStore from "../../store/authStore";
import { toast } from "react-toastify";
import StaffDashboard from "./StaffDashboard";
import ClientDashboard from "./ClientDashboard";
import { Link2 } from "lucide-react";

const DocketSVG = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      stroke="#f97316"
      strokeWidth="2"
    />
    <path
      d="M7 8h10M7 12h10M7 16h6"
      stroke="#f97316"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const DeadlineSVG = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="2" />
    <path
      d="M12 7v5l3 3"
      stroke="#ef4444"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const TaskSVG = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      stroke="#3b82f6"
      strokeWidth="2"
    />
    <path
      d="M8 12l3 3 5-5"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const InvoiceSVG = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect
      x="4"
      y="2"
      width="16"
      height="20"
      rx="2"
      stroke="#8b5cf6"
      strokeWidth="2"
    />
    <path
      d="M8 10h8M8 14h5"
      stroke="#8b5cf6"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M8 6h2" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ─── TOP STAT CARD ────────────────────────────────────────────────────────────
function StatCard({ icon, title, color, metrics, link }) {
  return (
    <div style={{ ...cardStyles.card, flex: 1, minWidth: 220 }}>
      {/* 1. Header links to the main page (e.g., /docket) */}
      <Link to={link || "#"} style={{ textDecoration: "none" }}>
        <div style={cardStyles.header}>
          <div
            style={{ ...cardStyles.iconWrap, backgroundColor: color + "18" }}
          >
            {icon}
          </div>
          <span style={{ ...cardStyles.title, color }}>{title}</span>
        </div>
      </Link>

      <div style={cardStyles.metricsGrid}>
        {metrics.map((m, i) => (
          <Link
            key={i}
            to={m.link || link || "#"}
            style={{ textDecoration: "none", ...cardStyles.metric }}
          >
            <span style={cardStyles.metricLabel}>{m.label}</span>
            <span
              style={{
                ...cardStyles.metricValue,
                color: m.color || "#111827",
              }}
            >
              {String(m.value ?? 0).padStart(2, "0")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const cardStyles = {
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: "18px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    border: "1px solid #f3f4f6",
    height: "100%",

    transition: "box-shadow .2s",
  },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: 700, fontSize: 15, letterSpacing: 0.3 },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px 20px",
  },
  metric: { display: "flex", flexDirection: "column", gap: 2 },
  metricLabel: { fontSize: 11, color: "#9ca3af", fontWeight: 500 },
  metricValue: { fontSize: 22, fontWeight: 800, lineHeight: 1.1 },
};

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
const DONUT_COLORS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
];

function StatusDonut({ data, total }) {
  return (
    <div style={{ position: "relative", width: 200, height: 200 }}>
      <PieChart width={200} height={200}>
        <Pie
          data={data}
          cx={100}
          cy={100}
          innerRadius={58}
          outerRadius={85}
          dataKey="value"
          strokeWidth={3}
          stroke="#fff"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>
          Total
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>
          {total}
        </div>
      </div>
    </div>
  );
}

// ─── URGENCY BADGE ────────────────────────────────────────────────────────────
function UrgencyBadge({ daysLeft }) {
  if (daysLeft < 0)
    return (
      <span
        style={{
          background: "#fee2e2",
          color: "#dc2626",
          padding: "3px 10px",
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {Math.abs(daysLeft)}d overdue
      </span>
    );
  if (daysLeft === 0)
    return (
      <span
        style={{
          background: "#fff7ed",
          color: "#ea580c",
          padding: "3px 10px",
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        Due today
      </span>
    );
  return (
    <span
      style={{
        background: "#fef9c3",
        color: "#ca8a04",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {daysLeft}d left
    </span>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminManagerDashboard() {
  const navigate = useNavigate();
  const { stats, isStatsLoading } = useAuthStore();

  const [dashData, setDashData] = useState(null);
  const [chartFilter, setChartFilter] = useState(["filed", "granted"]);
  const [chartData, setChartData] = useState([]);
  const [statusDist, setStatusDist] = useState([]);
  const [urgentActions, setUrgentActions] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [urgentPage, setUrgentPage] = useState(1);
  const [urgentTotal, setUrgentTotal] = useState(0);
  const [actPage, setActPage] = useState(1);
  const [actTotal, setActTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const PER_PAGE = 10;
  const dummyChartData = [
    { month: "Jan", filed: 45, granted: 28 },
    { month: "Feb", filed: 52, granted: 35 },
    { month: "Mar", filed: 38, granted: 42 },
    { month: "Apr", filed: 65, granted: 30 },
    { month: "May", filed: 48, granted: 55 },
    { month: "Jun", filed: 60, granted: 48 },
    { month: "Jul", filed: 72, granted: 60 },
    { month: "Aug", filed: 55, granted: 65 },
    { month: "Sep", filed: 42, granted: 38 },
    { month: "Oct", filed: 68, granted: 52 },
    { month: "Nov", filed: 75, granted: 45 },
    { month: "Dec", filed: 50, granted: 70 },
  ];
  // Fetch all dashboard data
  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchUrgent();
  }, [urgentPage]);

  useEffect(() => {
    fetchActivity();
  }, [actPage]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dashRes, chartRes, distRes] = await Promise.allSettled([
        axios.get("/api/dashboard/stats"),
        axios.get("/api/dashboard/filings-chart"),
        axios.get("/api/dashboard/status-distribution"),
      ]);
      if (dashRes.status === "fulfilled") setDashData(dashRes.value.data);
      if (chartRes.status === "fulfilled")
        setChartData(
          // chartRes.value.data?.length ? chartRes.value.data : dummyChartData,
          dummyChartData,
        );
      if (distRes.status === "fulfilled")
        setStatusDist(distRes.value.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUrgent = async () => {
    try {
      const res = await axios.get(
        `/api/dashboard/urgent-actions?page=${urgentPage}&limit=${PER_PAGE}`,
      );
      setUrgentActions(res.data.records || []);

      setUrgentTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await axios.get(
        `/api/dashboard/recent-activity?page=${actPage}&limit=${PER_PAGE}`,
      );
      setRecentActivity(res.data.records || []);
      setActTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // --- EXPORT HANDLERS ---
  const handleExportUrgent = async () => {
    try {
      const res = await axios.get("/api/dashboard/urgent-actions/export");
      const data = res.data.map((r) => {
        const daysLeft = getDaysLeft(r.deadline_date);
        let status =
          daysLeft < 0
            ? `${Math.abs(daysLeft)}d overdue`
            : daysLeft === 0
              ? "Due today"
              : `${daysLeft}d left`;

        return {
          Docket: r.docket_number || r.docket_no || "--",
          "Application No.": r.application_no || "--",
          "Work Type": r.worktype || r.work_type || "--",
          Deadline: formatDeadlineDate(r.deadline_date),
          Status: status,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Urgent Actions");
      XLSX.writeFile(wb, "Urgent_Actions.xlsx");
    } catch (err) {
      toast.error("Failed to export urgent actions");
      console.error(err);
    }
  };

  const handleExportActivity = async () => {
    try {
      const res = await axios.get("/api/dashboard/recent-activity/export");
      const data = res.data.map((a, i) => ({
        "Sr no.": i + 1,
        Task: a.description,
        "Done By": a.done_by || a.user_name || "System",
        "Time/Date": new Date(a.createdAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Recent Activity");
      XLSX.writeFile(wb, "Recent_Activity.xlsx");
    } catch (err) {
      toast.error("Failed to export recent activity");
      console.error(err);
    }
  };

  const d = dashData || {};

  // Stat cards data
  const statCards = [
    {
      icon: <DocketSVG />,
      title: "Dockets",
      color: "#f97316",
      link: "/docket",
      metrics: [
        {
          label: "Total",
          value: d.dockets?.total ?? stats?.dockets ?? 0,
          link: "/docket?status=all",
        },
        {
          label: "Pending",
          value: d.dockets?.inProcess ?? 0,
          color: "#f97316",
          link: "/docket?status=In-Process",
        },
        {
          label: "Granted",
          value: d.dockets?.granted ?? 0,
          color: "#22c55e",
          link: "/docket?status=Granted",
        },
        {
          label: "In-Active",
          value: d.dockets?.inactive ?? 0,
          color: "#9ca3af",
          link: "/docket?status=Inactive",
        },
      ],
    },
    {
      icon: <DeadlineSVG />,
      title: "Deadlines",
      color: "#ef4444",
      link: "/deadline",
      metrics: [
        {
          label: "Within 72h",
          value: d.deadlines?.within72h ?? 0,
          color: "#ef4444",
          link: "/deadline?filter=72h",
        },
        {
          label: "This Week",
          value: d.deadlines?.thisWeek ?? 0,
          link: "/deadline?filter=week",
        },
        {
          label: "This Month",
          value: d.deadlines?.thisMonth ?? 0,
          link: "/deadline?filter=month",
        },
        {
          label: "Overdue",
          value: d.deadlines?.overdue ?? 0,
          color: "#dc2626",
          link: "/deadline?filter=overdue",
        },
      ],
    },
    {
      icon: <TaskSVG />,
      title: "Tasks",
      color: "#3b82f6",
      link: "/task",
      metrics: [
        {
          label: "Overdue",
          value: d.tasks?.overdue ?? 0,
          color: "#ef4444",
          link: "/task?status=overdue",
        },
        {
          label: "Due Today",
          value: d.tasks?.dueToday ?? 0,
          color: "#f97316",
          link: "/task?status=dueToday",
        },
        {
          label: "In Progress",
          value: d.tasks?.inProgress ?? 0,
          color: "#3b82f6",
          link: "/task?status=In Progress",
        },
        {
          label: "Completed",
          value: d.tasks?.completed ?? 0,
          color: "#22c55e",
          link: "/task?status=completedToday",
        },
      ],
    },
    {
      icon: <InvoiceSVG />,
      title: "Invoices",
      color: "#8b5cf6",
      link: "/invoice",
      metrics: [
        {
          label: "Draft",
          value: d.invoices?.draft ?? 0,
          link: "/invoice?status=Draft",
        },
        {
          label: "Sent",
          value: d.invoices?.sent ?? 0,
          color: "#3b82f6",
          link: "/invoice?status=Sent",
        },
        {
          label: "Paid",
          value: d.invoices?.paid ?? 0,
          color: "#22c55e",
          link: "/invoice?status=Paid",
        },
        {
          label: "Overdue",
          value: d.invoices?.overdue ?? 0,
          color: "#ef4444",
          link: "/invoice?status=Overdue",
        },
      ],
    },
  ];

  // Donut data
  const donutData =
    statusDist.length > 0
      ? statusDist
      : [
          { name: "In-Process", value: d.dockets?.inProcess || 0 },
          { name: "Granted", value: d.dockets?.granted || 0 },
          { name: "Filed", value: d.dockets?.filed || 0 },
          { name: "Inactive", value: d.dockets?.inactive || 0 },
        ].filter((x) => x.value > 0);

  const donutTotal =
    donutData.reduce((s, x) => s + x.value, 0) || d.dockets?.total || 0;

  const urgentTotalPages = Math.ceil(urgentTotal / PER_PAGE) || 1;
  const actTotalPages = Math.ceil(actTotal / PER_PAGE) || 1;

  const formatDeadlineDate = (dateStr) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return 999;
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

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

  return (
    <div style={styles.page}>
      {/* ── STAT CARDS ── */}
      <div style={styles.statRow}>
        {statCards.map((c, i) => (
          <StatCard key={i} {...c} />
        ))}
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={styles.chartsRow}>
        {/* Filings vs Grants */}
        <div style={{ ...styles.card, flex: 1.6 }}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Filings vs Grants</div>
              <div style={styles.cardSub}>
                Monthly comparison — last 12 months
              </div>
            </div>
            <div style={styles.filterBtnGroup}>
              {["filed", "granted"].map((f) => {
                const isActive = chartFilter.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => {
                      setChartFilter(
                        (prev) =>
                          prev.includes(f)
                            ? prev.filter((item) => item !== f) // Remove if exists
                            : [...prev, f], // Add if missing
                      );
                    }}
                    style={{
                      ...styles.filterBtn,
                      ...(isActive
                        ? {
                            backgroundColor:
                              f === "filed" ? "#f97316" : "#22c55e",
                            color: "#fff",
                            border: "1px solid transparent",
                          }
                        : {}),
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f3f4f6"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
              />
              <Bar
                dataKey="filed"
                name="Filed"
                fill="#f97316"
                radius={[5, 5, 0, 0]}
                barSize={18}
                hide={!chartFilter.includes("filed")}
              />
              <Bar
                dataKey="granted"
                name="Granted"
                fill="#22c55e"
                radius={[5, 5, 0, 0]}
                barSize={18}
                hide={!chartFilter.includes("granted")}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div style={{ ...styles.card, flex: 1, minWidth: 280 }}>
          <div style={styles.cardHeader}>
            <div>
              <div style={styles.cardTitle}>Status Distribution</div>
              <div style={styles.cardSub}>All active dockets</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <StatusDonut data={donutData} total={donutTotal} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {donutData.map((item, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{ fontSize: 12, color: "#374151", minWidth: 80 }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}
                  >
                    {String(item.value).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── URGENT ACTIONS ── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Urgent Actions Required</div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={handleExportUrgent} style={styles.exportBtn}>
              Export Excel
            </button>
            <Link to="/deadline" style={styles.viewAllBtn}>
              View All
            </Link>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  "Docket",
                  "Application No.",
                  "Work Type",
                  "Deadline",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {urgentActions.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.empty}>
                    No urgent actions
                  </td>
                </tr>
              ) : (
                urgentActions.map((r, i) => {
                  const daysLeft = getDaysLeft(r.deadline_date);
                  return (
                    <tr key={i} style={styles.tr}>
                      <td
                        style={{
                          ...styles.td,
                        }}
                      >
                        {r.docket_number || r.docket_no || "--"}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                        }}
                      >
                        {r.application_no || "--"}
                      </td>
                      <td style={styles.td}>
                        {r.worktype || r.work_type || "--"}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: daysLeft < 0 ? "#dc2626" : "#374151",
                          fontWeight: daysLeft < 0 ? 600 : 400,
                        }}
                      >
                        {formatDeadlineDate(r.deadline_date)}
                      </td>
                      <td style={styles.td}>
                        <UrgencyBadge daysLeft={daysLeft} />
                      </td>
                      <td style={styles.td}>
                        <span
                          onClick={() =>
                            navigate("/deadline", {
                              state: {
                                viewRecord: r,
                                returnToDocket: null,
                              },
                            })
                          }
                          style={{
                            cursor: "pointer",
                            color: "#111827",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          View{" "}
                          <span style={{ color: "#22c55e", fontSize: 16 }}>
                            ●
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={urgentPage}
          total={urgentTotal}
          perPage={PER_PAGE}
          totalPages={urgentTotalPages}
          onChange={setUrgentPage}
        />
      </div>

      {/* ── RECENT ACTIVITY ── */}

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Recent Activity</div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={handleExportActivity} style={styles.exportBtn}>
              Export Excel
            </button>
            <Link to="/activity" style={styles.viewAllBtn}>
              View All
            </Link>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Sr no.", "Task", "Done By", "Time/Date"].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan="4" style={styles.empty}>
                    No recent activity
                  </td>
                </tr>
              ) : (
                recentActivity.map((a, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={{ ...styles.td, color: "#9ca3af" }}>
                      {(actPage - 1) * PER_PAGE + i + 1}
                    </td>
                    <td
                      style={{
                        ...styles.td,

                        fontWeight: 500,
                      }}
                    >
                      {a.description}
                    </td>
                    <td style={styles.td}>
                      {a.done_by || a.user_name || "System"}
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
        <Pagination
          page={actPage}
          total={actTotal}
          perPage={PER_PAGE}
          totalPages={actTotalPages}
          onChange={setActPage}
        />
      </div>
    </div>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
function Pagination({ page, total, perPage, totalPages, onChange }) {
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const pages = [];
  let s = Math.max(1, page - 1);
  let e = Math.min(totalPages, s + 2);
  if (e - s < 2) s = Math.max(1, e - 2);
  for (let i = s; i <= e; i++) pages.push(i);

  return (
    <div style={styles.pagination}>
      <span style={styles.pgInfo}>
        Showing{" "}
        <strong>
          {start}-{end}
        </strong>{" "}
        of <strong>{total.toLocaleString()}</strong> orders
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          style={{ ...styles.pgBtn, opacity: page === 1 ? 0.4 : 1 }}
        >
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              ...styles.pgBtn,
              ...(page === p ? styles.pgBtnActive : {}),
            }}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          style={{ ...styles.pgBtn, opacity: page === totalPages ? 0.4 : 1 }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
function Index() {
  const { user } = useAuthStore();
  const roleName = (() => {
    if (!user?.role_id) return null;
    return typeof user.role_id === "object"
      ? user.role_id.name?.toLowerCase()
      : user.role_id?.toLowerCase();
  })();

  if (roleName === "staff") return <StaffDashboard />;
  if (roleName === "client") return <ClientDashboard />;
  return <AdminManagerDashboard />;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  page: { display: "flex", flexDirection: "column", gap: 20 },
  statRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  chartsRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: "20px 22px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    border: "1px solid #f3f4f6",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },
  cardSub: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  filterBtnGroup: { display: "flex", gap: 6 },
  filterBtn: {
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    backgroundColor: "#fff",
    cursor: "pointer",
    color: "#6b7280",
  },
  viewAllBtn: {
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #f97316",
    borderRadius: 6,
    backgroundColor: "#fff7ed",
    color: "#f97316",
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  exportBtn: {
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #22c55e", // Green color for Excel feel
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    color: "#16a34a",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 12,
    borderBottom: "1px solid #f3f4f6",
    whiteSpace: "nowrap",
    backgroundColor: "#fafafa",
  },
  tr: { borderBottom: "1px solid #f9fafb", transition: "background .1s" },
  td: { padding: "13px 12px", color: "#374151", whiteSpace: "nowrap" },
  empty: { padding: 40, textAlign: "center", color: "#9ca3af" },
  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    marginTop: 4,
    borderTop: "1px solid #f3f4f6",
  },
  pgInfo: { fontSize: 12, color: "#9ca3af" },
  pgBtn: {
    width: 30,
    height: 30,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
    color: "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pgBtnActive: {
    background: "#f97316",
    color: "#fff",
    borderColor: "#f97316",
    fontWeight: 700,
  },
};

export default Index;
