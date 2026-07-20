import React from "react";

const UndoToastStack = ({ pending, onUndo }) => {
  if (!pending || pending.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 300,
      }}
    >
      {pending.map((p) => (
        <div
          key={p.key}
          style={{
            background: "var(--navy)",
            color: "var(--white)",
            borderRadius: "var(--border-radius)",
            padding: "10px 14px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "var(--shadow-md)",
            minWidth: "220px",
          }}
        >
          <span style={{ flex: 1 }}>{p.label} deleted</span>
          <button
            onClick={() => onUndo(p.key)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--gold)",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Undo
          </button>
        </div>
      ))}
    </div>
  );
};

export default UndoToastStack;
