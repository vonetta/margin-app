import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import PageHeader from "../components/PageHeader";
import { clickableDivProps } from "../utils/a11y";

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
  background: "var(--white)",
};

const cardStyle = {
  background: "var(--white)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius-lg)",
  padding: "20px",
  boxShadow: "var(--shadow)",
};

const sectionTitleStyle = {
  fontFamily: "Cinzel, serif",
  fontSize: "10px",
  fontWeight: "500",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--navy)",
  opacity: 0.7,
};

// Mirrors src/services/layouts/index.js#suggestLayout on the backend, so the
// UI can show a suggestion before the user generates anything.
const suggestLayout = (host, speakers, hasVenueImage) => {
  const speakerCount = speakers.length;
  const hasHost = !!(host && (host.cutout_url || host.headshot_url));

  if (!hasHost && speakerCount === 0 && hasVenueImage) return "canvas";
  if (speakerCount >= 3 && !hasHost) return "showcase";
  if (hasHost && speakerCount >= 1) return "monument";
  if (hasHost && speakerCount === 0) return "feature";
  return "monument";
};

const FlyerGenerator = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    date: "",
    location: "",
    cost: "",
    cta: "",
    qr_url: "",
  });

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [hostId, setHostId] = useState("");
  const [speakerIds, setSpeakerIds] = useState([]);

  const [layouts, setLayouts] = useState([]);
  const [loadingLayouts, setLoadingLayouts] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState("auto");
  const [engine, setEngine] = useState("template");

  const [generating, setGenerating] = useState(false);
  const [flyer, setFlyer] = useState(null);
  const [error, setError] = useState("");

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [showPostForm, setShowPostForm] = useState(false);
  const [postCaption, setPostCaption] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);
  const [postCreated, setPostCreated] = useState(false);
  const [draftingCaption, setDraftingCaption] = useState(false);

  const fetchPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      const res = await client.get("/api/people");
      setPeople(res.data);
    } catch (err) {
      console.error("Failed to fetch people");
    } finally {
      setLoadingPeople(false);
    }
  }, []);

  const fetchLayouts = useCallback(async () => {
    setLoadingLayouts(true);
    try {
      const res = await client.get("/api/flyers/layouts");
      setLayouts(res.data);
    } catch (err) {
      console.error("Failed to fetch layouts");
    } finally {
      setLoadingLayouts(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await client.get("/api/flyers");
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch flyer history");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
    fetchLayouts();
    fetchHistory();
  }, [fetchPeople, fetchLayouts, fetchHistory]);

  const host = useMemo(
    () => people.find((p) => p._id === hostId) || null,
    [people, hostId],
  );
  const speakers = useMemo(
    () => people.filter((p) => speakerIds.includes(p._id)),
    [people, speakerIds],
  );

  const suggestedLayoutId = useMemo(
    () => suggestLayout(host, speakers, false),
    [host, speakers],
  );

  const effectiveLayoutId =
    selectedLayout === "auto" ? suggestedLayoutId : selectedLayout;

  // Collage is built around scattered photo cards — with no host/speaker
  // photo selected it has nothing to scatter and just falls back to a
  // plain gradient, so don't let it be picked until there's a photo.
  const hasAnyPhoto =
    !!(host && (host.cutout_url || host.headshot_url)) ||
    speakers.some((s) => s.cutout_url || s.headshot_url);

  useEffect(() => {
    if (selectedLayout === "collage" && !hasAnyPhoto) {
      setSelectedLayout("auto");
    }
  }, [selectedLayout, hasAnyPhoto]);

  const toggleSpeaker = (id) => {
    setSpeakerIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const buildPayload = () => ({
    title: form.title,
    subtitle: form.subtitle || undefined,
    date: form.date || undefined,
    location: form.location || undefined,
    cost: form.cost || undefined,
    cta: form.cta || undefined,
    qr_url: form.qr_url || undefined,
    host_id: hostId || undefined,
    speaker_ids: speakerIds,
    layout: engine === "ai" || selectedLayout === "auto" ? undefined : selectedLayout,
    engine,
  });

  const handleGenerate = async () => {
    if (!form.title.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await client.post("/api/flyers/generate", buildPayload());
      setFlyer(res.data);
      setShowPostForm(false);
      setPostCreated(false);
      setPostCaption("");
      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.error || "Flyer generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Regenerating the background re-runs the same generation request — the
  // backend auto-selects a background whenever none is supplied.
  const handleRegenerateBackground = () => handleGenerate();

  // Writes a caption in the ministry's AI voice from the flyer's own known
  // details — same engine Content Studio uses — instead of starting from a
  // blank textarea every time.
  const handleDraftCaption = async () => {
    setDraftingCaption(true);
    setError("");
    try {
      const res = await client.post(`/api/flyers/${flyer._id}/generate-caption`, {});
      setPostCaption(res.data.caption);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to draft a caption");
    } finally {
      setDraftingCaption(false);
    }
  };

  const handleCreateSocialPost = async () => {
    if (!postCaption.trim()) {
      setError("A caption is required to prepare a social post");
      return;
    }
    setCreatingPost(true);
    setError("");
    try {
      await client.post("/api/social-posts", {
        flyer_id: flyer._id,
        caption: postCaption.trim(),
        graphic_urls: [flyer.social_url],
        post_type: "image",
      });
      setPostCreated(true);
      setShowPostForm(false);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to prepare social post");
    } finally {
      setCreatingPost(false);
    }
  };

  const handleDeleteFlyer = async (id) => {
    try {
      await client.delete(`/api/flyers/${id}`);
      setConfirmDeleteId(null);
      if (flyer?._id === id) setFlyer(null);
      await fetchHistory();
    } catch (err) {
      setError("Failed to delete flyer");
    }
  };

  const hostCandidates = people.filter((p) => p.role !== "speaker" || p._id === hostId);
  const speakerCandidates = people.filter((p) => p._id !== hostId);

  return (
    <div style={{ padding: "32px", flex: 1, overflow: "auto" }}>
      <PageHeader
        icon="▣"
        color="var(--navy)"
        title="Flyer Generator"
        subtitle="Start from the design — we'll draft a matching caption for you"
      />

      <div style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "16px" }}>
        Don't have a flyer yet, just want to write a post?{" "}
        <button
          type="button"
          onClick={() => navigate("/content")}
          style={{
            color: "var(--navy)",
            fontWeight: "500",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            font: "inherit",
            textDecoration: "underline",
          }}
        >
          Go to Captions →
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Event details */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={sectionTitleStyle}>Event details</div>

            <div>
              <label style={labelStyle}>Title</label>
              <input
                style={inputStyle}
                value={form.title}
                onChange={handleChange("title")}
                placeholder="Worship Workshop"
              />
            </div>

            <div>
              <label style={labelStyle}>Subtitle</label>
              <input
                style={inputStyle}
                value={form.subtitle}
                onChange={handleChange("subtitle")}
                placeholder="An evening of renewal"
              />
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  aria-label="Event date"
                  style={inputStyle}
                  value={form.date}
                  onChange={handleChange("date")}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Cost</label>
                <input
                  style={inputStyle}
                  value={form.cost}
                  onChange={handleChange("cost")}
                  placeholder="$25 or Free"
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Location</label>
              <input
                style={inputStyle}
                value={form.location}
                onChange={handleChange("location")}
                placeholder="123 Main St, Atlanta GA"
              />
            </div>

            <div>
              <label style={labelStyle}>Call to action</label>
              <input
                style={inputStyle}
                value={form.cta}
                onChange={handleChange("cta")}
                placeholder="Register now"
              />
            </div>

            <div>
              <label style={labelStyle}>Registration URL (optional, for QR code)</label>
              <input
                style={inputStyle}
                value={form.qr_url}
                onChange={handleChange("qr_url")}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Host + speakers */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={sectionTitleStyle}>Host &amp; speakers</div>

            {loadingPeople ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                Loading roster...
              </div>
            ) : people.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                No people in the roster yet.
              </div>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Host</label>
                  <select
                    style={inputStyle}
                    value={hostId}
                    onChange={(e) => {
                      const newHostId = e.target.value;
                      setHostId(newHostId);
                      // Showing the same person as both the host and a
                      // speaker card reads as a duplicate-data bug, not a
                      // deliberate choice.
                      if (newHostId) {
                        setSpeakerIds((prev) => prev.filter((id) => id !== newHostId));
                      }
                    }}
                  >
                    <option value="">No host</option>
                    {hostCandidates.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                        {p.title ? ` — ${p.title}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Speakers</label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      maxHeight: "180px",
                      overflow: "auto",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      padding: "6px",
                    }}
                  >
                    {speakerCandidates.map((p) => {
                      const checked = speakerIds.includes(p._id);
                      return (
                        <div
                          key={p._id}
                          {...clickableDivProps(() => toggleSpeaker(p._id))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            background: checked ? "#f4f8fb" : "transparent",
                          }}
                        >
                          <span
                            style={{
                              width: "14px",
                              height: "14px",
                              borderRadius: "3px",
                              border: `0.5px solid ${checked ? "var(--navy)" : "var(--gray-300)"}`,
                              background: checked ? "var(--navy)" : "transparent",
                              color: "var(--white)",
                              fontSize: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {checked ? "✓" : ""}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--charcoal)" }}>
                            {p.name}
                            {p.title ? ` — ${p.title}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Engine */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={sectionTitleStyle}>Design engine</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { id: "template", label: "Template", desc: "Fast, exact brand colors, instant" },
                { id: "ai", label: "AI Studio", desc: "AI-designed image, a few seconds, varies each time" },
              ].map((e) => (
                <div
                  key={e.id}
                  {...clickableDivProps(() => setEngine(e.id))}
                  style={{
                    flex: 1,
                    border: `0.5px solid ${engine === e.id ? "var(--navy)" : "var(--gray-300)"}`,
                    borderRadius: "var(--border-radius)",
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: engine === e.id ? "#f4f8fb" : "var(--white)",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--navy)" }}>
                    {e.label}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "2px" }}>
                    {e.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Layout */}
          {engine === "template" && (
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={sectionTitleStyle}>Layout</div>
            {loadingLayouts ? (
              <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                Loading layouts...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div
                  {...clickableDivProps(() => setSelectedLayout("auto"))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `0.5px solid ${selectedLayout === "auto" ? "var(--navy)" : "var(--gray-300)"}`,
                    borderRadius: "var(--border-radius)",
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: selectedLayout === "auto" ? "#f4f8fb" : "var(--white)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--navy)" }}>
                      Auto-suggest
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                      Currently suggesting{" "}
                      {layouts.find((l) => l.id === suggestedLayoutId)?.name ||
                        suggestedLayoutId}
                    </div>
                  </div>
                  {selectedLayout === "auto" && (
                    <span style={{ color: "var(--navy)", fontSize: "12px" }}>✓</span>
                  )}
                </div>

                {layouts.map((l) => {
                  const disabled = l.id === "collage" && !hasAnyPhoto;
                  return (
                    <div
                      key={l.id}
                      {...clickableDivProps(() => setSelectedLayout(l.id), { disabled })}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        border: `0.5px solid ${selectedLayout === l.id ? "var(--navy)" : "var(--gray-300)"}`,
                        borderRadius: "var(--border-radius)",
                        padding: "10px 12px",
                        cursor: disabled ? "default" : "pointer",
                        background: selectedLayout === l.id ? "#f4f8fb" : "var(--white)",
                        opacity: disabled ? 0.5 : 1,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: "500", color: "var(--navy)" }}>
                          {l.name}
                          {l.id === suggestedLayoutId && !disabled && (
                            <span
                              style={{
                                marginLeft: "6px",
                                fontSize: "9px",
                                color: "var(--gold-dark)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              Suggested
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                          {disabled
                            ? "Add a host or speaker photo to unlock this layout"
                            : l.description}
                        </div>
                      </div>
                      {selectedLayout === l.id && (
                        <span style={{ color: "var(--navy)", fontSize: "12px" }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !form.title.trim()}
            style={{
              padding: "10px 16px",
              background:
                generating || !form.title.trim() ? "var(--gray-400)" : "var(--navy)",
              color: "var(--white)",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "12px",
              fontWeight: "500",
              letterSpacing: "0.04em",
            }}
          >
            {generating ? "Generating..." : `✦ Generate flyer (${effectiveLayoutId})`}
          </button>
        </div>

        {/* Preview */}
        <div
          style={{
            ...cardStyle,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignSelf: "start",
            position: "sticky",
            top: "0",
          }}
        >
          <div style={sectionTitleStyle}>Preview</div>

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

          {!flyer && !generating && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--gray-600)",
                fontSize: "12px",
                minHeight: "320px",
              }}
            >
              Flyer will appear here after generation
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
                minHeight: "320px",
              }}
            >
              Rendering flyer...
            </div>
          )}

          {flyer && !generating && (
            <>
              <img
                src={flyer.social_url}
                alt={flyer.title}
                style={{
                  width: "100%",
                  borderRadius: "var(--border-radius)",
                  border: "0.5px solid var(--gray-300)",
                }}
              />
              <div style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                Layout: {flyer.layout}
                {flyer.tone ? ` · Tone: ${flyer.tone}` : ""}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <a
                  href={flyer.social_url}
                  download
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
                  ⬇ Download social
                </a>
                <a
                  href={flyer.print_url}
                  download
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
                  ⬇ Download print
                </a>
                <button
                  onClick={handleRegenerateBackground}
                  disabled={generating}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    color: "var(--gray-600)",
                    border: "0.5px solid var(--gray-300)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                  }}
                >
                  ↺ Regenerate background
                </button>
                {!postCreated && (
                  <button
                    onClick={() => {
                      const opening = !showPostForm;
                      setShowPostForm((s) => !s);
                      if (opening && !postCaption) handleDraftCaption();
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      color: "var(--navy)",
                      border: "0.5px solid var(--navy)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                    }}
                  >
                    {showPostForm ? "Cancel" : "⌘ Post to social"}
                  </button>
                )}
              </div>

              {postCreated && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#3a7a4a",
                    background: "#eef7ee",
                    border: "0.5px solid #b4d8b4",
                    borderRadius: "var(--border-radius)",
                    padding: "10px 12px",
                  }}
                >
                  Sent to the social queue for approval — review it on the Social Queue page.
                </div>
              )}

              {showPostForm && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <textarea
                    placeholder={draftingCaption ? "Drafting a caption..." : "Caption for this post..."}
                    value={postCaption}
                    onChange={(e) => setPostCaption(e.target.value)}
                    disabled={draftingCaption}
                    rows={3}
                    style={{
                      padding: "8px 12px",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "13px",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleCreateSocialPost}
                      disabled={creatingPost || draftingCaption}
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
                      {creatingPost ? "Sending..." : "Send for approval"}
                    </button>
                    <button
                      onClick={handleDraftCaption}
                      disabled={draftingCaption}
                      style={{
                        padding: "8px 16px",
                        background: "transparent",
                        color: "var(--navy)",
                        border: "0.5px solid var(--navy)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "12px",
                      }}
                    >
                      {draftingCaption
                        ? "Drafting..."
                        : postCaption
                          ? "✦ Redraft with AI"
                          : "✦ Draft with AI"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <div style={sectionTitleStyle}>Recent flyers</div>
        {loadingHistory ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px" }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "10px" }}>
            No flyers generated yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "12px",
              marginTop: "12px",
            }}
          >
            {history.map((f) => (
              <div
                key={f._id}
                style={{
                  ...cardStyle,
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <img
                  src={f.social_url}
                  alt={f.title}
                  style={{ width: "100%", borderRadius: "var(--border-radius)", border: "0.5px solid var(--gray-300)" }}
                />
                <div style={{ fontSize: "11px", fontWeight: "500", color: "var(--charcoal)" }}>{f.title}</div>
                <div style={{ fontSize: "10px", color: "var(--gray-500)" }}>
                  {f.layout}
                  {f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString()}` : ""}
                </div>
                {confirmDeleteId === f._id ? (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => handleDeleteFlyer(f._id)}
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        background: "#c0504d",
                        color: "var(--white)",
                        border: "none",
                        borderRadius: "var(--border-radius)",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        padding: "5px 8px",
                        background: "transparent",
                        color: "var(--gray-600)",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(f._id)}
                    style={{
                      padding: "5px 8px",
                      background: "transparent",
                      color: "#c0504d",
                      border: "0.5px solid #e8b4b4",
                      borderRadius: "var(--border-radius)",
                      fontSize: "10px",
                      cursor: "pointer",
                    }}
                  >
                    ✕ Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlyerGenerator;
