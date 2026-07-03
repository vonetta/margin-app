import React from "react";

// Shared page-header pattern: a colored icon badge + bold title + subtitle.
// Every top-level page used the same plain-text <h2> block before this —
// pulling it into one component means the "make it feel alive" pass
// (icon identity, consistent styling) only has one place to change, and
// every page picks up updates together instead of drifting apart.
const PageHeader = ({ icon, color = "var(--navy)", title, subtitle, action }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "24px",
      gap: "16px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {icon && (
        <span
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            background: color,
            color: "var(--white)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "17px",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      <div>
        <h2
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "22px",
            fontWeight: "500",
            letterSpacing: "0.03em",
            color: "var(--navy)",
            marginBottom: "4px",
          }}
        >
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export default PageHeader;
