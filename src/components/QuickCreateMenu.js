import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ACTIONS = [
  { label: "New Task", icon: "☑", path: "/tasks" },
  { label: "New Event", icon: "◈", path: "/calendar" },
  { label: "New Flyer", icon: "▣", path: "/flyers" },
  { label: "New Draft", icon: "✦", path: "/content" },
];

// Cmd+K (Mac) / Ctrl+K (everywhere else) opens a small menu of the "add
// new X" actions reached for most often — each just navigates to that
// page with { openCreate: true } in route state, which the target page's
// own effect uses to pop its create form open (see Tasks.js/Calendar.js/
// FlyerGenerator.js/ContentStudio.js).
const QuickCreateMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  const go = (path) => {
    setOpen(false);
    navigate(path, { state: { openCreate: true } });
  };

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "18vh",
        zIndex: 400,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--white)",
          borderRadius: "var(--border-radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "360px",
          maxWidth: "90vw",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            fontSize: "10px",
            fontWeight: "500",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--gray-500)",
            borderBottom: "0.5px solid var(--gray-300)",
          }}
        >
          Quick create
        </div>
        {ACTIONS.map((action) => (
          <button
            key={action.path}
            onClick={() => go(action.path)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background: "transparent",
              border: "none",
              borderBottom: "0.5px solid var(--gray-200)",
              fontSize: "13px",
              color: "var(--charcoal)",
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-100)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: "15px", color: "var(--navy)" }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickCreateMenu;
