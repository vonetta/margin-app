import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

// Grouped by mental model rather than one flat list: land on Dashboard,
// go CREATE something ministry-facing, OPERATE the day-to-day, or SET UP
// the ministry's profile/knowledge base. A group only renders if at
// least one of its items is visible to the current role.
const navGroups = [
  {
    label: null,
    items: [{ label: "Dashboard", path: "/", icon: "⊞" }],
  },
  {
    label: "Create",
    items: [
      { label: "Captions", path: "/content", icon: "✦", hint: "Start from words" },
      { label: "Flyers", path: "/flyers", icon: "▣", hint: "Start from the design" },
      { label: "Communications", path: "/communications", icon: "✉" },
      { label: "Social Queue", path: "/social-queue", icon: "⌘", adminOnly: true },
    ],
  },
  {
    label: "Operate",
    items: [
      { label: "Calendar", path: "/calendar", icon: "◈" },
      { label: "Tasks", path: "/tasks", icon: "☑" },
      { label: "Meeting Recap", path: "/meeting-recap", icon: "▧", roles: ["admin", "leader"] },
      { label: "People", path: "/people", icon: "◎" },
      { label: "Team", path: "/team", icon: "⚑", adminOnly: true },
    ],
  },
  {
    label: "Setup",
    items: [
      { label: "SOPs", path: "/sops", icon: "▤", roles: ["admin", "leader"] },
      { label: "AI Profile", path: "/profile", icon: "◐" },
      { label: "Resources", path: "/resources", icon: "▦", comingSoon: true },
    ],
  },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ministryId, ministry, logout, switchMinistry } = useAuth();

  const memberships = user?.ministries || [];
  const currentRole = memberships.find((m) => m.ministry_id === ministryId)?.role;
  const isVisible = (item) => {
    if (item.roles) return item.roles.includes(currentRole);
    return !item.adminOnly || currentRole === "admin";
  };
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
    .filter((group) => group.items.length > 0);

  const handleSwitch = async (e) => {
    const newId = e.target.value;
    if (newId === ministryId) return;
    await switchMinistry(newId);
    navigate("/");
  };

  return (
    <div
      style={{
        width: "210px",
        minHeight: "100vh",
        background: "var(--primary)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: "0.5px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--white)",
            letterSpacing: "0.1em",
          }}
        >
          {ministry?.name || "MARGIN"}
        </div>
        <div
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.4)",
            marginTop: "3px",
            letterSpacing: "0.04em",
          }}
        >
          {ministry?.tagline || "Ministry Operations"}
        </div>

        {memberships.length > 1 && (
          <select
            value={ministryId || ""}
            onChange={handleSwitch}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "6px 8px",
              background: "rgba(255,255,255,0.08)",
              color: "var(--white)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              borderRadius: "6px",
              fontSize: "11px",
              outline: "none",
            }}
          >
            {memberships.map((m) => (
              <option key={m.ministry_id} value={m.ministry_id} style={{ color: "#1c1c1c" }}>
                {m.name || m.ministry_id}
              </option>
            ))}
          </select>
        )}
      </div>

      <nav style={{ flex: 1, padding: "12px 6px" }}>
        {visibleGroups.map((group, gi) => (
          <div key={group.label || "overview"} style={{ marginTop: gi > 0 ? "14px" : 0 }}>
            {group.label && (
              <div
                style={{
                  padding: "0 12px",
                  marginBottom: "4px",
                  fontSize: "9px",
                  fontWeight: "600",
                  color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = location.pathname === item.path;
              const disabled = !!item.comingSoon;
              return (
                <div
                  key={item.path}
                  onClick={() => !disabled && navigate(item.path)}
                  title={disabled ? "Coming soon" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    margin: "1px 0",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: disabled
                      ? "rgba(255,255,255,0.3)"
                      : active
                        ? "var(--white)"
                        : "rgba(255,255,255,0.55)",
                    background: active && !disabled ? "var(--accent)" : "transparent",
                    cursor: disabled ? "default" : "pointer",
                    transition: "all 0.15s",
                    letterSpacing: "0.02em",
                  }}
                  onMouseEnter={(e) => {
                    if (!active && !disabled)
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active && !disabled)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "14px", opacity: 0.85 }}>
                      {item.icon}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span>{item.label}</span>
                      {item.hint && (
                        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontWeight: "400" }}>
                          {item.hint}
                        </span>
                      )}
                    </span>
                  </span>
                  {disabled && (
                    <span style={{ fontSize: "8px", letterSpacing: "0.04em" }}>
                      SOON
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: "12px 6px 16px",
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        <NotificationBell />
        <div
          style={{
            padding: "8px 12px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.02em",
          }}
        >
          {user?.name}
        </div>
        <div
          onClick={logout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.55)",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          ⊗ Sign out
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
