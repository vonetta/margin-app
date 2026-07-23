import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import PageHeader from "../components/PageHeader";
import { clickableDivProps } from "../utils/a11y";

const cardStyle = {
  background: "var(--white)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius-lg)",
  padding: "20px",
  boxShadow: "var(--shadow)",
};

const labelStyle = {
  display: "block",
  fontSize: "10px",
  color: "var(--gray-600)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const sectionTitleStyle = {
  fontFamily: "Cinzel, serif",
  fontSize: "10px",
  fontWeight: "500",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--navy)",
  opacity: 0.7,
  marginBottom: "10px",
};

const PlatformAdmin = () => {
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const fetchMinistries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await client.get("/api/platform-admin/ministries");
      setMinistries(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load ministries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMinistries();
  }, [fetchMinistries]);

  const selectMinistry = async (ministryId) => {
    setSelectedId(ministryId);
    setOverview(null);
    setLoadingOverview(true);
    setError("");
    try {
      const res = await client.get(`/api/platform-admin/ministries/${ministryId}/overview`);
      setOverview(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load ministry overview");
    } finally {
      setLoadingOverview(false);
    }
  };

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="⚙"
        color="var(--navy)"
        title="Platform Admin"
        subtitle="Read-only visibility across every ministry — for you, not for ministry admins"
      />

      {error && (
        <div
          style={{
            background: "#fdf0f0",
            border: "0.5px solid #e8b4b4",
            borderRadius: "var(--border-radius)",
            padding: "10px 12px",
            fontSize: "12px",
            color: "#c0504d",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <div style={cardStyle}>
        <label style={labelStyle}>Ministries ({ministries.length})</label>
        {loading ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
        ) : ministries.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>No ministries yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {ministries.map((m, i) => (
              <div
                key={m.ministry_id}
                {...clickableDivProps(() => selectMinistry(m.ministry_id))}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  cursor: "pointer",
                  background: selectedId === m.ministry_id ? "var(--gray-100)" : "transparent",
                  borderBottom: i < ministries.length - 1 ? "0.5px solid var(--gray-300)" : "none",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>
                    {m.name}
                    {m.parent_ministry_id && (
                      <span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--gray-500)" }}>
                        (sub-ministry of {m.parent_ministry_id})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                    {m.ministry_id} · {m.plan} plan
                    {!m.onboarding_complete && " · onboarding incomplete"}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "var(--gray-600)", textAlign: "right" }}>
                  <div style={{ fontWeight: "600" }}>{m.member_count}</div>
                  <div>{m.member_count === 1 ? "member" : "members"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedId && (
        <div style={{ ...cardStyle, marginTop: "16px" }}>
          {loadingOverview ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading overview...</div>
          ) : (
            overview && (
              <>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "14px", color: "var(--navy)", marginBottom: "16px" }}>
                  {overview.ministry.name}
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <div style={sectionTitleStyle}>Team ({overview.team.length})</div>
                  {overview.team.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>No members.</div>
                  ) : (
                    overview.team.map((member, i) => (
                      <div key={i} style={{ fontSize: "12px", color: "var(--charcoal)", padding: "4px 0" }}>
                        {member.name} <span style={{ color: "var(--gray-500)" }}>({member.role}) — {member.email}</span>
                      </div>
                    ))
                  )}
                </div>

                {[
                  { title: "Recent tasks", items: overview.recent_tasks, render: (t) => t.title },
                  { title: "Recent events", items: overview.recent_events, render: (e) => e.title },
                  { title: "Recent flyers", items: overview.recent_flyers, render: (f) => f.title },
                  { title: "Recent communications drafts", items: overview.recent_drafts, render: (d) => d.subject },
                ].map((section) => (
                  <div key={section.title} style={{ marginBottom: "18px" }}>
                    <div style={sectionTitleStyle}>
                      {section.title} ({section.items.length})
                    </div>
                    {section.items.length === 0 ? (
                      <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>None yet.</div>
                    ) : (
                      section.items.map((item, i) => (
                        <div key={i} style={{ fontSize: "12px", color: "var(--charcoal)", padding: "4px 0" }}>
                          {section.render(item)}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default PlatformAdmin;
