import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full access — manages the ministry, team roles, and approvals" },
  { value: "leader", label: "Leader", desc: "Gets notified on pending approvals; can manage events and tasks" },
  { value: "team", label: "Team", desc: "Sees and completes their own assigned tasks and calendar" },
];

const Team = () => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/ministry/team");
      setTeam(res.data);
    } catch (err) {
      setError("Failed to load team roster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleRoleChange = async (member, newRole) => {
    if (newRole === member.role) return;
    setSavingId(member._id);
    setError("");
    try {
      await client.put(`/api/ministry/team/${member._id}`, { role: newRole });
      setTeam((prev) => prev.map((m) => (m._id === member._id ? { ...m, role: newRole } : m)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update role");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "20px",
            fontWeight: "500",
            letterSpacing: "0.04em",
            color: "var(--navy)",
            marginBottom: "4px",
          }}
        >
          Team
        </h2>
        <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
          Set who's a leader or admin — leaders and admins get notified when something needs approval
        </p>
      </div>

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

      {loading ? (
        <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "640px" }}>
          {team.map((member) => (
            <div
              key={member._id}
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>{member.name}</div>
                <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>{member.email}</div>
              </div>
              <select
                value={member.role}
                disabled={savingId === member._id}
                onChange={(e) => handleRoleChange(member, e.target.value)}
                title={ROLES.find((r) => r.value === member.role)?.desc}
                style={{
                  padding: "6px 10px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value} title={r.desc}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Team;
