import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const USAGE_LABELS = {
  team_members: "Team members",
  sub_ministries: "Sub-ministries",
  flyers_per_month: "Flyers this month",
};

const Dashboard = () => {
  const { user, ministryId, ministry } = useAuth();
  const navigate = useNavigate();
  const [planUsage, setPlanUsage] = useState(null);

  useEffect(() => {
    client
      .get("/api/ministry/plan-usage")
      .then((res) => setPlanUsage(res.data))
      .catch(() => setPlanUsage(null));
  }, [ministryId]);

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

      {ministry && !ministry.onboarding_complete && (
        <div
          onClick={() => navigate("/onboarding")}
          style={{
            background: "#fff8ec",
            border: "0.5px solid #f0d080",
            borderRadius: "var(--border-radius-lg)",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", fontWeight: "500", color: "#b8902e" }}>
              Finish setting up {ministry.name}
            </div>
            <div style={{ fontSize: "11px", color: "#b8902e", opacity: 0.8, marginTop: "2px" }}>
              Branding, voice, and hashtags aren't fully set up yet
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#b8902e", fontWeight: "500" }}>
            Continue setup →
          </div>
        </div>
      )}

      {planUsage && (
        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom: "28px",
            padding: "14px 18px",
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: "600",
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              alignSelf: "center",
            }}
          >
            {planUsage.plan} plan
          </div>
          {Object.entries(planUsage.usage).map(([key, stat]) => {
            const unlimited = stat.limit === null;
            const atCap = !unlimited && stat.used >= stat.limit;
            return (
              <div key={key} style={{ fontSize: "12px" }}>
                <span style={{ fontWeight: "600", color: atCap ? "#c0504d" : "var(--charcoal)" }}>
                  {stat.used}
                </span>
                <span style={{ color: "var(--gray-500)" }}>
                  {" "}
                  / {unlimited ? "∞" : stat.limit} {USAGE_LABELS[key]}
                </span>
              </div>
            );
          })}
        </div>
      )}

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
            desc: "Draft emails to speakers and partners",
            path: "/communications",
          },
          {
            label: "Calendar",
            desc: "Prayer calls, meetings, and upcoming events",
            path: "/calendar",
          },
          {
            label: "Tasks",
            desc: "What you and your team need to get done",
            path: "/tasks",
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
