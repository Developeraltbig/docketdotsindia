import useAuthStore from "../store/authStore";
import { NavLink, useNavigate, useLocation, matchPath } from "react-router-dom";
import React, { useEffect, useState, useRef, useCallback } from "react";
import useChatStore from "../store/chatStore";

// ─── Notification categories ──────────────────────────────────────────────────
const NOTIF_TYPES = {
  CHAT: "chat",
  TASK: "task",
  DEADLINE: "deadline",
};

const typeIcon = (type) => {
  if (type === NOTIF_TYPES.CHAT) return "bi-chat-dots-fill";
  if (type === NOTIF_TYPES.TASK) return "bi-clipboard-check-fill";
  if (type === NOTIF_TYPES.DEADLINE) return "bi-alarm-fill";
  return "bi-bell-fill";
};

const typeColor = (type) => {
  if (type === NOTIF_TYPES.CHAT) return "#3b82f6";
  if (type === NOTIF_TYPES.TASK) return "#10b981";
  if (type === NOTIF_TYPES.DEADLINE) return "#f59e0b";
  return "#6366f1";
};

const typeRoute = (notif) => {
  if (notif.type === NOTIF_TYPES.CHAT)
    return `/chat?conversationId=${notif.meta?.conversationId || ""}`;
  if (notif.type === NOTIF_TYPES.TASK)
    return `/tasks/${notif.meta?.taskId || ""}`;
  if (notif.type === NOTIF_TYPES.DEADLINE)
    return `/deadlines/${notif.meta?.deadlineId || ""}`;
  return "/dashboard";
};

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Max stored notifications ──────────────────────────────────────────────────
const MAX_NOTIFS = 50;

