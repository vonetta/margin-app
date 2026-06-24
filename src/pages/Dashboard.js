import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user, ministryId } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ padding: "32px" }}>
      <h2
        style={{
          fontFamily: "Cinzel, serif",
          fontSize: "20px",
          fontWeight: "500",
          color: "var(--navy)",
          letterSpacing: "0.04em",
          marginBottom: "8px",
        }}
      >
        Welcome back, {user?.name?.split(" ")[0]}
      </h2>
      <p
        style={{
          fontSize: "13px",
          color: "var(--gray-600)",
          marginBottom: "32px",
        }}
      >
        {ministryId?.toUpperCase()} workspace
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          {
            label: "Content Studio",
            desc: "Generate and review content",
            path: "/content",
          },
          {
            label: "Flyers",
            desc: "Generate event flyers",
            path: "/flyers",
          },
          { label: "People", desc: "Directory and groups", path: "/people" },
          {
            label: "Communications",
            desc: "Announcements and emails",
            path: "/communications",
            comingSoon: true,
          },
          {
            label: "Events",
            desc: "Manage ministry events",
            path: "/events",
            comingSoon: true,
          },
        ].map((card) => (
          <div
            key={card.path}
            onClick={() => !card.comingSoon && navigate(card.path)}
            style={{
              background: "var(--white)",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
              cursor: card.comingSoon ? "default" : "pointer",
              opacity: card.comingSoon ? 0.5 : 1,
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              if (card.comingSoon) return;
              e.currentTarget.style.borderColor = "var(--navy)";
              e.currentTarget.style.boxShadow = "var(--shadow)";
            }}
            onMouseLeave={(e) => {
              if (card.comingSoon) return;
              e.currentTarget.style.borderColor = "var(--gray-300)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--navy)",
                letterSpacing: "0.06em",
                marginBottom: "6px",
              }}
            >
              {card.label.toUpperCase()}
              {card.comingSoon && (
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "9px",
                    color: "var(--gold-dark)",
                  }}
                >
                  SOON
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--gray-600)",
              }}
            >
              {card.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
