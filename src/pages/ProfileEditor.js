import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";

const REGISTER_KEYS = ["formal", "warm", "energetic"];

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
  const [registers, setRegisters] = useState({});
  const [newPhrase, setNewPhrase] = useState("");

  // "Advanced" tab — platform_notes/platforms, visual_prohibitions,
  // templates, and recurring_content all existed on the schema and were
  // already consumed by content generation, but had no edit surface past
  // initial onboarding seeding. Each saves independently via its own PUT.
  const [platformsList, setPlatformsList] = useState("");
  const [platformNotes, setPlatformNotes] = useState({});
  const [savingPlatformSettings, setSavingPlatformSettings] = useState(false);

  const [visualProhibitions, setVisualProhibitions] = useState("");
  const [savingVisualGuidelines, setSavingVisualGuidelines] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [savingTemplates, setSavingTemplates] = useState(false);

  const [recurringContent, setRecurringContent] = useState([]);
  const [newRecurringTitle, setNewRecurringTitle] = useState("");
  const [newRecurringContent, setNewRecurringContent] = useState("");
  const [savingRecurringContent, setSavingRecurringContent] = useState(false);

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

  // Snapshot of the last saved/loaded form values — compared against
  // current form state to know whether there are unsaved edits worth
  // warning about before the user navigates away.
  const [savedSnapshot, setSavedSnapshot] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/profile");
      setProfile(res.data);
      const vp = res.data.voice_profile || {};
      const loaded = {
        personaName: vp.persona_name || "",
        signOff: vp.sign_off || "",
        tonePillars: (vp.tone_pillars || []).join(", "),
        avoidList: (vp.avoid || []).join(", "),
        registers: vp.registers || {},
        platformsList: (res.data.platforms || []).join(", "),
        platformNotes: res.data.platform_notes || {},
        visualProhibitions: (res.data.visual_prohibitions || []).join("\n"),
        templates: res.data.templates || [],
        recurringContent: res.data.recurring_content || [],
      };
      setPersonaName(loaded.personaName);
      setSignOff(loaded.signOff);
      setTonePillars(loaded.tonePillars);
      setAvoidList(loaded.avoidList);
      setRegisters(loaded.registers);
      setPlatformsList(loaded.platformsList);
      setPlatformNotes(loaded.platformNotes);
      setVisualProhibitions(loaded.visualProhibitions);
      setTemplates(loaded.templates);
      setRecurringContent(loaded.recurringContent);
      setSavedSnapshot(loaded);
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const isDirty =
    savedSnapshot !== null &&
    JSON.stringify({
      personaName,
      signOff,
      tonePillars,
      avoidList,
      registers,
      platformsList,
      platformNotes,
      visualProhibitions,
      templates,
      recurringContent,
    }) !== JSON.stringify(savedSnapshot);

  // Covers refresh/close/typing a new URL. In-app tab switches are
  // guarded separately in changeTab since SPA navigation doesn't fire
  // beforeunload.
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const changeTab = (key) => {
    if (key === tab) return;
    if (isDirty && !window.confirm("You have unsaved changes on this tab that will be lost. Switch anyway?")) {
      return;
    }
    setTab(key);
  };

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
        registers,
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

  const platformNames = platformsList
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const savePlatformSettings = async () => {
    setSavingPlatformSettings(true);
    setError("");
    try {
      // Only keep notes for platforms still actually in the list — a
      // renamed/removed platform shouldn't leave an orphaned note behind.
      const trimmedNotes = Object.fromEntries(
        Object.entries(platformNotes).filter(([key]) => platformNames.includes(key)),
      );
      await client.put("/api/profile/platform-settings", {
        platforms: platformNames,
        platform_notes: trimmedNotes,
      });
      flash("Platform settings saved");
      await fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save platform settings");
    } finally {
      setSavingPlatformSettings(false);
    }
  };

  const saveVisualGuidelines = async () => {
    setSavingVisualGuidelines(true);
    setError("");
    try {
      await client.put("/api/profile/visual-guidelines", {
        visual_prohibitions: visualProhibitions
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      flash("Visual guidelines saved");
      await fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save visual guidelines");
    } finally {
      setSavingVisualGuidelines(false);
    }
  };

  const addTemplate = () => {
    if (!newTemplateContent.trim()) return;
    setTemplates((prev) => [...prev, { title: newTemplateTitle.trim() || "Untitled", content: newTemplateContent.trim() }]);
    setNewTemplateTitle("");
    setNewTemplateContent("");
  };

  const removeTemplate = (index) => {
    setTemplates((prev) => prev.filter((_, i) => i !== index));
  };

  const saveTemplates = async () => {
    setSavingTemplates(true);
    setError("");
    try {
      await client.put("/api/profile/templates", { templates });
      flash("Templates saved");
      await fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save templates");
    } finally {
      setSavingTemplates(false);
    }
  };

  const addRecurringContent = () => {
    if (!newRecurringContent.trim()) return;
    setRecurringContent((prev) => [
      ...prev,
      { title: newRecurringTitle.trim() || "Untitled", content: newRecurringContent.trim() },
    ]);
    setNewRecurringTitle("");
    setNewRecurringContent("");
  };

  const removeRecurringContent = (index) => {
    setRecurringContent((prev) => prev.filter((_, i) => i !== index));
  };

  const saveRecurringContent = async () => {
    setSavingRecurringContent(true);
    setError("");
    try {
      await client.put("/api/profile/recurring-content", { recurring_content: recurringContent });
      flash("Recurring content saved");
      await fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save recurring content");
    } finally {
      setSavingRecurringContent(false);
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
    boxShadow: "var(--shadow)",
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
      <PageHeader
        icon="◐"
        color="var(--gold)"
        title="AI Profile"
        subtitle="The voice and rules that shape generated content"
      />

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
          { key: "advanced", label: "Advanced" },
          ...(isAdmin
            ? [
                { key: "sub-ministries", label: "Sub-ministries" },
                { key: "social", label: "Social accounts" },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
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
              <label style={labelStyle} htmlFor="profile-persona-name">Persona name</label>
              <input
                id="profile-persona-name"
                value={personaName}
                onChange={(e) => setPersonaName(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle} htmlFor="profile-sign-off">Sign-off</label>
              <input
                id="profile-sign-off"
                value={signOff}
                onChange={(e) => setSignOff(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle} htmlFor="profile-tone-pillars">Tone pillars (comma separated)</label>
              <input
                id="profile-tone-pillars"
                value={tonePillars}
                onChange={(e) => setTonePillars(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle} htmlFor="profile-avoid-list">Avoid (comma separated)</label>
              <input
                id="profile-avoid-list"
                value={avoidList}
                onChange={(e) => setAvoidList(e.target.value)}
                disabled={!canEdit}
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Communication registers</label>
              <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "10px", marginTop: "-2px" }}>
                How this voice actually sounds in each mode — used every time content is generated. Only set once
                during initial setup until now; editable here going forward.
              </p>
              {REGISTER_KEYS.map((key) => (
                <div key={key} style={{ marginBottom: "10px" }}>
                  <label style={{ fontSize: "11px", color: "var(--gray-500)", textTransform: "capitalize" }} htmlFor={`profile-register-${key}`}>
                    {key}
                  </label>
                  <input
                    id={`profile-register-${key}`}
                    value={registers[key] || ""}
                    onChange={(e) => setRegisters((r) => ({ ...r, [key]: e.target.value }))}
                    disabled={!canEdit}
                    style={inputStyle}
                  />
                </div>
              ))}
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
              <label style={labelStyle} htmlFor="profile-new-phrase">Add a sample phrase</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="profile-new-phrase"
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
                        color: "var(--gray-600)",
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

      {tab === "advanced" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={cardStyle}>
            <label style={labelStyle} htmlFor="profile-platforms">Platforms you post to (comma separated)</label>
            <input
              id="profile-platforms"
              value={platformsList}
              onChange={(e) => setPlatformsList(e.target.value)}
              placeholder="Instagram, Facebook, Email"
              disabled={!canEdit}
              style={{ ...inputStyle, marginBottom: "12px" }}
            />
            {platformNames.length > 0 && (
              <>
                <label style={labelStyle}>Per-platform tone notes (optional)</label>
                <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "10px", marginTop: "-2px" }}>
                  Used whenever content is generated for that platform — e.g. Instagram tends to be shorter and more
                  visual than Email.
                </p>
                {platformNames.map((name) => (
                  <div key={name} style={{ marginBottom: "10px" }}>
                    <label style={{ fontSize: "11px", color: "var(--gray-500)" }} htmlFor={`profile-platform-note-${name}`}>
                      {name}
                    </label>
                    <input
                      id={`profile-platform-note-${name}`}
                      value={platformNotes[name] || ""}
                      onChange={(e) => setPlatformNotes((p) => ({ ...p, [name]: e.target.value }))}
                      disabled={!canEdit}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </>
            )}
            {canEdit && (
              <button
                onClick={savePlatformSettings}
                disabled={savingPlatformSettings}
                style={{
                  padding: "8px 16px",
                  background: savingPlatformSettings ? "var(--gray-400)" : "var(--primary)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                {savingPlatformSettings ? "Saving..." : "Save platform settings"}
              </button>
            )}
          </div>

          <div style={cardStyle}>
            <label style={labelStyle} htmlFor="profile-visual-prohibitions">Visual guidelines (one per line)</label>
            <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "10px", marginTop: "-2px" }}>
              Things the AI flyer engine must never depict — colors, clutter, stock imagery, whatever's off-brand for
              this ministry.
            </p>
            <textarea
              id="profile-visual-prohibitions"
              value={visualProhibitions}
              onChange={(e) => setVisualProhibitions(e.target.value)}
              disabled={!canEdit}
              rows={5}
              placeholder={"Neon or hyper-saturated colors outside the official palette\nCluttered or chaotic backgrounds\nGeneric clip art or low-quality stock graphics"}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, marginBottom: "12px" }}
            />
            {canEdit && (
              <button
                onClick={saveVisualGuidelines}
                disabled={savingVisualGuidelines}
                style={{
                  padding: "8px 16px",
                  background: savingVisualGuidelines ? "var(--gray-400)" : "var(--primary)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                {savingVisualGuidelines ? "Saving..." : "Save visual guidelines"}
              </button>
            )}
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Content templates ({templates.length})</label>
            {templates.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)", marginBottom: "12px" }}>None yet.</div>
            ) : (
              templates.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "10px 0",
                    borderBottom: "0.5px solid var(--gray-300)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--charcoal)" }}>{t.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: "2px" }}>{t.content}</div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeTemplate(i)}
                      style={{ background: "transparent", border: "none", color: "#c0504d", fontSize: "14px", flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
            {canEdit && (
              <div style={{ marginTop: "12px" }}>
                <input
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="Title (e.g. Event Announcement)"
                  style={{ ...inputStyle, marginBottom: "8px" }}
                />
                <textarea
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  placeholder="Template content..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", marginBottom: "8px" }}
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={addTemplate}
                    style={{
                      padding: "6px 14px",
                      background: "transparent",
                      color: "var(--primary)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                    }}
                  >
                    + Add template
                  </button>
                  <button
                    onClick={saveTemplates}
                    disabled={savingTemplates}
                    style={{
                      padding: "6px 14px",
                      background: savingTemplates ? "var(--gray-400)" : "var(--primary)",
                      color: "var(--white)",
                      border: "none",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {savingTemplates ? "Saving..." : "Save templates"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Recurring content & branding ({recurringContent.length})</label>
            {recurringContent.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)", marginBottom: "12px" }}>None yet.</div>
            ) : (
              recurringContent.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "10px 0",
                    borderBottom: "0.5px solid var(--gray-300)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--charcoal)" }}>{r.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--gray-600)", marginTop: "2px" }}>{r.content}</div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeRecurringContent(i)}
                      style={{ background: "transparent", border: "none", color: "#c0504d", fontSize: "14px", flexShrink: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
            {canEdit && (
              <div style={{ marginTop: "12px" }}>
                <input
                  value={newRecurringTitle}
                  onChange={(e) => setNewRecurringTitle(e.target.value)}
                  placeholder="Title (e.g. Weekly Verse)"
                  style={{ ...inputStyle, marginBottom: "8px" }}
                />
                <textarea
                  value={newRecurringContent}
                  onChange={(e) => setNewRecurringContent(e.target.value)}
                  placeholder="Content..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", marginBottom: "8px" }}
                />
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={addRecurringContent}
                    style={{
                      padding: "6px 14px",
                      background: "transparent",
                      color: "var(--primary)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                    }}
                  >
                    + Add entry
                  </button>
                  <button
                    onClick={saveRecurringContent}
                    disabled={savingRecurringContent}
                    style={{
                      padding: "6px 14px",
                      background: savingRecurringContent ? "var(--gray-400)" : "var(--primary)",
                      color: "var(--white)",
                      border: "none",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {savingRecurringContent ? "Saving..." : "Save recurring content"}
                  </button>
                </div>
              </div>
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
              <label style={labelStyle} htmlFor="profile-sub-ministry-id">Ministry ID (slug)</label>
              <input
                id="profile-sub-ministry-id"
                value={newSubId}
                onChange={(e) => setNewSubId(e.target.value)}
                placeholder="salt-light"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle} htmlFor="profile-sub-ministry-name">Name</label>
              <input
                id="profile-sub-ministry-name"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Salt & Light"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle} htmlFor="profile-sub-ministry-tagline">Tagline (optional)</label>
              <input
                id="profile-sub-ministry-tagline"
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

    </div>
  );
};

export default ProfileEditor;
