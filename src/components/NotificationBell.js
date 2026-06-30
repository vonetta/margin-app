import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const timeAgo = (dateStr) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const memberships = useMemo(() => user?.ministries || [], [user]);

  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (memberships.length === 0) return;
    const results = await Promise.all(
      memberships.map((m) =>
        client
          .get("/api/notifications", { headers: { "x-ministry-id": m.ministry_id } })
          .then((res) => res.data.map((n) => ({ ...n, ministry_id: m.ministry_id })))
          .catch(() => []),
      ),
    );
    const all = results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setNotifications(all);
  }, [memberships]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClickNotification = async (n) => {
    if (!n.read) {
      try {
        await client.put(`/api/notifications/${n._id}/read`, null, {
          headers: { "x-ministry-id": n.ministry_id },
        });
        setNotifications((prev) => prev.map((p) => (p._id === n._id ? { ...p, read: true } : p)));
      } catch (err) {
        // non-fatal
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    await Promise.all(
      memberships.map((m) =>
        client
          .put("/api/notifications/read-all", null, { headers: { "x-ministry-id": m.ministry_id } })
          .catch(() => {}),
      ),
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "8px 12px",
          margin: "1px 0",
          borderRadius: "6px",
          fontSize: "12px",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          position: "relative",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ fontSize: "14px" }}>🔔</span>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span
            style={{
              marginLeft: "auto",
              background: "var(--accent)",
              color: "var(--white)",
              fontSize: "10px",
              fontWeight: "600",
              borderRadius: "10px",
              padding: "1px 6px",
              minWidth: "16px",
              textAlign: "center",
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            left: "100%",
            bottom: 0,
            marginLeft: "8px",
            width: "300px",
            maxHeight: "400px",
            overflow: "auto",
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              borderBottom: "0.5px solid var(--gray-200)",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--gray-500)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: "20px 12px", fontSize: "12px", color: "var(--gray-400)", textAlign: "center" }}>
              Nothing yet
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => handleClickNotification(n)}
              style={{
                padding: "10px 12px",
                borderBottom: "0.5px solid var(--gray-100)",
                cursor: "pointer",
                background: n.read ? "transparent" : "#f4f8fb",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-100)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "#f4f8fb")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: n.read ? "400" : "600", color: "var(--charcoal)" }}>
                  {n.title}
                </div>
                {!n.read && (
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: "4px" }} />
                )}
              </div>
              {n.body && <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: "2px" }}>{n.body}</div>}
              <div style={{ fontSize: "10px", color: "var(--gray-400)", marginTop: "4px" }}>{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
