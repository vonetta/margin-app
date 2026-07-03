import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import PageHeader from "../components/PageHeader";

const EMAIL_TYPES = [
  { value: "invitation", label: "Invitation", desc: "Invite a prospective speaker/contributor" },
  { value: "confirmation", label: "Confirmation & Logistics", desc: "Confirm acceptance and lay out the details" },
  { value: "reminder", label: "Reminder", desc: "Check in as the event approaches" },
  { value: "thank_you", label: "Thank You", desc: "Post-event appreciation and follow-up" },
];

const typeLabel = (value) => EMAIL_TYPES.find((t) => t.value === value)?.label || value;

const Communications = () => {
  const [tab, setTab] = useState("generate");
  const [emailType, setEmailType] = useState("confirmation");
  const [people, setPeople] = useState([]);
  const [recipientPersonId, setRecipientPersonId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [finalSubject, setFinalSubject] = useState(null);
  const [finalBody, setFinalBody] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    client
      .get("/api/people")
      .then((res) => setPeople(res.data || []))
      .catch(() => setPeople([]));
  }, []);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await client.get("/api/communications/drafts");
      setDrafts(res.data);
      if (res.data.length > 0 && !selectedDraft) {
        setSelectedDraft(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch email drafts");
    } finally {
      setLoadingDrafts(false);
    }
  }, [selectedDraft]);

  useEffect(() => {
    if (tab === "queue") fetchDrafts();
  }, [tab, fetchDrafts]);

  const handlePickPerson = (id) => {
    setRecipientPersonId(id);
    const person = people.find((p) => p._id === id);
    if (person) {
      setRecipientName(person.name);
      setRecipientEmail(person.email || "");
    }
  };

  const resetChat = () => {
    setMessages([]);
    setChatInput("");
    setFinalSubject(null);
    setFinalBody(null);
    setError("");
    setCopied(false);
  };

  const sendTurn = async (nextMessages) => {
    setSending(true);
    setError("");
    try {
      const res = await client.post("/api/communications/chat", {
        type: emailType,
        recipient_name: recipientName,
        messages: nextMessages,
      });
      setMessages(res.data.messages);
      setFinalSubject(res.data.done ? res.data.subject : null);
      setFinalBody(res.data.done ? res.data.body : null);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!chatInput.trim() || sending || !recipientName.trim()) return;
    const nextMessages = [...messages, { role: "user", content: chatInput.trim() }];
    setChatInput("");
    setMessages(nextMessages);
    await sendTurn(nextMessages);
  };

  const handleCopy = () => {
    const text = `Subject: ${finalSubject}\n\n${finalBody}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!finalSubject || !finalBody) return;
    setSaving(true);
    setError("");
    try {
      await client.post("/api/communications/drafts", {
        type: emailType,
        recipient_name: recipientName,
        recipient_email: recipientEmail || undefined,
        recipient_person_id: recipientPersonId || undefined,
        subject: finalSubject,
        body: finalBody,
      });
      resetChat();
      setTab("queue");
      await fetchDrafts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async (id) => {
    try {
      await client.delete(`/api/communications/drafts/${id}`);
      setConfirmDeleteDraft(false);
      if (selectedDraft?._id === id) setSelectedDraft(null);
      await fetchDrafts();
    } catch (err) {
      setError("Failed to delete draft");
    }
  };

  const startEditDraft = () => {
    setEditSubject(selectedDraft.subject);
    setEditBody(selectedDraft.body);
    setEditingDraft(true);
  };

  const cancelEditDraft = () => setEditingDraft(false);

  const handleSaveDraftEdit = async () => {
    if (!editSubject.trim() || !editBody.trim()) {
      setError("Subject and body can't be empty");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      const res = await client.put(`/api/communications/drafts/${selectedDraft._id}`, {
        subject: editSubject.trim(),
        body: editBody.trim(),
      });
      setSelectedDraft(res.data);
      setDrafts((prev) => prev.map((d) => (d._id === res.data._id ? res.data : d)));
      setEditingDraft(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  };

  const mailtoHref = (subject, body, email) =>
    `mailto:${email || ""}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="✉"
        color="var(--gold)"
        title="Communications"
        subtitle="Draft emails to guest speakers and partner ministries"
      />

      <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
        {["generate", "queue"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: "0.5px solid var(--gray-300)",
              background: tab === t ? "var(--navy)" : "transparent",
              color: tab === t ? "var(--white)" : "var(--charcoal)",
              fontSize: "12px",
              fontWeight: "500",
              letterSpacing: "0.02em",
              cursor: "pointer",
            }}
          >
            {t === "generate" ? "Generate" : "Draft queue"}
          </button>
        ))}
      </div>

      {tab === "generate" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div
            style={{
              background: "var(--white)",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              minHeight: "480px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  fontFamily: "Cinzel, serif",
                  fontSize: "10px",
                  fontWeight: "500",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--navy)",
                  opacity: 0.7,
                }}
              >
                New Email
              </div>
              {messages.length > 0 && (
                <button
                  onClick={resetChat}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    color: "var(--gray-500)",
                    cursor: "pointer",
                  }}
                >
                  Start over
                </button>
              )}
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--gray-600)",
                }}
              >
                Email type
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {EMAIL_TYPES.map((t) => (
                  <button
                    key={t.value}
                    disabled={messages.length > 0}
                    onClick={() => setEmailType(t.value)}
                    title={t.desc}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--border-radius)",
                      border: `1.5px solid ${emailType === t.value ? "var(--navy)" : "var(--gray-300)"}`,
                      background: emailType === t.value ? "#f4f8fb" : "transparent",
                      color: "var(--charcoal)",
                      fontSize: "11px",
                      fontWeight: "500",
                      cursor: messages.length > 0 ? "default" : "pointer",
                      opacity: messages.length > 0 && emailType !== t.value ? 0.4 : 1,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "10px",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--gray-600)",
                }}
              >
                Recipient
              </label>
              {people.length > 0 && (
                <select
                  value={recipientPersonId}
                  disabled={messages.length > 0}
                  onChange={(e) => handlePickPerson(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "13px",
                    marginBottom: "8px",
                  }}
                >
                  <option value="">Type a name manually below, or pick from the roster...</option>
                  {people.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                      {p.title ? ` — ${p.title}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Recipient name"
                  value={recipientName}
                  disabled={messages.length > 0}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    setRecipientPersonId("");
                  }}
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
                  placeholder="Email (optional)"
                  value={recipientEmail}
                  disabled={messages.length > 0}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "13px",
                  }}
                />
              </div>
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
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                flex: 1,
                overflow: "auto",
                minHeight: "120px",
                padding: "4px",
              }}
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: m.role === "user" ? "var(--navy)" : "var(--gray-100)",
                    color: m.role === "user" ? "var(--white)" : "var(--charcoal)",
                    borderRadius: "var(--border-radius)",
                    padding: "10px 12px",
                    fontSize: "12px",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  recipientName.trim()
                    ? "Friday June 12, 7pm, 27754 Church St Castaic CA, 40 minutes of ministry, $850 honorarium..."
                    : "Enter a recipient name above first..."
                }
                rows={2}
                disabled={!recipientName.trim()}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: "1.6",
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !chatInput.trim() || !recipientName.trim()}
                style={{
                  padding: "8px 16px",
                  background: "var(--navy)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                  letterSpacing: "0.04em",
                  alignSelf: "flex-end",
                  cursor: "pointer",
                  opacity: sending || !chatInput.trim() || !recipientName.trim() ? 0.5 : 1,
                }}
              >
                {sending ? "..." : messages.length === 0 ? "✦ Start" : "Send"}
              </button>
            </div>
          </div>

          <div
            style={{
              background: "var(--white)",
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "10px",
                fontWeight: "500",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--navy)",
                opacity: 0.7,
              }}
            >
              Preview
            </div>

            {!finalSubject && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--gray-400)",
                  fontSize: "12px",
                  minHeight: "160px",
                  textAlign: "center",
                  padding: "0 20px",
                }}
              >
                The finished email will appear here once the conversation has everything it needs
              </div>
            )}

            {finalSubject && (
              <>
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--gray-500)",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Subject
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--navy)",
                    }}
                  >
                    {finalSubject}
                  </div>
                </div>
                <div
                  style={{
                    background: "var(--gray-100)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    padding: "14px",
                    fontSize: "12px",
                    lineHeight: "1.8",
                    color: "var(--charcoal)",
                    whiteSpace: "pre-wrap",
                    flex: 1,
                  }}
                >
                  {finalBody}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
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
                    {saving ? "Saving..." : "✓ Save to drafts"}
                  </button>
                  <button
                    onClick={handleCopy}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      color: "var(--navy)",
                      border: "0.5px solid var(--navy)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                    }}
                  >
                    {copied ? "Copied!" : "Copy text"}
                  </button>
                  <a
                    href={mailtoHref(finalSubject, finalBody, recipientEmail)}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      color: "var(--gray-600)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                      textDecoration: "none",
                    }}
                  >
                    Open in email client
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "queue" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {loadingDrafts ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)", padding: "20px 0" }}>
                Loading drafts...
              </div>
            ) : drafts.length === 0 ? (
              <div
                style={{
                  background: "var(--white)",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius-lg)",
                  padding: "32px",
                  textAlign: "center",
                  fontSize: "12px",
                  color: "var(--gray-500)",
                }}
              >
                No email drafts yet. Generate one to get started.
              </div>
            ) : (
              drafts.map((draft) => {
                const isSelected = selectedDraft?._id === draft._id;
                return (
                  <div
                    key={draft._id}
                    onClick={() => {
                      setSelectedDraft(draft);
                      setConfirmDeleteDraft(false);
                      setEditingDraft(false);
                    }}
                    style={{
                      border: `0.5px solid ${isSelected ? "var(--navy)" : "var(--gray-300)"}`,
                      borderRadius: "var(--border-radius-lg)",
                      padding: "14px",
                      cursor: "pointer",
                      background: isSelected ? "#f4f8fb" : "var(--white)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <div style={{ fontFamily: "Cinzel, serif", fontSize: "12px", color: "var(--navy)" }}>
                        {typeLabel(draft.type)}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--gray-400)" }}>
                        {new Date(draft.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--charcoal)", fontWeight: "600" }}>
                      {draft.recipient_name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--gray-600)",
                        marginTop: "4px",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {draft.subject}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedDraft && (
            <div
              style={{
                background: "var(--white)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius-lg)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                alignSelf: "start",
                position: "sticky",
                top: "0",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                <span style={{ color: "var(--gold-dark)", fontWeight: "500" }}>
                  {typeLabel(selectedDraft.type)}
                </span>
                {" → "}
                {selectedDraft.recipient_name}
              </div>
              {editingDraft ? (
                <>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--navy)",
                    }}
                  />
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={12}
                    style={{
                      background: "var(--gray-100)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      padding: "14px",
                      fontSize: "12px",
                      lineHeight: "1.8",
                      color: "var(--charcoal)",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleSaveDraftEdit}
                      disabled={editSaving}
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
                      {editSaving ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      onClick={cancelEditDraft}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        color: "var(--gray-600)",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--navy)" }}>
                    {selectedDraft.subject}
                  </div>
                  <div
                    style={{
                      background: "var(--gray-100)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      padding: "14px",
                      fontSize: "12px",
                      lineHeight: "1.8",
                      color: "var(--charcoal)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {selectedDraft.body}
                  </div>
                </>
              )}
              {!editingDraft && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <a
                  href={mailtoHref(selectedDraft.subject, selectedDraft.body, selectedDraft.recipient_email)}
                  style={{
                    padding: "8px 16px",
                    background: "var(--navy)",
                    color: "var(--white)",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    fontWeight: "500",
                    textDecoration: "none",
                  }}
                >
                  Open in email client
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Subject: ${selectedDraft.subject}\n\n${selectedDraft.body}`);
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: "var(--navy)",
                    border: "0.5px solid var(--navy)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Copy text
                </button>
                <button
                  onClick={startEditDraft}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: "var(--navy)",
                    border: "0.5px solid var(--navy)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                {confirmDeleteDraft ? (
                  <>
                    <button
                      onClick={() => handleDeleteDraft(selectedDraft._id)}
                      style={{
                        padding: "8px 16px",
                        background: "#c0504d",
                        color: "var(--white)",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Confirm delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteDraft(false)}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        color: "var(--gray-600)",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteDraft(true)}
                    style={{
                      padding: "8px 16px",
                      background: "#fdf0f0",
                      color: "#c0504d",
                      border: "0.5px solid #e8b4b4",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✕ Delete
                  </button>
                )}
              </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Communications;
