import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";

const ROLES = [
  { value: "admin", label: "Admin", desc: "Full access — manages the ministry, team roles, and approvals" },
  { value: "leader", label: "Leader", desc: "Gets notified on pending approvals; can manage events and tasks" },
  { value: "team", label: "Team", desc: "Sees and completes their own assigned tasks and calendar" },
];

const emptyInviteForm = { name: "", email: "", role: "team" };

const mailtoInvite = (invite) => {
  const subject = "You're invited to join Margin";
  const body = `Hi${invite.name ? ` ${invite.name}` : ""},\n\nYou've been invited to join the team on Margin. Use this link to set up your account:\n\n${invite.invite_link}\n\nThis link expires in 14 days.`;
  return `mailto:${invite.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const Team = () => {
  const [team, setTeam] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [invitingSaving, setInvitingSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [overview, setOverview] = useState({});
  const [loadingOverview, setLoadingOverview] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, invitesRes] = await Promise.all([
        client.get("/api/ministry/team"),
        client.get("/api/invites"),
      ]);
      setTeam(teamRes.data);
      setInvites(invitesRes.data);
    } catch (err) {
      setError("Failed to load team roster");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await client.get("/api/tasks/team-overview");
      setOverview(res.data);
    } catch (err) {
      setOverview({});
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchOverview();
  }, [fetchAll, fetchOverview]);

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

  const handleSendInvite = async () => {
    if (!inviteForm.email.trim()) {
      setError("An email is required to invite someone");
      return;
    }
    setInvitingSaving(true);
    setError("");
    try {
      const res = await client.post("/api/invites", {
        name: inviteForm.name.trim() || undefined,
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      setInvites((prev) => [res.data, ...prev.filter((i) => i._id !== res.data._id)]);
      setInviteForm(emptyInviteForm);
      setShowInviteForm(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send invite");
    } finally {
      setInvitingSaving(false);
    }
  };

  const handleRevoke = async (invite) => {
    try {
      await client.delete(`/api/invites/${invite._id}`);
      setInvites((prev) => prev.filter((i) => i._id !== invite._id));
    } catch (err) {
      setError("Failed to revoke invite");
    }
  };

  const handleCopyLink = (invite) => {
    navigator.clipboard.writeText(invite.invite_link);
    setCopiedId(invite._id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
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
            Add members and set who's a leader or admin — leaders and admins get notified when something needs approval
          </p>
        </div>
        <button
          onClick={() => setShowInviteForm((s) => !s)}
          style={{
            padding: "8px 16px",
            background: "var(--navy)",
            color: "var(--white)",
            border: "none",
            borderRadius: "var(--border-radius)",
            fontSize: "12px",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          {showInviteForm ? "Cancel" : "+ Add member"}
        </button>
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

      <div
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--gray-300)",
          borderRadius: "var(--border-radius-lg)",
          padding: "20px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "12px",
            fontWeight: "500",
            color: "var(--navy)",
            letterSpacing: "0.06em",
            marginBottom: "12px",
          }}
        >
          TEAM OVERVIEW
        </div>
        {loadingOverview ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
        ) : Object.keys(overview).length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
            No open tasks assigned to anyone right now.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {Object.entries(overview).map(([name, tasks]) => (
              <div key={name}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--charcoal)", marginBottom: "6px" }}>
                  {name}
                  <span style={{ color: "var(--gray-500)", fontWeight: "400" }}> ({tasks.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {tasks.map((t) => (
                    <div key={t._id} style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                      {t.title}
                      {t.due_date && (
                        <span style={{ color: "var(--gray-500)" }}>
                          {" "}
                          · {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInviteForm && (
        <div
          style={{
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            padding: "20px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            maxWidth: "480px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Name (optional)"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            />
            <input
              type="email"
              placeholder="Email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
              }}
            />
          </div>
          <select
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            style={{
              padding: "8px 12px",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius)",
              fontSize: "13px",
            }}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} — {r.desc}
              </option>
            ))}
          </select>
          <div>
            <button
              onClick={handleSendInvite}
              disabled={invitingSaving}
              style={{
                padding: "8px 16px",
                background: "var(--navy)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              {invitingSaving ? "Sending..." : "Create invite"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
      ) : (
        <>
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

          {invites.length > 0 && (
            <div style={{ marginTop: "28px", maxWidth: "640px" }}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "var(--gray-500)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "8px",
                }}
              >
                Pending invites
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {invites.map((invite) => (
                  <div
                    key={invite._id}
                    style={{
                      background: "var(--gray-100)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius-lg)",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--charcoal)" }}>
                        {invite.name || invite.email}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                        {invite.email} · invited as {ROLES.find((r) => r.value === invite.role)?.label || invite.role}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <a
                        href={mailtoInvite(invite)}
                        style={{
                          padding: "5px 10px",
                          background: "var(--navy)",
                          color: "var(--white)",
                          border: "none",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                          textDecoration: "none",
                        }}
                      >
                        Email invite
                      </a>
                      <button
                        onClick={() => handleCopyLink(invite)}
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          color: "var(--navy)",
                          border: "0.5px solid var(--navy)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        {copiedId === invite._id ? "Copied!" : "Copy link"}
                      </button>
                      <button
                        onClick={() => handleRevoke(invite)}
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          color: "#c0504d",
                          border: "0.5px solid #e8b4b4",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                          cursor: "pointer",
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Team;
