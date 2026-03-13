import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

// --- ICONS ---
export const DocketIcon = () => (
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

export const TaskboardIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

export const ApplicationIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="2"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);

export const DeadlineIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#f97316"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

// Chevron Icon for the Collapse Button
const ChevronIcon = ({ collapsed }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.3s ease",
    }}
  >
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

// --- STAT CARD COMPONENT ---
export const StatCard = ({
  icon,
  title,
  count,
  link = "#",
  loading = false,
}) => (
  <Link to={link} style={styles.statCardLink}>
    <div style={styles.statCard}>
      <div style={styles.iconWrapper}>{icon}</div>
      <div style={styles.statInfo}>
        <span style={styles.statTitle}>{title}</span>
        {loading ? (
          <div style={styles.countSpinnerWrapper}>
            <div style={styles.countSpinner}></div>
          </div>
        ) : (
          <span style={styles.statCount}>{count}</span>
        )}
      </div>
    </div>
  </Link>
);

// --- MAIN COMPONENT ---
export default function StatsRow({ items }) {
  const { stats, isStatsLoading } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const defaultItems = [
    {
      title: "Docket",
      count: stats.dockets,
      icon: <DocketIcon />,
      link: "/docket",
    },
    {
      title: "Taskboard",
      count: stats.tasks,
      icon: <TaskboardIcon />,
      link: "/task",
    },
    {
      title: "Application",
      count: stats.applications,
      icon: <ApplicationIcon />,
      link: "/application",
    },
    {
      title: "Deadline",
      count: stats.deadlines,
      icon: <DeadlineIcon />,
      link: "/deadline",
    },
  ];

  const dataToRender = items || defaultItems;

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <button
          style={styles.collapseBtn}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Show Stats" : "Hide Stats"}
        >
          <span>{isCollapsed ? "Show Stats" : "Hide Stats"}</span>
          <ChevronIcon collapsed={isCollapsed} />
        </button>
      </div>

      {!isCollapsed && (
        <div style={styles.statsRow} className="stats-row">
          {dataToRender.map((item, index) => (
            <StatCard
              key={index}
              icon={item.icon}
              title={item.title}
              count={item.count}
              link={item.link || "#"}
              loading={
                item.loading !== undefined ? item.loading : isStatsLoading
              }
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .stat-card-link:hover .stat-card-inner {
          border-color: #f97316 !important;
          box-shadow: 0 4px 12px rgba(249,115,22,0.15) !important;
        }
      `}</style>
    </div>
  );
}

// --- STYLES ---
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    marginBottom: "20px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "10px",
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
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
  },
  statCardLink: {
    textDecoration: "none",
    display: "block",
    borderRadius: "10px",
    transition: "all 0.2s ease",
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: "10px",
    padding: "14px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: "1px solid #fee2e2",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    cursor: "pointer",
  },
  iconWrapper: {
    width: "42px",
    height: "42px",
    minWidth: "42px",
    backgroundColor: "#fff7ed",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    overflow: "hidden",
  },
  statTitle: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "2px",
    whiteSpace: "nowrap",
    fontWeight: "500",
  },
  statCount: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111827",
    lineHeight: "1.2",
  },
  countSpinnerWrapper: {
    height: "30px",
    display: "flex",
    alignItems: "center",
  },
  countSpinner: {
    width: "20px",
    height: "20px",
    border: "3px solid #f3f4f6",
    borderTop: "3px solid #f97316",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
