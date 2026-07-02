import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const ProfileEditor = () => {
  const navigate = useNavigate();
  const { user, ministryId, refreshUser, switchMinistry } = useAuth();
  const [tab, setTab] = useState("voice");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [personaName, setPersonaName] = useState("");
  const [signOff, setSignOff] = useState("");
  const [tonePillars, setTonePillars] = useState("");
  const [avoidList, setAvoidList] = useState("");
  const [newPhrase, setNewPhrase] = useState("");

  const [subMinistries, setSubMinistries] = useState([]);
  const [loadingSubMinistries, setLoadingSubMinistries] = useState(false);
  const [newSubId, setNewSubId] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [newSubTagline, setNewSubTagline] = useState("");
  const [creatingSub, setCreatingSub] = useState(false);
  const [orgOverview, setOrgOverview] = useState({});

  const [socialAccounts, setSocialAccounts] = useState([]);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [connectingSocial, setConnectingSocial] = useState(false);
  const [socialStatus, setSocialStatus] = useState(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState(null);

  const [sopDrafts, setSopDrafts] = useState([]);
  const [loadingSops, setLoadingSops] = useState(false);
  const [sopStatusFilter, setSopStatusFilter] = useState("pending_review");
  const [sopImages, setSopImages] = useState([]);
  const [sopNotes, setSopNotes] = useState("");
  const [generatingSop, setGeneratingSop] = useState(false);
  const [editingSopId, setEditingSopId] = useState(null);
  const [editSopTitle, setEditSopTitle] = useState("");
  const [editSopContent, setEditSopContent] = useState("");
  const [confirmDeleteSopId, setConfirmDeleteSopId] = useState(null);

  const membership = user?.ministries?.find(
    (m) => m.ministry_id === ministryId,
  );
  const canEdit = membership && ["admin", "leader"].includes(membership.role);
  const isAdmin = membership?.role === "admin";

  const fetchSubMinistries = useCallback(async () => {
    setLoadingSubMinistries(true);
    try {
      const [subRes, overviewRes] = await Promise.all([
        client.get("/api/ministry/sub-ministries"),
        // Read-only rollup — counts only, no individual event/task/member
        // records — so an admin can see what's happening across their
        // sub-ministries without needing to be a member of each one.
        client.get("/api/ministry/org-overview").catch(() => ({ data: [] })),
      ]);
      setSubMinistries(subRes.data);
      setOrgOverview(
        Object.fromEntries(overviewRes.data.map((o) => [o.ministry_id, o])),
      );
    } catch (err) {
      console.error("Failed to load sub-ministries");
    } finally {
      setLoadingSubMinistries(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "sub-ministries" && isAdmin) fetchSubMinistries();
  }, [tab, isAdmin, fetchSubMinistries]);

  // The Meta OAuth callback redirects the browser back here with
  // ?social=connected|denied|invalid_state|error — surface that once,
  // land on the right tab, then strip it from the URL so refreshing
  // doesn't re-show a stale status.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("social");
    if (status) {
      setSocialStatus(status);
      setTab("social");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const fetchSocialAccounts = useCallback(async () => {
    setLoadingSocial(true);
    try {
      const res = await client.get("/api/social/accounts");
      setSocialAccounts(res.data);
    } catch (err) {
      console.error("Failed to load connected social accounts");
    } finally {
      setLoadingSocial(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "social" && isAdmin) fetchSocialAccounts();
  }, [tab, isAdmin, fetchSocialAccounts]);

  const fetchSopDrafts = useCallback(async () => {
    setLoadingSops(true);
    try {
      const res = await client.get("/api/profile/sops/drafts");
      setSopDrafts(res.data);
    } catch (err) {
      console.error("Failed to load SOP drafts");
    } finally {
      setLoadingSops(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "sops" && canEdit) fetchSopDrafts();
  }, [tab, canEdit, fetchSopDrafts]);

  const handleGenerateSop = async () => {
    if (sopImages.length === 0) {
      setError("At least one image is required to draft an SOP");
      return;
    }
    setGeneratingSop(true);
    setError("");
    try {
      const formData = new FormData();
      sopImages.forEach((f) => formData.append("images", f));
      formData.append("notes", sopNotes);
      await client.post("/api/profile/sops/draft", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSopImages([]);
      setSopNotes("");
      setSopStatusFilter("pending_review");
      await fetchSopDrafts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to draft an SOP from these images");
    } finally {
      setGeneratingSop(false);
    }
  };

  const startEditSop = (draft) => {
    setEditingSopId(draft._id);
    setEditSopTitle(draft.title);
    setEditSopContent(draft.content);
  };

  const handleSaveSopEdit = async (id) => {
    try {
      const res = await client.put(`/api/profile/sops/drafts/${id}`, {
        title: editSopTitle,
        content: editSopContent,
      });
      setSopDrafts((prev) => prev.map((d) => (d._id === id ? res.data : d)));
      setEditingSopId(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save changes");
    }
  };

  const handleApproveSop = async (id) => {
    try {
      const res = await client.put(`/api/profile/sops/drafts/${id}/approve`, {});
      setSopDrafts((prev) => prev.map((d) => (d._id === id ? res.data : d)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve SOP");
    }
  };

  const handleRejectSop = async (id) => {
    try {
      const res = await client.put(`/api/profile/sops/drafts/${id}/reject`, {});
      setSopDrafts((prev) => prev.map((d) => (d._id === id ? res.data : d)));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reject SOP");
    }
  };

  const handleDeleteSop = async (id) => {
    try {
      await client.delete(`/api/profile/sops/drafts/${id}`);
      setSopDrafts((prev) => prev.filter((d) => d._id !== id));
      setConfirmDeleteSopId(null);
    } catch (err) {
      setError("Failed to delete SOP draft");
    }
  };

  const handleConnectSocial = async () => {
    setConnectingSocial(true);
    setError("");
    try {
      const res = await client.get("/api/social/connect");
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || "Failed to start Meta connection");
      setConnectingSocial(false);
    }
  };

  const handleDisconnectSocial = async (id) => {
    try {
      await client.delete(`/api/social/accounts/${id}`);
      setConfirmDisconnectId(null);
      await fetchSocialAccounts();
    } catch (err) {
      setError("Failed to disconnect account");
    }
  };

  const createSubMinistry = async () => {
    if (!newSubId.trim() || !newSubName.trim()) return;
    setCreatingSub(true);
    setError("");
    try {
      const subId = newSubId.trim();
      await client.post("/api/ministry/sub-ministries", {
        ministry_id: subId,
        name: newSubName.trim(),
        tagline: newSubTagline.trim() || undefined,
      });
      setNewSubId("");
      setNewSubName("");
      setNewSubTagline("");
      await refreshUser();
      // Switch straight into the new ministry and kick off its onboarding —
      // it's created with empty-but-usable defaults, but still needs its
      // own branding/voice/hashtags set before content sounds right.
      await switchMinistry(subId);
      navigate("/onboarding");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create sub-ministry");
    } finally {
      setCreatingSub(false);
    }
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/profile");
      setProfile(res.data);
      const vp = res.data.voice_profile || {};
      setPersonaName(vp.persona_name || "");
      setSignOff(vp.sign_off || "");
      setTonePillars((vp.tone_pillars || []).join(", "));
      setAvoidList((vp.avoid || []).join(", "));
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  };

  const saveVoice = async () => {
    setSaving(true);
    setError("");
    try {
      await client.put("/api/profile/voice", {
        persona_name: personaName,
        sign_off: signOff,
        tone_pillars: tonePillars
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        avoid: avoidList
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      flash("Voice profile saved");
      await fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addPhrase = async () => {
    if (!newPhrase.trim()) return;
    try {
      await client.post("/api/profile/phrases", { phrase: newPhrase.trim() });
      setNewPhrase("");
      flash("Phrase added");
      await fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add phrase");
    }
  };

  const removePhrase = async (phrase) => {
    try {
      await client.delete("/api/profile/phrases", { data: { phrase } });
      flash("Phrase removed");
      await fetchProfile();
    } catch (err) {
      setError("Failed to remove phrase");
    }
  };

  const labelStyle = {
    display: "block",
    fontSize: "10px",
    color: "var(--gray-600)",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "0.5px solid var(--gray-300)",
    borderRadius: "var(--border-radius)",
    fontSize: "13px",
    color: "var(--charcoal)",
    outline: "none",
  };

  const cardStyle = {
    background: "var(--white)",
    border: "0.5px solid var(--gray-300)",
    borderRadius: "var(--border-radius-lg)",
    padding: "20px",
    marginBottom: "16px",
  };

  if (loading) {
    return (
      <div
        style={{ padding: "32px", fontSize: "13px", color: "var(--gray-500)" }}
      >
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        style={{ padding: "32px", fontSize: "13px", color: "var(--gray-500)" }}
      >
        No profile found.
      </div>
    );
  }

  const phrases = profile.voice_profile?.sample_phrases || [];
  const feedbackLog = (profile.sops || []).filter((s) =>
    (s.tags || []).includes("feedback"),
  );

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "20px",
            fontWeight: "500",
            color: "var(--primary)",
            letterSpacing: "0.04em",
            marginBottom: "4px",
          }}
        >
          AI Profile
        </h2>
        <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
          The voice and rules that shape generated content
        </p>
      </div>

      {!canEdit && (
        <div
          style={{
            background: "#fff8ec",
            border: "0.5px solid #f0d080",
            borderRadius: "var(--border-radius)",
            padding: "12px 16px",
            fontSize: "12px",
            color: "#b8902e",
            marginBottom: "16px",
          }}
        >
          You have view-only access. Only admins and leaders can edit the
          profile.
        </div>
      )}

      {message && (
        <div
          style={{
            background: "#edf7f2",
            border: "0.5px solid #a0d4bc",
            borderRadius: "var(--border-radius)",
            padding: "10px 16px",
            fontSize: "12px",
            color: "#2a7a52",
            marginBottom: "16px",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#fdf0f0",
            border: "0.5px solid #e8b4b4",
            borderRadius: "var(--border-radius)",
            padding: "10px 16px",
            fontSize: "12px",
            color: "#c0504d",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
        {[
          { key: "voice", label: "Voice" },
          { key: "phrases", label: "Phrases" },
          { key: "feedback", label: "Feedback" },
          ...(canEdit ? [{ key: "sops", label: "SOPs" }] : []),
          ...(isAdmin
            ? [
                { key: "sub-ministries", label: "Sub-ministries" },
                { key: "social", label: "Social accounts" },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: "0.5px solid",
              borderColor: tab === t.key ? "var(--primary)" : "var(--gray-300)",
              background: tab === t.key ? "var(--primary)" : "transparent",
              color: tab === t.key ? "var(--white)" : "var(--gray-600)",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "voice" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={cardStyle}>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Persona name</label>
              <input
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Sign-off</label>
              <input
                value={signOff}
                onChange={(e) => setSignOff(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Tone pillars (comma separated)</label>
              <input
                value={tonePillars}
                onChange={(e) => setTonePillars(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Avoid (comma separated)</label>
              <input
                value={avoidList}
                onChange={(e) => setAvoidList(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            {canEdit && (
              <button
                onClick={saveVoice}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  background: saving ? "var(--gray-400)" : "var(--primary)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                {saving ? "Saving..." : "Save voice profile"}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "phrases" && (
        <div style={{ maxWidth: "600px" }}>
          {canEdit && (
            <div style={cardStyle}>
              <label style={labelStyle}>Add a sample phrase</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPhrase()}
                  placeholder="A phrase in the ministry's voice..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={addPhrase}
                  style={{
                    padding: "8px 16px",
                    background: "var(--primary)",
                    color: "var(--white)",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    fontWeight: "500",
                    whiteSpace: "nowrap",
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div style={cardStyle}>
            <label style={labelStyle}>Sample phrases ({phrases.length})</label>
            {phrases.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                No phrases yet.
              </div>
            ) : (
              phrases.map((phrase, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "10px 0",
                    borderBottom:
                      i < phrases.length - 1
                        ? "0.5px solid var(--gray-300)"
                        : "none",
                    fontSize: "12px",
                    color: "var(--charcoal)",
                    lineHeight: 1.6,
                  }}
                >
                  <span>{phrase}</span>
                  {canEdit && (
                    <button
                      onClick={() => removePhrase(phrase)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#c0504d",
                        fontSize: "14px",
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={cardStyle}>
            <label style={labelStyle}>
              Feedback log ({feedbackLog.length})
            </label>
            {feedbackLog.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                No feedback logged yet. When a draft is rejected with notes, it
                appears here.
              </div>
            ) : (
              feedbackLog
                .slice()
                .reverse()
                .map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 0",
                      borderBottom:
                        i < feedbackLog.length - 1
                          ? "0.5px solid var(--gray-300)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--charcoal)",
                        lineHeight: 1.6,
                      }}
                    >
                      {entry.content}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--gray-400)",
                        marginTop: "4px",
                      }}
                    >
                      {entry.title} ·{" "}
                      {entry.updated_at
                        ? new Date(entry.updated_at).toLocaleDateString()
                        : ""}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {tab === "sub-ministries" && isAdmin && (
        <div style={{ maxWidth: "600px" }}>
          <div style={cardStyle}>
            <label style={labelStyle}>Create a sub-ministry</label>
            <p
              style={{
                fontSize: "11px",
                color: "var(--gray-500)",
                marginBottom: "14px",
                lineHeight: 1.6,
              }}
            >
              A sub-ministry is a fully separate tenant — its own branding,
              voice profile, and members — linked here only for
              organizational display. You'll be added as its admin; no one
              else gets access unless added there directly.
            </p>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Ministry ID (slug)</label>
              <input
                value={newSubId}
                onChange={(e) => setNewSubId(e.target.value)}
                placeholder="salt-light"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Name</label>
              <input
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Salt & Light"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Tagline (optional)</label>
              <input
                value={newSubTagline}
                onChange={(e) => setNewSubTagline(e.target.value)}
                style={inputStyle}
              />
            </div>
            <button
              onClick={createSubMinistry}
              disabled={creatingSub || !newSubId.trim() || !newSubName.trim()}
              style={{
                padding: "8px 16px",
                background:
                  creatingSub || !newSubId.trim() || !newSubName.trim()
                    ? "var(--gray-400)"
                    : "var(--primary)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {creatingSub ? "Creating..." : "Create sub-ministry"}
            </button>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>
              Existing sub-ministries ({subMinistries.length})
            </label>
            {subMinistries.length > 0 && (
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--gray-500)",
                  marginBottom: "12px",
                  lineHeight: 1.6,
                }}
              >
                A quick read on what's happening in each — this is a
                summary only; you'd still need to be a member of a
                sub-ministry to see its actual events, tasks, or team.
              </p>
            )}
            {loadingSubMinistries ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                Loading...
              </div>
            ) : subMinistries.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                None yet.
              </div>
            ) : (
              subMinistries.map((m, i) => (
                <div
                  key={m._id}
                  style={{
                    padding: "10px 0",
                    borderBottom:
                      i < subMinistries.length - 1
                        ? "0.5px solid var(--gray-300)"
                        : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "500",
                      color: "var(--charcoal)",
                    }}
                  >
                    {m.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                    {m.ministry_id}
                    {m.tagline ? ` · ${m.tagline}` : ""}
                  </div>
                  {orgOverview[m.ministry_id] && (
                    <div
                      style={{
                        display: "flex",
                        gap: "14px",
                        marginTop: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        { label: "team", value: orgOverview[m.ministry_id].team_count },
                        {
                          label: "pending approvals",
                          value: orgOverview[m.ministry_id].pending_approvals,
                          warn: orgOverview[m.ministry_id].pending_approvals > 0,
                        },
                        { label: "open tasks", value: orgOverview[m.ministry_id].open_tasks },
                        {
                          label: "events in 30 days",
                          value: orgOverview[m.ministry_id].upcoming_events,
                        },
                      ].map((stat) => (
                        <div key={stat.label} style={{ fontSize: "11px" }}>
                          <span
                            style={{
                              fontWeight: "600",
                              color: stat.warn ? "var(--gold-dark, #b8860b)" : "var(--charcoal)",
                            }}
                          >
                            {stat.value}
                          </span>{" "}
                          <span style={{ color: "var(--gray-500)" }}>{stat.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "social" && isAdmin && (
        <div style={{ maxWidth: "600px" }}>
          {socialStatus && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 12px",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                background: socialStatus === "connected" ? "#eef7ee" : "#fdf0f0",
                border: `0.5px solid ${socialStatus === "connected" ? "#b4d8b4" : "#e8b4b4"}`,
                color: socialStatus === "connected" ? "#3a7a4a" : "#c0504d",
              }}
            >
              {socialStatus === "connected" && "Connected! Any Facebook Pages you manage (and their linked Instagram accounts) now show up below."}
              {socialStatus === "denied" && "Connection cancelled — nothing was changed."}
              {socialStatus === "invalid_state" && "That connection link expired or was invalid. Try connecting again."}
              {socialStatus === "error" && "Something went wrong completing the connection. Try again, or check that the Page has an admin role for this Meta account."}
            </div>
          )}

          <div style={cardStyle}>
            <label style={labelStyle}>Connect a Facebook Page</label>
            <p
              style={{
                fontSize: "11px",
                color: "var(--gray-500)",
                marginBottom: "14px",
                lineHeight: 1.6,
              }}
            >
              Connects through Meta's own login — Margin never sees your
              Facebook password. Any Instagram Business account linked to
              the Page you approve comes along with it automatically.
            </p>
            <button
              onClick={handleConnectSocial}
              disabled={connectingSocial}
              style={{
                padding: "8px 16px",
                background: connectingSocial ? "var(--gray-400)" : "var(--primary)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {connectingSocial ? "Redirecting to Meta..." : "Connect with Facebook"}
            </button>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>
              Connected accounts ({socialAccounts.length})
            </label>
            {loadingSocial ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
            ) : socialAccounts.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                Nothing connected yet.
              </div>
            ) : (
              socialAccounts.map((acct, i) => (
                <div
                  key={acct._id}
                  style={{
                    padding: "10px 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: i < socialAccounts.length - 1 ? "0.5px solid var(--gray-300)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--charcoal)" }}>
                      {acct.page_name}
                      {acct.status !== "active" && (
                        <span style={{ marginLeft: "6px", fontSize: "10px", color: "#c0504d" }}>
                          ({acct.status} — reconnect needed)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                      Facebook
                      {acct.instagram_username ? ` · Instagram @${acct.instagram_username}` : " · No Instagram linked"}
                    </div>
                  </div>
                  {confirmDisconnectId === acct._id ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => handleDisconnectSocial(acct._id)}
                        style={{
                          padding: "5px 10px",
                          background: "#c0504d",
                          color: "var(--white)",
                          border: "none",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDisconnectId(null)}
                        style={{
                          padding: "5px 10px",
                          background: "transparent",
                          color: "var(--gray-600)",
                          border: "0.5px solid var(--gray-300)",
                          borderRadius: "var(--border-radius)",
                          fontSize: "11px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDisconnectId(acct._id)}
                      style={{
                        padding: "5px 10px",
                        background: "transparent",
                        color: "#c0504d",
                        border: "0.5px solid #e8b4b4",
                        borderRadius: "var(--border-radius)",
                        fontSize: "11px",
                      }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "sops" && canEdit && (
        <div style={{ maxWidth: "700px" }}>
          <div style={cardStyle}>
            <label style={labelStyle}>Draft a new SOP from images</label>
            <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "14px", lineHeight: 1.6 }}>
              Upload a few images of the process (screenshots, photos of a
              whiteboard, a checklist, etc.) and add any notes for context.
              AI drafts a step-by-step SOP, which sits here for review before
              it can be approved and start shaping how the AI writes content.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => setSopImages(Array.from(e.target.files || []))}
              style={{ marginBottom: "10px", fontSize: "12px" }}
            />
            {sopImages.length > 0 && (
              <div style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "10px" }}>
                {sopImages.length} image{sopImages.length > 1 ? "s" : ""} selected
              </div>
            )}
            <textarea
              placeholder="Notes about this process..."
              value={sopNotes}
              onChange={(e) => setSopNotes(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "10px" }}
            />
            <button
              onClick={handleGenerateSop}
              disabled={generatingSop}
              style={{
                padding: "8px 16px",
                background: generatingSop ? "var(--gray-400)" : "var(--primary)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {generatingSop ? "Drafting..." : "✦ Draft SOP"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            {[
              { key: "pending_review", label: "Pending" },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSopStatusFilter(s.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "16px",
                  border: "0.5px solid",
                  borderColor: sopStatusFilter === s.key ? "var(--primary)" : "var(--gray-300)",
                  background: sopStatusFilter === s.key ? "var(--primary)" : "transparent",
                  color: sopStatusFilter === s.key ? "var(--white)" : "var(--gray-600)",
                  fontSize: "11px",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {loadingSops ? (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
          ) : (
            sopDrafts
              .filter((d) => d.status === sopStatusFilter)
              .map((draft) => (
                <div key={draft._id} style={cardStyle}>
                  {editingSopId === draft._id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <input
                        style={inputStyle}
                        value={editSopTitle}
                        onChange={(e) => setEditSopTitle(e.target.value)}
                      />
                      <textarea
                        style={{ ...inputStyle, resize: "vertical" }}
                        rows={8}
                        value={editSopContent}
                        onChange={(e) => setEditSopContent(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => handleSaveSopEdit(draft._id)}
                          style={{
                            padding: "6px 14px",
                            background: "var(--primary)",
                            color: "var(--white)",
                            border: "none",
                            borderRadius: "var(--border-radius)",
                            fontSize: "12px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSopId(null)}
                          style={{
                            padding: "6px 14px",
                            background: "transparent",
                            color: "var(--gray-600)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "12px",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)", marginBottom: "8px" }}>
                        {draft.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--gray-600)", whiteSpace: "pre-wrap", marginBottom: "12px" }}>
                        {draft.content}
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => startEditSop(draft)}
                          style={{
                            padding: "5px 12px",
                            background: "transparent",
                            color: "var(--gray-600)",
                            border: "0.5px solid var(--gray-300)",
                            borderRadius: "var(--border-radius)",
                            fontSize: "11px",
                          }}
                        >
                          ✎ Edit
                        </button>
                        {draft.status !== "approved" && (
                          <button
                            onClick={() => handleApproveSop(draft._id)}
                            style={{
                              padding: "5px 12px",
                              background: "transparent",
                              color: "#3a7a4a",
                              border: "0.5px solid #b4d8b4",
                              borderRadius: "var(--border-radius)",
                              fontSize: "11px",
                            }}
                          >
                            ✓ Approve
                          </button>
                        )}
                        {draft.status !== "rejected" && (
                          <button
                            onClick={() => handleRejectSop(draft._id)}
                            style={{
                              padding: "5px 12px",
                              background: "transparent",
                              color: "#c0504d",
                              border: "0.5px solid #e8b4b4",
                              borderRadius: "var(--border-radius)",
                              fontSize: "11px",
                            }}
                          >
                            ✕ Reject
                          </button>
                        )}
                        {confirmDeleteSopId === draft._id ? (
                          <>
                            <button
                              onClick={() => handleDeleteSop(draft._id)}
                              style={{
                                padding: "5px 12px",
                                background: "#c0504d",
                                color: "var(--white)",
                                border: "none",
                                borderRadius: "var(--border-radius)",
                                fontSize: "11px",
                              }}
                            >
                              Confirm delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteSopId(null)}
                              style={{
                                padding: "5px 12px",
                                background: "transparent",
                                color: "var(--gray-600)",
                                border: "0.5px solid var(--gray-300)",
                                borderRadius: "var(--border-radius)",
                                fontSize: "11px",
                              }}
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteSopId(draft._id)}
                            style={{
                              padding: "5px 12px",
                              background: "transparent",
                              color: "var(--gray-500)",
                              border: "0.5px solid var(--gray-300)",
                              borderRadius: "var(--border-radius)",
                              fontSize: "11px",
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
          )}
          {!loadingSops && sopDrafts.filter((d) => d.status === sopStatusFilter).length === 0 && (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
              No {sopStatusFilter === "pending_review" ? "pending" : sopStatusFilter} SOPs.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;
