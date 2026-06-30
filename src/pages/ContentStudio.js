import React, { useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import FlyerStyleWizard from "../components/FlyerStyleWizard";

const PLATFORMS = ["Instagram", "Facebook", "Email", "Quote card"];

const statusColors = {
  pending: { bg: "#fff8ec", color: "#b8902e", border: "#f0d080" },
  approved: { bg: "#edf7f2", color: "#2a7a52", border: "#a0d4bc" },
  rejected: { bg: "#fdf0f0", color: "#c0504d", border: "#e8b4b4" },
};

const ContentStudio = () => {
  const { switchMinistry, ministry } = useAuth();
  const [tab, setTab] = useState("generate");
  const [platform, setPlatform] = useState("Instagram");
  const [chatInput, setChatInput] = useState("");
  const [switchNotice, setSwitchNotice] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [finalCaption, setFinalCaption] = useState(null);
  const [finalEvent, setFinalEvent] = useState(null);
  const [finalStyle, setFinalStyle] = useState(null);
  const [showStyleWizard, setShowStyleWizard] = useState(false);
  const [flyerUrl, setFlyerUrl] = useState(null);
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [error, setError] = useState("");
  const [typeSystemFonts, setTypeSystemFonts] = useState([]);
  const [people, setPeople] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [hostId, setHostId] = useState("");
  const [speakerIds, setSpeakerIds] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState("auto");

  useEffect(() => {
    client
      .get("/api/profile")
      .then((res) => setTypeSystemFonts(res.data?.type_system?.fonts || []))
      .catch(() => setTypeSystemFonts([]));
    client
      .get("/api/people")
      .then((res) => setPeople(res.data || []))
      .catch(() => setPeople([]));
    client
      .get("/api/flyers/layouts")
      .then((res) => setLayouts(res.data || []))
      .catch(() => setLayouts([]));
  }, []);

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
      let res = await client.post("/api/content/chat", {
        platform,
        messages: nextMessages,
      });
      let displayMessages = res.data.messages;

      if (res.data.switchTo) {
        setMessages(displayMessages);
        setSwitchNotice(res.data.switchTo.note);
        await switchMinistry(res.data.switchTo.ministry_id);
        // Resend the pre-switch history — it still ends on the user's last
        // message, as Anthropic requires for a fresh turn — so the new
        // ministry's own voice/branding generates the real next response.
        // displayMessages ends on the assistant's switch note instead,
        // which the API would reject as the start of a new turn.
        res = await client.post("/api/content/chat", {
          platform,
          messages: nextMessages,
        });
        // Keep the switch note visible by appending the new turn after it,
        // rather than overwriting it with res.data.messages wholesale.
        displayMessages = [
          ...displayMessages,
          res.data.messages[res.data.messages.length - 1],
        ];
      }

      setMessages(displayMessages);
      setFinalCaption(res.data.done ? res.data.caption : null);
      setFinalEvent(res.data.done ? res.data.event || null : null);
      setFinalStyle(res.data.done ? res.data.style || null : null);
      setFlyerUrl(null);
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
    setFinalEvent(null);
    setFinalStyle(null);
    setShowStyleWizard(false);
    setFlyerUrl(null);
    setSwitchNotice(null);
    setError("");
    setHostId("");
    setSpeakerIds([]);
    setSelectedLayout("auto");
  };

  const describeUploadedFlyer = (details) => {
    const lines = [
      "I already have a flyer made for this. Here's what's on it:",
    ];
    if (details.title) lines.push(`Title: ${details.title}`);
    if (details.subtitle) lines.push(`Subtitle: ${details.subtitle}`);
    if (details.date) lines.push(`Date: ${details.date}`);
    if (details.location) lines.push(`Location: ${details.location}`);
    if (details.cost) lines.push(`Cost: ${details.cost}`);
    if (details.cta) lines.push(`CTA: ${details.cta}`);
    if (details.registration_url)
      lines.push(`Registration: ${details.registration_url}`);
    if (details.other_details) lines.push(`Other: ${details.other_details}`);
    lines.push(
      "Just write a caption for it — no need to generate a new flyer image.",
    );
    return lines.join("\n");
  };

  const handleUploadFlyer = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingFlyer(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("flyer", file);
      const res = await client.post("/api/content/extract-flyer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setChatInput(describeUploadedFlyer(res.data));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to read the flyer");
    } finally {
      setUploadingFlyer(false);
    }
  };

  const openStyleWizard = () => {
    // The AI always returns a style object alongside a finalized event, so
    // this should never actually be missing — falling straight through to
    // generation with server defaults rather than silently doing nothing
    // is just a defensive fallback.
    if (finalStyle) {
      setShowStyleWizard(true);
    } else {
      handleGenerateFlyer();
    }
  };

  const handleGenerateFlyer = async (style, backgroundUrl) => {
    if (!finalEvent?.title) return;
    setShowStyleWizard(false);
    setGeneratingFlyer(true);
    setError("");
    try {
      const res = await client.post("/api/flyers/generate", {
        title: finalEvent.title,
        subtitle: finalEvent.subtitle,
        description: finalEvent.description,
        theme_tags: finalEvent.theme_tags,
        highlights: finalEvent.highlights,
        audience: finalEvent.audience,
        date: finalEvent.date,
        location: finalEvent.location,
        cost: finalEvent.cost,
        cta: finalEvent.cta,
        qr_url: finalEvent.registration_url,
        style: style || finalStyle || undefined,
        background_url: backgroundUrl || undefined,
        platform,
        host_id: hostId || undefined,
        speaker_ids: speakerIds,
        layout: selectedLayout === "auto" ? undefined : selectedLayout,
      });
      setFlyerUrl(res.data.social_url);
      if (style) setFinalStyle(style);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate flyer");
    } finally {
      setGeneratingFlyer(false);
    }
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
        image_url: flyerUrl || undefined,
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
              {messages.length > 0 ? (
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
              ) : (
                <label
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    color: "var(--gray-500)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  {uploadingFlyer ? "Reading flyer..." : "Already made a flyer?"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUploadFlyer}
                    disabled={uploadingFlyer}
                    style={{ display: "none" }}
                  />
                </label>
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

            {switchNotice && (
              <div
                style={{
                  background: "#fff8ec",
                  border: "0.5px solid #f0d080",
                  borderRadius: "var(--border-radius)",
                  padding: "8px 12px",
                  fontSize: "11px",
                  color: "#b8902e",
                }}
              >
                ↻ {switchNotice}
              </div>
            )}

            <div
              style={
                messages.length > 0
                  ? {
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      overflow: "auto",
                      minHeight: "200px",
                      padding: "4px",
                    }
                  : { display: "flex", flexDirection: "column", gap: "8px" }
              }
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
                {flyerUrl && (
                  <img
                    src={flyerUrl}
                    alt="Generated flyer"
                    style={{
                      width: "100%",
                      borderRadius: "var(--border-radius)",
                      border: "0.5px solid var(--gray-300)",
                    }}
                  />
                )}
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
                    flex: flyerUrl ? "none" : 1,
                  }}
                >
                  {finalCaption}
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                  {finalEvent?.title && !flyerUrl && (
                    <button
                      onClick={openStyleWizard}
                      disabled={generatingFlyer}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        color: generatingFlyer ? "var(--gray-400)" : "var(--navy)",
                        border: `0.5px solid ${generatingFlyer ? "var(--gray-300)" : "var(--navy)"}`,
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                        fontWeight: "500",
                        cursor: generatingFlyer ? "default" : "pointer",
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (generatingFlyer) return;
                        e.currentTarget.style.background = "var(--navy)";
                        e.currentTarget.style.color = "var(--white)";
                      }}
                      onMouseLeave={(e) => {
                        if (generatingFlyer) return;
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--navy)";
                      }}
                    >
                      {generatingFlyer
                        ? "Generating flyer..."
                        : "▣ Generate matching flyer"}
                    </button>
                  )}
                  {finalEvent?.title && flyerUrl && (
                    <button
                      onClick={openStyleWizard}
                      disabled={generatingFlyer}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        color: "var(--gray-600)",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    >
                      ↺ Adjust styling
                    </button>
                  )}
                  {!finalEvent?.title && (
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
                  )}
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

              {selectedDraft.image_url && (
                <img
                  src={selectedDraft.image_url}
                  alt="Flyer"
                  style={{
                    width: "100%",
                    borderRadius: "var(--border-radius)",
                    border: "0.5px solid var(--gray-300)",
                  }}
                />
              )}

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

      {showStyleWizard && finalStyle && (
        <FlyerStyleWizard
          initialStyle={finalStyle}
          content={finalEvent}
          branding={ministry?.branding}
          platform={platform}
          typeSystemFonts={typeSystemFonts}
          people={people}
          layouts={layouts}
          hostId={hostId}
          onHostChange={setHostId}
          speakerIds={speakerIds}
          onSpeakersChange={setSpeakerIds}
          selectedLayout={selectedLayout}
          onLayoutChange={setSelectedLayout}
          hasSubtitle={!!finalEvent?.subtitle}
          hasDescription={!!finalEvent?.description}
          hasTags={!!finalEvent?.theme_tags?.length}
          onComplete={handleGenerateFlyer}
          onCancel={() => setShowStyleWizard(false)}
        />
      )}
    </div>
  );
};

export default ContentStudio;
