import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { useUndoableDelete } from "../hooks/useUndoableDelete";
import UndoToastStack from "../components/UndoToastStack";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

const smallButtonStyle = {
  padding: "5px 10px",
  background: "transparent",
  color: "#c0504d",
  border: "0.5px solid #e8b4b4",
  borderRadius: "var(--border-radius)",
  fontSize: "11px",
  cursor: "pointer",
};

const addButtonStyle = {
  padding: "6px 14px",
  background: "transparent",
  color: "var(--primary)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius)",
  fontSize: "12px",
  cursor: "pointer",
};

const toDateInputValue = (dateStr) => (dateStr ? new Date(dateStr).toISOString().slice(0, 10) : "");

const Newsletter = () => {
  const { user, ministryId } = useAuth();
  const membership = user?.ministries?.find((m) => m.ministry_id === ministryId);
  const canEdit = membership && ["admin", "leader"].includes(membership.role);

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loadingIssue, setLoadingIssue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newTheme, setNewTheme] = useState("");
  const [creating, setCreating] = useState(false);

  const { pending: pendingDeletes, scheduleDelete, undo: undoDelete, isPending: isPendingDelete } =
    useUndoableDelete();

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  };

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/newsletter/issues");
      setIssues(res.data);
    } catch (err) {
      setError("Failed to load newsletter issues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const selectIssue = async (id) => {
    setSelectedIssue(null);
    setLoadingIssue(true);
    setError("");
    try {
      const res = await client.get(`/api/newsletter/issues/${id}`);
      setSelectedIssue(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load newsletter issue");
    } finally {
      setLoadingIssue(false);
    }
  };

  const createIssue = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await client.post("/api/newsletter/issues", {
        month: Number(newMonth),
        year: Number(newYear),
        theme: newTheme.trim() || undefined,
      });
      setShowNewForm(false);
      setNewTheme("");
      await fetchIssues();
      setSelectedIssue(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create newsletter issue");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteIssue = (issue) => {
    if (selectedIssue?._id === issue._id) setSelectedIssue(null);
    const label = `${MONTH_NAMES[issue.month - 1]} ${issue.year}`;
    scheduleDelete(issue._id, label, async () => {
      try {
        await client.delete(`/api/newsletter/issues/${issue._id}`);
        await fetchIssues();
      } catch (err) {
        setError("Failed to delete newsletter issue");
      }
    });
  };

  const updateSection = (index, updater) => {
    setSelectedIssue((prev) => {
      const sections = prev.sections.map((s, i) => (i === index ? updater(s) : s));
      return { ...prev, sections };
    });
  };

  const toggleSection = (index) => {
    updateSection(index, (s) => ({ ...s, enabled: !s.enabled }));
  };

  const setSectionField = (index, field, value) => {
    updateSection(index, (s) => ({ ...s, content: { ...s.content, [field]: value } }));
  };

  const addArrayItem = (index, field, blankItem) => {
    updateSection(index, (s) => ({
      ...s,
      content: { ...s.content, [field]: [...(s.content[field] || []), blankItem] },
    }));
  };

  const updateArrayItem = (index, field, itemIndex, newItem) => {
    updateSection(index, (s) => ({
      ...s,
      content: {
        ...s.content,
        [field]: (s.content[field] || []).map((item, i) => (i === itemIndex ? newItem : item)),
      },
    }));
  };

  const removeArrayItem = (index, field, itemIndex) => {
    updateSection(index, (s) => ({
      ...s,
      content: { ...s.content, [field]: (s.content[field] || []).filter((_, i) => i !== itemIndex) },
    }));
  };

  const saveIssue = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await client.put(`/api/newsletter/issues/${selectedIssue._id}`, {
        theme: selectedIssue.theme,
        status: selectedIssue.status,
        sections: selectedIssue.sections,
      });
      setSelectedIssue(res.data);
      flash("Newsletter saved");
      await fetchIssues();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save newsletter issue");
    } finally {
      setSaving(false);
    }
  };

  const exportIssue = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await client.get(`/api/newsletter/issues/${selectedIssue._id}/export`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `newsletter-${selectedIssue.year}-${String(selectedIssue.month).padStart(2, "0")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export newsletter");
    } finally {
      setExporting(false);
    }
  };

  const renderSectionEditor = (section, index) => {
    switch (section.type) {
      case "text_block":
        return (
          <>
            <textarea
              value={section.content.body || ""}
              onChange={(e) => setSectionField(index, "body", e.target.value)}
              disabled={!canEdit}
              rows={4}
              placeholder="Write this section's content..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, marginBottom: "8px" }}
            />
            <input
              value={section.content.photo_url || ""}
              onChange={(e) => setSectionField(index, "photo_url", e.target.value)}
              disabled={!canEdit}
              placeholder="Photo URL (optional)"
              style={inputStyle}
            />
          </>
        );

      case "list_block": {
        const items = section.content.items || [];
        return (
          <>
            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  value={item.heading || ""}
                  onChange={(e) => updateArrayItem(index, "items", i, { ...item, heading: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Heading"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  value={item.body || ""}
                  onChange={(e) => updateArrayItem(index, "items", i, { ...item, body: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Detail (optional)"
                  style={{ ...inputStyle, flex: 2 }}
                />
                {canEdit && (
                  <button onClick={() => removeArrayItem(index, "items", i)} style={smallButtonStyle}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button onClick={() => addArrayItem(index, "items", { heading: "", body: "" })} style={addButtonStyle}>
                + Add item
              </button>
            )}
          </>
        );
      }

      case "birthdays": {
        const entries = section.content.entries || [];
        return (
          <>
            {entries.map((entry, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  value={entry.name || ""}
                  onChange={(e) => updateArrayItem(index, "entries", i, { ...entry, name: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Name"
                  style={{ ...inputStyle, flex: 2 }}
                />
                <input
                  type="date"
                  value={toDateInputValue(entry.date)}
                  onChange={(e) => updateArrayItem(index, "entries", i, { ...entry, date: e.target.value })}
                  disabled={!canEdit}
                  style={{ ...inputStyle, flex: 1 }}
                />
                {canEdit && (
                  <button onClick={() => removeArrayItem(index, "entries", i)} style={smallButtonStyle}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button onClick={() => addArrayItem(index, "entries", { name: "", date: "" })} style={addButtonStyle}>
                + Add birthday
              </button>
            )}
          </>
        );
      }

      case "calendar": {
        const entries = section.content.entries || [];
        return (
          <>
            {entries.map((entry, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <input
                  value={entry.title || ""}
                  onChange={(e) => updateArrayItem(index, "entries", i, { ...entry, title: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Event title"
                  style={{ ...inputStyle, flex: 2, minWidth: "140px" }}
                />
                <input
                  type="date"
                  value={toDateInputValue(entry.date)}
                  onChange={(e) => updateArrayItem(index, "entries", i, { ...entry, date: e.target.value, recurring_note: "" })}
                  disabled={!canEdit}
                  style={{ ...inputStyle, flex: 1, minWidth: "120px" }}
                />
                <input
                  value={entry.recurring_note || ""}
                  onChange={(e) => updateArrayItem(index, "entries", i, { ...entry, recurring_note: e.target.value, date: null })}
                  disabled={!canEdit}
                  placeholder="or: Weekly / Monthly"
                  style={{ ...inputStyle, flex: 1, minWidth: "120px" }}
                />
                <input
                  value={entry.location || ""}
                  onChange={(e) => updateArrayItem(index, "entries", i, { ...entry, location: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Location (optional)"
                  style={{ ...inputStyle, flex: 1, minWidth: "120px" }}
                />
                {canEdit && (
                  <button onClick={() => removeArrayItem(index, "entries", i)} style={smallButtonStyle}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button
                onClick={() => addArrayItem(index, "entries", { title: "", date: "", recurring_note: "", location: "" })}
                style={addButtonStyle}
              >
                + Add event
              </button>
            )}
          </>
        );
      }

      case "spotlight": {
        const qa = section.content.qa || [];
        return (
          <>
            <input
              value={section.content.person_name || ""}
              onChange={(e) => setSectionField(index, "person_name", e.target.value)}
              disabled={!canEdit}
              placeholder="Person's name"
              style={{ ...inputStyle, marginBottom: "8px" }}
            />
            <input
              value={section.content.photo_url || ""}
              onChange={(e) => setSectionField(index, "photo_url", e.target.value)}
              disabled={!canEdit}
              placeholder="Photo URL (optional)"
              style={{ ...inputStyle, marginBottom: "8px" }}
            />
            <textarea
              value={section.content.bio || ""}
              onChange={(e) => setSectionField(index, "bio", e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="A few sentences about them..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, marginBottom: "8px" }}
            />
            {qa.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  value={item.question || ""}
                  onChange={(e) => updateArrayItem(index, "qa", i, { ...item, question: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Question (e.g. Favorite scripture)"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  value={item.answer || ""}
                  onChange={(e) => updateArrayItem(index, "qa", i, { ...item, answer: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Answer"
                  style={{ ...inputStyle, flex: 2 }}
                />
                {canEdit && (
                  <button onClick={() => removeArrayItem(index, "qa", i)} style={smallButtonStyle}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button onClick={() => addArrayItem(index, "qa", { question: "", answer: "" })} style={addButtonStyle}>
                + Add question
              </button>
            )}
          </>
        );
      }

      case "give_cta":
        return (
          <>
            <textarea
              value={section.content.body || ""}
              onChange={(e) => setSectionField(index, "body", e.target.value)}
              disabled={!canEdit}
              rows={2}
              placeholder="A short give/partner blurb..."
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, marginBottom: "8px" }}
            />
            <input
              value={section.content.give_url || ""}
              onChange={(e) => setSectionField(index, "give_url", e.target.value)}
              disabled={!canEdit}
              placeholder="Give/donate link (a QR code is generated from this)"
              style={inputStyle}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="✉"
        color="var(--gold)"
        title="Newsletter"
        subtitle="Assemble your monthly issue, then export it to paste into Mailchimp — Margin doesn't send it"
        action={
          canEdit && (
            <button
              onClick={() => setShowNewForm((s) => !s)}
              style={{
                padding: "8px 16px",
                background: "var(--navy)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              {showNewForm ? "Cancel" : "+ New issue"}
            </button>
          )
        }
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
          Only admins and leaders can view and assemble the newsletter.
        </div>
      )}

      {canEdit && (
        <>
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

          {showNewForm && (
            <div style={cardStyle}>
              <label style={labelStyle}>New issue</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <select
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <input
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                placeholder="Theme (optional, e.g. Kingdom Strength)"
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <button
                onClick={createIssue}
                disabled={creating}
                style={{
                  padding: "8px 16px",
                  background: creating ? "var(--gray-400)" : "var(--navy)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                }}
              >
                {creating ? "Creating..." : "Create issue"}
              </button>
            </div>
          )}

          <div style={cardStyle}>
            <label style={labelStyle}>Issues ({issues.length})</label>
            {loading ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading...</div>
            ) : issues.filter((i) => !isPendingDelete(i._id)).length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                No issues yet. Create your first one above.
              </div>
            ) : (
              issues
                .filter((issue) => !isPendingDelete(issue._id))
                .map((issue, i, arr) => (
                  <div
                    key={issue._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      cursor: "pointer",
                      background: selectedIssue?._id === issue._id ? "var(--gray-100)" : "transparent",
                      borderBottom: i < arr.length - 1 ? "0.5px solid var(--gray-300)" : "none",
                    }}
                  >
                    <div onClick={() => selectIssue(issue._id)} style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--charcoal)" }}>
                        {MONTH_NAMES[issue.month - 1]} {issue.year}
                        {issue.theme && (
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--gold-dark)" }}>
                            {issue.theme}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>{issue.status}</div>
                    </div>
                    <button onClick={() => handleDeleteIssue(issue)} style={smallButtonStyle}>
                      ✕
                    </button>
                  </div>
                ))
            )}
          </div>

          {loadingIssue && (
            <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>Loading issue...</div>
          )}

          {selectedIssue && (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "14px", color: "var(--navy)" }}>
                  {MONTH_NAMES[selectedIssue.month - 1]} {selectedIssue.year}
                </div>
                <select
                  value={selectedIssue.status}
                  onChange={(e) => setSelectedIssue((prev) => ({ ...prev, status: e.target.value }))}
                  style={{ ...inputStyle, width: "auto" }}
                >
                  <option value="draft">Draft</option>
                  <option value="finalized">Finalized</option>
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle} htmlFor="newsletter-theme">Theme</label>
                <input
                  id="newsletter-theme"
                  value={selectedIssue.theme || ""}
                  onChange={(e) => setSelectedIssue((prev) => ({ ...prev, theme: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              {selectedIssue.sections
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((section) => {
                  const index = selectedIssue.sections.findIndex((s) => s.key === section.key);
                  return (
                    <div
                      key={section.key}
                      style={{
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        padding: "14px",
                        marginBottom: "12px",
                        opacity: section.enabled ? 1 : 0.5,
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "10px",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "var(--charcoal)",
                        }}
                      >
                        <input type="checkbox" checked={section.enabled} onChange={() => toggleSection(index)} />
                        {section.title}
                      </label>
                      {section.enabled && renderSectionEditor(section, index)}
                    </div>
                  );
                })}

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={saveIssue}
                  disabled={saving}
                  style={{
                    padding: "8px 16px",
                    background: saving ? "var(--gray-400)" : "var(--navy)",
                    color: "var(--white)",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={exportIssue}
                  disabled={exporting}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: "var(--navy)",
                    border: "0.5px solid var(--navy)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  {exporting ? "Exporting..." : "Export PDF"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <UndoToastStack pending={pendingDeletes} onUndo={undoDelete} />
    </div>
  );
};

export default Newsletter;