export default function Header({ appName }) {
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, menus, logout, socket } = useAuthStore();
  const { totalUnreadCount, fetchTotalUnreadCount, incrementUnreadCount } =
    useChatStore();

  const [showProfile, setShowProfile] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBell, setShowBell] = useState(false);

  // ── Notifications state ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("app_notifications") || "[]");
    } catch {
      return [];
    }
  });
  const [bellFilter, setBellFilter] = useState("all"); // 'all' | 'chat' | 'task' | 'deadline'
  const [bellAnimating, setBellAnimating] = useState(false);

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  // persist notifications
  useEffect(() => {
    localStorage.setItem("app_notifications", JSON.stringify(notifications));
  }, [notifications]);

  // ── Add a notification ─────────────────────────────────────────────────────
  const addNotification = useCallback((notif) => {
    setBellAnimating(true);
    setTimeout(() => setBellAnimating(false), 600);

    setNotifications((prev) => {
      const next = [
        {
          id: `${Date.now()}-${Math.random()}`,
          read: false,
          createdAt: new Date().toISOString(),
          ...notif,
        },
        ...prev,
      ].slice(0, MAX_NOTIFS);
      return next;
    });
  }, []);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markRead = (id) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

  const clearAll = () => setNotifications([]);

  const handleNotifClick = (notif) => {
    markRead(notif.id);
    setShowBell(false);
    navigate(typeRoute(notif));
  };

  useEffect(() => {
    if (!socket || !user) return;

    // ── Chat: new-message ──
    const handleNewMessage = ({ message }) => {
      if (message.sender?._id === user?._id) return;

      const isActiveChat =
        location.pathname.includes("/chat") &&
        localStorage.getItem("activeChatId") === message.conversation;

      if (!isActiveChat) {
        incrementUnreadCount();
        addNotification({
          type: NOTIF_TYPES.CHAT,
          title: `New message from ${message.sender?.name || "Someone"}`,
          body: message.text
            ? message.text.length > 60
              ? message.text.slice(0, 60) + "…"
              : message.text
            : message.files?.length
              ? `📎 ${message.files[0].filename || "File"}`
              : "New message",
          meta: { conversationId: message.conversation },
        });
      }
    };

    // ── Task: task-updated ──
    const handleTaskUpdated = ({ task, action, updatedBy }) => {
      if (updatedBy?._id === user?._id) return;
      addNotification({
        type: NOTIF_TYPES.TASK,
        title:
          action === "created"
            ? "New task assigned to you"
            : `Task ${action || "updated"}`,
        body: task?.docket_no
          ? `Docket: ${task.docket_no} · ${task.work_type || ""}`
          : task?.work_type || "A task was updated",
        meta: { taskId: task?._id },
      });
    };

    // ── Deadline: deadline-reminder ──
    const handleDeadlineReminder = ({ deadline }) => {
      addNotification({
        type: NOTIF_TYPES.DEADLINE,
        title: "⚠️ Deadline Reminder",
        body: deadline?.worktype
          ? `${deadline.worktype} · Due: ${
              deadline.deadline_date
                ? new Date(deadline.deadline_date).toLocaleDateString()
                : "Soon"
            }`
          : "A deadline requires your attention",
        meta: { deadlineId: deadline?._id },
      });
    };

    socket.on("new-message", handleNewMessage);
    socket.on("task-updated", handleTaskUpdated);
    socket.on("deadline-reminder", handleDeadlineReminder);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("task-updated", handleTaskUpdated);
      socket.off("deadline-reminder", handleDeadlineReminder);
    };
  }, [socket, user, location, addNotification, incrementUnreadCount]);

  // ── Fetch initial unread chat count ───────────────────────────────────────
  useEffect(() => {
    if (user) fetchTotalUnreadCount();
  }, [user]);

  // ── Close dropdowns on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
      if (bellRef.current && !bellRef.current.contains(e.target))
        setShowBell(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const truncateName = (name, maxLength = 20) => {
    if (!name) return "User";
    return name.length > maxLength ? name.slice(0, maxLength) + "..." : name;
  };

  // ── Filtered notifications ─────────────────────────────────────────────────
  const filteredNotifs =
    bellFilter === "all"
      ? notifications
      : notifications.filter((n) => n.type === bellFilter);

  return (
    <>
      {/* ── Notification bell styles (scoped) ────────────────────────────── */}
      <style>{`
        .notif-bell-btn {
          position: relative;
          background: transparent;
          border: none;
          color: #e2e8f0;
          font-size: 1.25rem;
          padding: 6px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.18s, color 0.18s;
          display: flex;
          align-items: center;
        }
        .notif-bell-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .notif-bell-btn.shake i {
          animation: bellShake 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes bellShake {
          10%,90%  { transform: rotate(-4deg); }
          20%,80%  { transform: rotate(5deg); }
          30%,50%,70% { transform: rotate(-8deg); }
          40%,60%  { transform: rotate(8deg); }
        }

        .notif-badge {
          position: absolute;
          top: 2px;
          right: 4px;
          background: #ef4444;
          color: #fff;
          border-radius: 999px;
          font-size: 0.58rem;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3px;
          line-height: 1;
          pointer-events: none;
          border: 2px solid var(--header-bg, #1e293b);
        }

        .notif-panel {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          width: 380px;
          max-width: calc(100vw - 24px);
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04);
          z-index: 9999;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: panelIn 0.2s cubic-bezier(0.16,1,0.3,1) both;
          transform-origin: top right;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: scale(0.93) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .notif-header h6 { margin: 0; color: #f1f5f9; font-size: 0.9rem; font-weight: 700; letter-spacing: 0.01em; }
        .notif-header-actions { display: flex; gap: 6px; }
        .notif-action-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.72rem;
          cursor: pointer;
          padding: 3px 8px;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
        }
        .notif-action-btn:hover { background: rgba(255,255,255,0.07); color: #e2e8f0; }

        .notif-filter-row {
          display: flex;
          gap: 4px;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .notif-filter-row::-webkit-scrollbar { display: none; }
        .notif-filter-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: #94a3b8;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .notif-filter-chip.active {
          background: rgba(99,102,241,0.2);
          border-color: rgba(99,102,241,0.5);
          color: #a5b4fc;
        }
        .notif-filter-chip .chip-count {
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          padding: 1px 5px;
          font-size: 0.65rem;
        }

        .notif-list {
          max-height: 380px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .notif-list::-webkit-scrollbar { width: 4px; }
        .notif-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
          position: relative;
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: rgba(255,255,255,0.04); }
        .notif-item.unread { background: rgba(99,102,241,0.05); }
        .notif-item.unread::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: #6366f1;
        }

        .notif-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 0.85rem;
        }

        .notif-content { flex: 1; min-width: 0; }
        .notif-title {
          font-size: 0.8rem;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .notif-body {
          font-size: 0.74rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .notif-time { font-size: 0.66rem; color: #64748b; margin-top: 3px; }

        .notif-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #475569;
          gap: 10px;
        }
        .notif-empty i { font-size: 2rem; opacity: 0.4; }
        .notif-empty p { margin: 0; font-size: 0.82rem; }

        .notif-footer {
          padding: 10px 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }
        .notif-footer-link {
          font-size: 0.75rem;
          color: #6366f1;
          cursor: pointer;
          background: none;
          border: none;
          padding: 0;
          transition: color 0.15s;
        }
        .notif-footer-link:hover { color: #818cf8; text-decoration: underline; }
      `}</style>

      {/* ===== HEADER ===== */}
      <header className="d-flex justify-content-between align-items-center px-4 py-2 border-bottom">
        <div className="d-flex align-items-center gap-3">
          <button
            className="btn d-md-none"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <i className="bi bi-list fs-3 text-white"></i>
          </button>

          <NavLink
            to="/dashboard"
            className="m-0 fw-bold text-white text-decoration-none"
            onClick={() => setShowMobileMenu(false)}
          >
            <h4 className="m-0 fw-bold">{appName}</h4>
          </NavLink>
        </div>

        {/* ===== NAVIGATION MENU ===== */}
        <nav className="px-3 py-2">
          <ul
            className={`nav flex-column flex-md-row ${
              showMobileMenu ? "d-flex" : "d-none"
            } d-md-flex`}
          >
            {menus &&
              menus.map((menu) => {
                const hasSubMenus = menu.subMenus && menu.subMenus.length > 0;
                const isChatMenu = menu.name.toLowerCase() === "chat";

                const isAnyChildActive =
                  hasSubMenus &&
                  menu.subMenus.some((sub) =>
                    matchPath(
                      { path: sub.route, end: true },
                      location.pathname,
                    ),
                  );

                return (
                  <li
                    key={menu._id}
                    className={`nav-item ${hasSubMenus ? "dropdown" : ""}`}
                  >
                    {hasSubMenus ? (
                      <>
                        <a
                          className={`nav-link dropdown-toggle ${
                            isAnyChildActive ? "active" : ""
                          }`}
                          href="#"
                          role="button"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          {menu.icon && <i className={`${menu.icon} me-1`}></i>}
                          {menu.name}
                        </a>
                        <ul
                          className="dropdown-menu custom-dropdown"
                          style={{ height: "100px" }}
                        >
                          {menu.subMenus.map((sub) => (
                            <li key={sub._id} className="submenu">
                              <NavLink
                                to={sub.route}
                                className="dropdown-item text-white"
                                onClick={() => setShowMobileMenu(false)}
                              >
                                {sub.icon && (
                                  <i className={`${sub.icon} me-1`}></i>
                                )}
                                {sub.name}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <NavLink
                        to={menu.route}
                        className={({ isActive }) =>
                          isActive ? "nav-link active" : "nav-link"
                        }
                        onClick={() => setShowMobileMenu(false)}
                      >
                        {menu.icon && <i className={`${menu.icon} me-1`}></i>}
                        {menu.name}
                        {isChatMenu && totalUnreadCount > 0 && (
                          <span
                            className="position-absolute translate-middle badge rounded-pill bg-danger"
                            style={{
                              top: "10px",
                              right: "-15px",
                              fontSize: "0.6rem",
                              zIndex: 10,
                            }}
                          >
                            {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                          </span>
                        )}
                      </NavLink>
                    )}
                  </li>
                );
              })}
          </ul>
        </nav>

        {/* ===== RIGHT SIDE: BELL + PROFILE ===== */}
        <div className="d-flex align-items-center gap-2">
          {/* ── NOTIFICATION BELL ───────────────────────────────────────── */}
          <div className="position-relative" ref={bellRef}>
            <button
              className={`notif-bell-btn ${bellAnimating ? "shake" : ""}`}
              onClick={() => setShowBell((v) => !v)}
              aria-label="Notifications"
              title="Notifications"
            >
              <i className="bi bi-bell-fill"></i>
              {unreadNotifCount > 0 && (
                <span className="notif-badge">
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              )}
            </button>

            {showBell && (
              <div className="notif-panel">
                {/* Header */}
                <div className="notif-header">
                  <h6>
                    Notifications{" "}
                    {unreadNotifCount > 0 && (
                      <span
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          borderRadius: "999px",
                          fontSize: "0.65rem",
                          padding: "1px 6px",
                          marginLeft: 4,
                          fontWeight: 700,
                          verticalAlign: "middle",
                        }}
                      >
                        {unreadNotifCount}
                      </span>
                    )}
                  </h6>
                  <div className="notif-header-actions">
                    {unreadNotifCount > 0 && (
                      <button
                        className="notif-action-btn"
                        onClick={markAllRead}
                        title="Mark all as read"
                      >
                        <i className="bi bi-check2-all me-1"></i>Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        className="notif-action-btn"
                        onClick={clearAll}
                        title="Clear all"
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter chips */}
                <div className="notif-filter-row">
                  {[
                    { key: "all", label: "All", icon: "bi-grid-fill" },
                    {
                      key: NOTIF_TYPES.CHAT,
                      label: "Chat",
                      icon: "bi-chat-dots-fill",
                    },
                    {
                      key: NOTIF_TYPES.TASK,
                      label: "Tasks",
                      icon: "bi-clipboard-check-fill",
                    },
                    {
                      key: NOTIF_TYPES.DEADLINE,
                      label: "Deadlines",
                      icon: "bi-alarm-fill",
                    },
                  ].map(({ key, label, icon }) => {
                    const count =
                      key === "all"
                        ? notifications.filter((n) => !n.read).length
                        : notifications.filter((n) => n.type === key && !n.read)
                            .length;
                    return (
                      <button
                        key={key}
                        className={`notif-filter-chip ${
                          bellFilter === key ? "active" : ""
                        }`}
                        onClick={() => setBellFilter(key)}
                      >
                        <i className={`bi ${icon}`}></i>
                        {label}
                        {count > 0 && (
                          <span className="chip-count">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* List */}
                <div className="notif-list">
                  {filteredNotifs.length === 0 ? (
                    <div className="notif-empty">
                      <i className="bi bi-bell-slash"></i>
                      <p>No notifications</p>
                    </div>
                  ) : (
                    filteredNotifs.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notif-item ${notif.read ? "" : "unread"}`}
                        onClick={() => handleNotifClick(notif)}
                        role="button"
                      >
                        <div
                          className="notif-icon-wrap"
                          style={{
                            background: `${typeColor(notif.type)}22`,
                            color: typeColor(notif.type),
                          }}
                        >
                          <i className={`bi ${typeIcon(notif.type)}`}></i>
                        </div>
                        <div className="notif-content">
                          <div className="notif-title">{notif.title}</div>
                          <div className="notif-body">{notif.body}</div>
                          <div className="notif-time">
                            {timeAgo(notif.createdAt)}
                          </div>
                        </div>
                        {!notif.read && (
                          <div
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#6366f1",
                              flexShrink: 0,
                              marginTop: 6,
                            }}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {filteredNotifs.length > 0 && (
                  <div className="notif-footer">
                    <button
                      className="notif-footer-link"
                      onClick={() => {
                        setShowBell(false);
                        navigate("/dashboard");
                      }}
                    >
                      View dashboard →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── PROFILE DROPDOWN ────────────────────────────────────────── */}
          <div className="position-relative" ref={dropdownRef}>
            <div
              className="d-flex align-items-center gap-2 cursor-pointer"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <i className="bi bi-person-circle fs-4"></i>
              <span className="d-none d-sm-inline">
                {truncateName(user?.name)}
              </span>
              <i className="bi bi-caret-down-fill"></i>
            </div>

            {showDropdown && (
              <ul className="dropdown-menu show end-0 mt-2">
                <li>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setShowProfile(true);
                      setShowDropdown(false);
                    }}
                  >
                    <i className="bi bi-person me-2"></i> Profile
                  </button>
                </li>
                <li>
                  <button
                    className="dropdown-item text-danger"
                    onClick={() => logout()}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i> Logout
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </header>

      {/* ===== PROFILE MODAL ===== */}
      {showProfile && user && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">My Profile</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowProfile(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Name:</strong> {user.name}
                </p>
                <p>
                  <strong>Email:</strong> {user.email}
                </p>
                <p>
                  <strong>Department:</strong> {user.department}
                </p>
                <p>
                  <strong>Role:</strong> {user.role_id?.name || "N/A"}
                </p>
                <p>
                  <strong>Employee ID:</strong> {user.e_id}
                </p>
                <p style={{ color: "red" }}>
                  <strong>
                    *To change your password, please contact the administrator.
                  </strong>
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowProfile(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: -1 }}
          ></div>
        </div>
      )}
    </>
  );
}
