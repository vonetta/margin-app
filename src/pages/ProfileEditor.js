import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const ProfileEditor = () => {
  const { user, ministryId, refreshUser } = useAuth();
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

  const membership = user?.ministries?.find(
    (m) => m.ministry_id === ministryId,
  );
  const canEdit = membership && ["admin", "leader"].includes(membership.role);
  const isAdmin = membership?.role === "admin";

  const fetchSubMinistries = useCallback(async () => {
    setLoadingSubMinistries(true);
    try {
      const res = await client.get("/api/ministry/sub-ministries");
      setSubMinistries(res.data);
    } catch (err) {
      console.error("Failed to load sub-ministries");
    } finally {
      setLoadingSubMinistries(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "sub-ministries" && isAdmin) fetchSubMinistries();
  }, [tab, isAdmin, fetchSubMinistries]);

  const createSubMinistry = async () => {
    if (!newSubId.trim() || !newSubName.trim()) return;
    setCreatingSub(true);
    setError("");
    try {
      await client.post("/api/ministry/sub-ministries", {
        ministry_id: newSubId.trim(),
        name: newSubName.trim(),
        tagline: newSubTagline.trim() || undefined,
      });
      setNewSubId("");
      setNewSubName("");
      setNewSubTagline("");
      flash("Sub-ministry created");
      await fetchSubMinistries();
      await refreshUser();
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
          ...(isAdmin
            ? [{ key: "sub-ministries", label: "Sub-ministries" }]
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;
