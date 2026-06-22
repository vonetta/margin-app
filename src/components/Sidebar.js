import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { label: "Dashboard", path: "/", icon: "⊞" },
  { label: "Content Studio", path: "/content", icon: "✦" },
  { label: "Communications", path: "/communications", icon: "✉" },
  { label: "Events", path: "/events", icon: "◈" },
  { label: "People", path: "/people", icon: "◎" },
  { label: "Resources", path: "/resources", icon: "▦" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ministry, ministryId, logout } = useAuth();

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
      </div>

      <nav style={{ flex: 1, padding: "12px 6px" }}>
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                margin: "1px 0",
                borderRadius: "6px",
                fontSize: "12px",
                color: active ? "var(--white)" : "rgba(255,255,255,0.55)",
                background: active ? "var(--accent)" : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                letterSpacing: "0.02em",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: "14px", opacity: 0.85 }}>
                {item.icon}
              </span>
              {item.label}
            </div>
          );
        })}
      </nav>

      <div
        style={{
          padding: "12px 6px 16px",
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
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
