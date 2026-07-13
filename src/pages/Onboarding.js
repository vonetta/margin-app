import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const STEPS = ["branding", "voice", "hashtags", "review"];

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
  padding: "24px",
  maxWidth: "560px",
};

const COLOR_FIELDS = ["primary", "accent", "background", "text", "gold"];
const REGISTER_KEYS = ["formal", "warm", "energetic"];
// A concrete worked example per register, since "how does this voice
// write when formal" is abstract enough that a non-marketing admin can
// stall on a blank input with no sense of what a good answer looks like.
const REGISTER_EXAMPLES = {
  formal: "e.g. a service bulletin announcement: \"You are cordially invited to join us for...\"",
  warm: "e.g. a small-group reminder text: \"Hey family, can't wait to see you tonight!\"",
  energetic: "e.g. a youth-event flyer caption: \"THIS. IS. HAPPENING. 🔥 Don't miss it!\"",
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [colors, setColors] = useState({});
  const [fonts, setFonts] = useState({ heading: "", body: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  const [personaName, setPersonaName] = useState("");
  const [signOff, setSignOff] = useState("");
  const [tonePillars, setTonePillars] = useState("");
  const [avoidList, setAvoidList] = useState("");
  const [samplePhrases, setSamplePhrases] = useState("");
  const [registers, setRegisters] = useState({});

  const [brandHashtags, setBrandHashtags] = useState("");
  const [contentHashtags, setContentHashtags] = useState("");
  const [ctaText, setCtaText] = useState("");

  const [prefillUrl, setPrefillUrl] = useState("");
  const [prefillPosts, setPrefillPosts] = useState("");
  const [showPrefillPosts, setShowPrefillPosts] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState("");

  const loadExisting = useCallback(async () => {
    setLoading(true);
    try {
      const [ministryRes, profileRes] = await Promise.all([
        client.get("/api/ministry"),
        client.get("/api/profile").catch(() => null),
      ]);

      setTagline(ministryRes.data.tagline || "");
      setWebsite(ministryRes.data.website || "");
      const branding = ministryRes.data.branding || {};
      setColors(branding.colors || {});
      setFonts(branding.fonts || { heading: "", body: "" });
      setLogoUrl(branding.logo_url || null);

      if (profileRes) {
        const vp = profileRes.data.voice_profile || {};
        setPersonaName(vp.persona_name || "");
        setSignOff(vp.sign_off || "");
        setTonePillars((vp.tone_pillars || []).join(", "));
        setAvoidList((vp.avoid || []).join(", "));
        setSamplePhrases((vp.sample_phrases || []).join("\n"));
        setRegisters(vp.registers || {});

        const hashtags = profileRes.data.hashtags || {};
        setBrandHashtags((hashtags.brand || []).join(" "));
        setContentHashtags((hashtags.content || []).join(" "));

        const ctas = profileRes.data.ctas || {};
        setCtaText(
          Object.entries(ctas)
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n"),
        );
      }
    } catch (err) {
      setError("Failed to load current setup");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  // Fetches the ministry's website server-side and pre-fills the wizard's
  // (editable) fields from what Gemini drafts. Only non-empty values from
  // the draft are applied, so a thin/partial scrape never blanks out
  // something already entered. Nothing is saved here — the user reviews
  // every field and saves through the normal step buttons.
  const handlePrefill = async () => {
    if (!prefillUrl.trim()) return;
    setPrefilling(true);
    setError("");
    setPrefillNotice("");
    try {
      const res = await client.post("/api/profile/onboarding/prefill", {
        website_url: prefillUrl.trim(),
        past_posts: prefillPosts.trim() || undefined,
      });
      const d = res.data;
      // The website field itself is the one thing we're already certain
      // of — it's the URL the admin just typed in, resolved through any
      // redirects — so it's safe to fill even though nothing else here
      // guarantees the model drafted usable content.
      if (!website.trim() && d.source?.url) setWebsite(d.source.url);

      const vp = d.voice_profile || {};
      if (vp.persona_name) setPersonaName(vp.persona_name);
      if (vp.tagline) setTagline(vp.tagline);
      if (vp.tone_pillars?.length) setTonePillars(vp.tone_pillars.join(", "));
      if (vp.sample_phrases?.length) setSamplePhrases(vp.sample_phrases.join("\n"));
      if (vp.avoid?.length) setAvoidList(vp.avoid.join(", "));

      const sc = d.suggested_colors || {};
      if (sc.primary || sc.accent) {
        setColors((c) => ({
          ...c,
          ...(sc.primary ? { primary: sc.primary } : {}),
          ...(sc.accent ? { accent: sc.accent } : {}),
        }));
      }

      const h = d.hashtags || {};
      if (h.brand?.length) setBrandHashtags(h.brand.join(" "));
      if (h.content?.length) setContentHashtags(h.content.join(" "));

      setPrefillNotice(
        d.source?.had_readable_text
          ? "We drafted your profile from your website — review and tweak each field below, then step through to save."
          : "We couldn't pull much from that site, so most fields are still blank — fill them in below.",
      );
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't read that website — you can fill everything in manually below.");
    } finally {
      setPrefilling(false);
    }
  };

  const parseList = (text) =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const parseLines = (text) =>
    text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const parseCtas = (text) => {
    const result = {};
    parseLines(text).forEach((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) result[key] = value;
    });
    return result;
  };

  const saveBranding = async () => {
    // website is validated server-side as a real URL when present — an
    // empty string would fail that check, so it's only sent when there's
    // actually something to save (same reason logoFile below is
    // conditional).
    await client.put("/api/ministry", {
      tagline: tagline.trim(),
      ...(website.trim() ? { website: website.trim() } : {}),
      branding: { colors, fonts },
    });
    if (logoFile) {
      const formData = new FormData();
      formData.append("logo", logoFile);
      await client.post("/api/ministry/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
  };

  const saveVoice = async () => {
    await client.put("/api/profile/voice", {
      persona_name: personaName,
      sign_off: signOff,
      tone_pillars: parseList(tonePillars),
      avoid: parseList(avoidList),
      registers,
    });
    for (const phrase of parseLines(samplePhrases)) {
      await client.post("/api/profile/phrases", { phrase });
    }
  };

  const saveHashtags = async () => {
    await client.put("/api/profile/hashtags", {
      brand: brandHashtags.split(/\s+/).filter(Boolean),
      content: contentHashtags.split(/\s+/).filter(Boolean),
    });
    await client.put("/api/profile/ctas", { ctas: parseCtas(ctaText) });
  };

  const handleNext = async () => {
    setSaving(true);
    setError("");
    try {
      if (STEPS[step] === "branding") await saveBranding();
      if (STEPS[step] === "voice") await saveVoice();
      if (STEPS[step] === "hashtags") await saveHashtags();
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save this step");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setError("");
    try {
      await client.put("/api/ministry", { onboarding_complete: true });
      await refreshUser();
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to finish setup");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => navigate("/");

  if (loading) {
    return (
      <div style={{ padding: "32px", fontSize: "13px", color: "var(--gray-500)" }}>
        Loading...
      </div>
    );
  }

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
          Ministry Setup
        </h2>
        <p style={{ fontSize: "12px", color: "var(--gray-600)" }}>
          Step {step + 1} of {STEPS.length} —{" "}
          {STEPS[step] === "branding" && "Branding"}
          {STEPS[step] === "voice" && "Voice"}
          {STEPS[step] === "hashtags" && "Hashtags & CTAs"}
          {STEPS[step] === "review" && "Review"}
        </p>
      </div>

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
            maxWidth: "560px",
          }}
        >
          {error}
        </div>
      )}

      {step === 0 && (
        <div
          style={{
            ...cardStyle,
            marginBottom: "16px",
            background: "#f4f8fb",
            border: "0.5px solid var(--navy)",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--navy)", marginBottom: "4px" }}>
            ✨ Start from your website
          </div>
          <p style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "12px", maxWidth: "520px" }}>
            Paste your ministry's website and we'll draft your voice, colors, and hashtags for you. Everything below
            stays editable — this just gives you a head start.
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="url"
              placeholder="https://yourministry.org"
              value={prefillUrl}
              onChange={(e) => setPrefillUrl(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: "240px" }}
            />
            <button
              type="button"
              onClick={handlePrefill}
              disabled={prefilling || !prefillUrl.trim()}
              style={{
                padding: "8px 16px",
                background: prefilling || !prefillUrl.trim() ? "var(--gray-400)" : "var(--navy)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: prefilling || !prefillUrl.trim() ? "default" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {prefilling ? "Reading your site…" : "Fill from my website"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPrefillPosts((v) => !v)}
            style={{
              marginTop: "8px",
              padding: 0,
              background: "none",
              border: "none",
              color: "var(--navy)",
              fontSize: "11px",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {showPrefillPosts ? "Hide past posts" : "Also paste a few past social posts (optional, sharpens the voice)"}
          </button>
          {showPrefillPosts && (
            <textarea
              placeholder="Paste a few of your recent captions or posts…"
              value={prefillPosts}
              onChange={(e) => setPrefillPosts(e.target.value)}
              rows={4}
              style={{ ...inputStyle, marginTop: "8px", resize: "vertical" }}
            />
          )}
          {prefillNotice && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--navy)" }}>{prefillNotice}</div>
          )}
        </div>
      )}

      {STEPS[step] === "branding" && (
        <div style={cardStyle}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Tagline (optional)</label>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Equipping leaders, changing lives"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Website (optional)</label>
            <input
              type="url"
              aria-label="Ministry website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourministry.org/about"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            {COLOR_FIELDS.map((field) => (
              <div key={field}>
                <label style={labelStyle}>{field}</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={colors[field] || "#000000"}
                    onChange={(e) =>
                      setColors((c) => ({ ...c, [field]: e.target.value }))
                    }
                    style={{ width: "36px", height: "36px", border: "none", padding: 0, background: "none" }}
                  />
                  <input
                    value={colors[field] || ""}
                    onChange={(e) =>
                      setColors((c) => ({ ...c, [field]: e.target.value }))
                    }
                    placeholder="#000000"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Heading font</label>
              <input
                value={fonts.heading || ""}
                onChange={(e) => setFonts((f) => ({ ...f, heading: e.target.value }))}
                placeholder="Cinzel"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Body font</label>
              <input
                value={fonts.body || ""}
                onChange={(e) => setFonts((f) => ({ ...f, body: e.target.value }))}
                placeholder="Montserrat"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Logo</label>
            {logoUrl && !logoFile && (
              <img
                src={logoUrl}
                alt="Current logo"
                style={{ height: "48px", display: "block", marginBottom: "8px" }}
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      )}

      {STEPS[step] === "voice" && (
        <div style={cardStyle}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Persona name</label>
            <input value={personaName} onChange={(e) => setPersonaName(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Sign-off</label>
            <input value={signOff} onChange={(e) => setSignOff(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Tone pillars (comma separated)</label>
            <input value={tonePillars} onChange={(e) => setTonePillars(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Avoid (comma separated)</label>
            <input value={avoidList} onChange={(e) => setAvoidList(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Sample phrases (one per line)</label>
            <textarea
              value={samplePhrases}
              onChange={(e) => setSamplePhrases(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Communication registers</label>
            <p style={{ fontSize: "11px", color: "var(--gray-500)", marginBottom: "10px", marginTop: "-2px" }}>
              How this voice actually sounds in each mode — a real sentence or two is more useful here than a
              description. Skip any you're not sure about; the AI will fall back to the tone pillars above.
            </p>
            {REGISTER_KEYS.map((key) => (
              <div key={key} style={{ marginBottom: "10px" }}>
                <label style={{ fontSize: "11px", color: "var(--gray-500)", textTransform: "capitalize" }}>
                  {key}
                </label>
                <input
                  value={registers[key] || ""}
                  onChange={(e) =>
                    setRegisters((r) => ({ ...r, [key]: e.target.value }))
                  }
                  placeholder={REGISTER_EXAMPLES[key]}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {STEPS[step] === "hashtags" && (
        <div style={cardStyle}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Brand hashtags (space separated)</label>
            <input
              value={brandHashtags}
              onChange={(e) => setBrandHashtags(e.target.value)}
              placeholder="#SaltAndLight #CommunityFirst"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Content hashtags (space separated)</label>
            <input
              value={contentHashtags}
              onChange={(e) => setContentHashtags(e.target.value)}
              placeholder="#Community #Gathering"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Calls to action (one per line, "key: value")</label>
            <textarea
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              rows={4}
              placeholder={"enrollment: Secure your spot\ngiving: Give today"}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
        </div>
      )}

      {STEPS[step] === "review" && (
        <div style={cardStyle}>
          <p style={{ fontSize: "13px", color: "var(--charcoal)", lineHeight: 1.6, marginBottom: "16px" }}>
            Branding, voice, and hashtags are saved. Finish setup to clear the
            reminder — everything here stays editable later from AI Profile.
          </p>
          <button
            onClick={handleFinish}
            disabled={saving}
            style={{
              padding: "10px 20px",
              background: saving ? "var(--gray-400)" : "var(--primary)",
              color: "var(--white)",
              border: "none",
              borderRadius: "var(--border-radius)",
              fontSize: "12px",
              fontWeight: "500",
            }}
          >
            {saving ? "Finishing..." : "Finish setup"}
          </button>
        </div>
      )}

      {STEPS[step] !== "review" && (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", maxWidth: "560px" }}>
          <button
            onClick={handleNext}
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
            {saving ? "Saving..." : "Save & continue"}
          </button>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "var(--gray-600)",
                border: "0.5px solid var(--gray-300)",
                borderRadius: "var(--border-radius)",
                fontSize: "12px",
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleSkip}
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "var(--gray-500)",
              border: "none",
              fontSize: "12px",
            }}
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
