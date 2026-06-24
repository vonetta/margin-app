import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";

const PLATFORMS = ["Instagram", "Facebook", "Email", "Quote card"];

const statusColors = {
  pending: { bg: "#fff8ec", color: "#b8902e", border: "#f0d080" },
  approved: { bg: "#edf7f2", color: "#2a7a52", border: "#a0d4bc" },
  rejected: { bg: "#fdf0f0", color: "#c0504d", border: "#e8b4b4" },
};

const ContentStudio = () => {
  const [tab, setTab] = useState("generate");
  const [platform, setPlatform] = useState("Instagram");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [finalCaption, setFinalCaption] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [error, setError] = useState("");

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await client.get("/api/content/drafts");
      setDrafts(res.data);
      if (res.data.length > 0 && !selectedDraft) {
        setSelectedDraft(res.data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch drafts");
    } finally {
      setLoadingDrafts(false);
    }
  }, [selectedDraft]);

  useEffect(() => {
    if (tab === "queue") fetchDrafts();
  }, [tab, fetchDrafts]);

  const sendTurn = async (nextMessages) => {
    setSending(true);
    setError("");
    try {
      const res = await client.post("/api/content/chat", {
        platform,
        messages: nextMessages,
      });
      setMessages(res.data.messages);
      setFinalCaption(res.data.done ? res.data.caption : null);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!chatInput.trim() || sending) return;
    const nextMessages = [
      ...messages,
      { role: "user", content: chatInput.trim() },
    ];
    setChatInput("");
    setMessages(nextMessages);
    await sendTurn(nextMessages);
  };

  const resetChat = () => {
    setMessages([]);
    setChatInput("");
    setFinalCaption(null);
    setError("");
  };

  const sendToQueue = async () => {
    if (!finalCaption) return;
    try {
      const firstUserMessage =
        messages.find((m) => m.role === "user")?.content || "";
      await client.post("/api/content/drafts", {
        platform,
        caption: finalCaption,
        prompt: firstUserMessage,
      });
      resetChat();
      setTab("queue");
      await fetchDrafts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save draft");
    }
  };

  const handleApprove = async (draftId) => {
    try {
      await client.put(`/api/content/drafts/${draftId}/approve`);
      await fetchDrafts();
      setSelectedDraft(drafts.find((d) => d._id === draftId) || null);
    } catch (err) {
      console.error("Failed to approve");
    }
  };

  const handleReject = async (draftId) => {
    try {
      if (feedback.trim()) {
        await client.put(`/api/content/drafts/${draftId}/feedback`, {
          feedback,
        });
      } else {
        await client.put(`/api/content/drafts/${draftId}/reject`);
      }
      setFeedback("");
      await fetchDrafts();
    } catch (err) {
      console.error("Failed to reject");
    }
  };

  const pendingCount = drafts.filter((d) => d.status === "pending").length;

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "20px",
            fontWeight: "500",
            color: "var(--navy)",
            letterSpacing: "0.04em",
            marginBottom: "4px",
          }}
        >
          Content Studio
        </h2>
        <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
          Generate, review, and publish ministry content
        </p>
      </div>

      <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
        {[
          { key: "generate", label: "Generate" },
          {
            key: "queue",
            label: `Draft queue${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
          },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: "0.5px solid",
              borderColor: tab === t.key ? "var(--navy)" : "var(--gray-300)",
              background: tab === t.key ? "var(--navy)" : "transparent",
              color: tab === t.key ? "var(--white)" : "var(--gray-600)",
              fontSize: "12px",
              fontWeight: "500",
              letterSpacing: "0.02em",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generate" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div
            style={{
              border: "0.5px solid var(--gray-300)",
              borderRadius: "var(--border-radius-lg)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "var(--white)",
              minHeight: "480px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
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
                New Content
              </div>
              {messages.length > 0 && (
                <button
                  onClick={resetChat}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    color: "var(--gray-500)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
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
                  color: "var(--gray-600)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Platform
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={messages.length > 0}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                  color: "var(--charcoal)",
                  background: messages.length > 0 ? "var(--gray-100)" : "var(--white)",
                  outline: "none",
                }}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                overflow: "auto",
                minHeight: "200px",
                padding: messages.length > 0 ? "4px" : 0,
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--gray-500)",
                    lineHeight: 1.6,
                  }}
                >
                  Describe the event or content below — Apostle Khy's
                  assistant will ask if anything's missing (which entity,
                  audience, cost, registration link) before writing the
                  final piece.
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      background:
                        m.role === "user" ? "var(--navy)" : "var(--gray-100)",
                      color: m.role === "user" ? "var(--white)" : "var(--charcoal)",
                      borderRadius: "var(--border-radius)",
                      padding: "10px 12px",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                ))
              )}
              {sending && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    fontSize: "12px",
                    color: "var(--gray-500)",
                    padding: "10px 12px",
                  }}
                >
                  Apostle Khy's assistant is thinking...
                </div>
              )}
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
                rows={2}
                placeholder={
                  messages.length === 0
                    ? "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided..."
                    : "Reply..."
                }
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                  color: "var(--charcoal)",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.6,
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !chatInput.trim()}
                style={{
                  padding: "8px 16px",
                  background:
                    sending || !chatInput.trim()
                      ? "var(--gray-400)"
                      : "var(--navy)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                  letterSpacing: "0.04em",
                  alignSelf: "flex-end",
                }}
              >
                {messages.length === 0 ? "✦ Start" : "Send"}
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

            {error && (
              <div
                style={{
                  background: "#fdf0f0",
                  border: "0.5px solid #e8b4b4",
                  borderRadius: "var(--border-radius)",
                  padding: "12px",
                  fontSize: "12px",
                  color: "#c0504d",
                }}
              >
                {error}
              </div>
            )}

            {!finalCaption && (
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
                The final caption will appear here once the conversation has
                everything it needs
              </div>
            )}

            {finalCaption && (
              <>
                <div
                  style={{
                    background: "var(--gray-100)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    padding: "14px",
                    fontSize: "12px",
                    lineHeight: 1.8,
                    color: "var(--charcoal)",
                    whiteSpace: "pre-wrap",
                    flex: 1,
                  }}
                >
                  {finalCaption}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={sendToQueue}
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
                    ✓ Send to queue
                  </button>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: "11px",
                      color: "var(--gray-500)",
                    }}
                  >
                    Or keep chatting on the left to refine it
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "queue" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {loadingDrafts ? (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--gray-500)",
                  padding: "20px 0",
                }}
              >
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
                No drafts yet. Generate content to get started.
              </div>
            ) : (
              drafts.map((draft) => {
                const isSelected = selectedDraft?._id === draft._id;
                const s = statusColors[draft.status];
                return (
                  <div
                    key={draft._id}
                    onClick={() => {
                      setSelectedDraft(draft);
                      setFeedback("");
                    }}
                    style={{
                      border: `0.5px solid ${isSelected ? "var(--navy)" : "var(--gray-300)"}`,
                      borderRadius: "var(--border-radius-lg)",
                      padding: "14px",
                      display: "flex",
                      gap: "12px",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                      background: isSelected ? "#f4f8fb" : "var(--white)",
                    }}
                  >
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "6px",
                        background: "var(--gray-200)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--gray-500)",
                        flexShrink: 0,
                        fontSize: "18px",
                      }}
                    >
                      ◈
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "Cinzel, serif",
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "var(--navy)",
                          }}
                        >
                          {draft.platform}
                        </div>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "500",
                            background: s.bg,
                            color: s.color,
                            border: `0.5px solid ${s.border}`,
                          }}
                        >
                          {draft.status.charAt(0).toUpperCase() +
                            draft.status.slice(1)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--gray-600)",
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {draft.caption}
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--gray-400)",
                          marginTop: "6px",
                        }}
                      >
                        {new Date(draft.created_at).toLocaleDateString()}
                      </div>
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
                gap: "16px",
                alignSelf: "start",
                position: "sticky",
                top: "0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--gray-600)",
                }}
              >
                <span style={{ color: "var(--gold-dark)", fontWeight: "500" }}>
                  {selectedDraft.platform}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "500",
                    background: statusColors[selectedDraft.status].bg,
                    color: statusColors[selectedDraft.status].color,
                    border: `0.5px solid ${statusColors[selectedDraft.status].border}`,
                  }}
                >
                  {selectedDraft.status.charAt(0).toUpperCase() +
                    selectedDraft.status.slice(1)}
                </span>
              </div>

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
                  Caption
                </div>
                <div
                  style={{
                    background: "var(--gray-100)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    padding: "14px",
                    fontSize: "12px",
                    lineHeight: 1.8,
                    color: "var(--charcoal)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedDraft.caption}
                </div>
              </div>

              {selectedDraft.status === "pending" && (
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
                      Feedback for profile (optional)
                    </div>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      placeholder="Note what felt off — this will update the AI profile for future generations."
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                        resize: "vertical",
                        outline: "none",
                        lineHeight: 1.6,
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleApprove(selectedDraft._id)}
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
                      ✓ Approve & queue
                    </button>
                    <button
                      onClick={() => handleReject(selectedDraft._id)}
                      style={{
                        padding: "8px 16px",
                        background: "#fdf0f0",
                        color: "#c0504d",
                        border: "0.5px solid #e8b4b4",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentStudio;
