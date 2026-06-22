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
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
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

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    setGenerated(null);

    try {
      const res = await client.post("/api/content/generate", {
        prompt,
        platform,
      });
      setGenerated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const sendToQueue = async () => {
    setGenerated(null);
    setPrompt("");
    setTab("queue");
    await fetchDrafts();
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
              New Content
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
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                  color: "var(--charcoal)",
                  background: "var(--white)",
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
                What are we creating content for?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided. A time for worshipers to recharge..."
                style={{
                  width: "100%",
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
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                style={{
                  padding: "8px 16px",
                  background:
                    generating || !prompt.trim()
                      ? "var(--gray-400)"
                      : "var(--navy)",
                  color: "var(--white)",
                  border: "none",
                  borderRadius: "var(--border-radius)",
                  fontSize: "12px",
                  fontWeight: "500",
                  letterSpacing: "0.04em",
                  transition: "background 0.15s",
                }}
              >
                {generating ? "Generating..." : "✦ Generate"}
              </button>
              {generated && (
                <button
                  onClick={() => setGenerated(null)}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: "var(--gray-600)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                  }}
                >
                  Clear
                </button>
              )}
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

            {!generated && !generating && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--gray-400)",
                  fontSize: "12px",
                  minHeight: "160px",
                }}
              >
                Caption will appear here after generation
              </div>
            )}

            {generating && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--gray-500)",
                  fontSize: "12px",
                  minHeight: "160px",
                }}
              >
                Generating in Apostle Khy's voice...
              </div>
            )}

            {generated && (
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
                  {generated.caption}
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
                  <button
                    onClick={handleGenerate}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      color: "var(--gray-600)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                    }}
                  >
                    ↺ Regenerate
                  </button>
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
                const s = statusColors[draft.status];
                const isSelected = selectedDraft?._id === draft._id;
                return (
                  <div
                    key={draft._id}
                    onClick={() => {
                      setSelectedDraft(draft);
                      setFeedback("");
                    }}
                    style={{
                      background: "var(--white)",
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
