import React, { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import FlyerPreviewCanvas from "./FlyerPreviewCanvas";
import { COLOR_VARIANT_LABELS, deriveColorVariants } from "../utils/colorVariants";
import { clickableDivProps } from "../utils/a11y";

// Mirrors src/services/layouts/styleSchema.js on the backend — kept in sync
// manually since the wizard needs human-readable labels the schema doesn't
// carry. The backend re-validates/clamps everything regardless, so a
// mismatch here can't produce a broken flyer, just a control that doesn't
// quite match the server's range.
const SIZE_FIELDS = {
  title_size: { label: "Title size", min: 40, max: 96, step: 2, unit: "px" },
  subtitle_size: { label: "Subtitle size", min: 24, max: 64, step: 2, unit: "px" },
  description_size: { label: "Description size", min: 14, max: 24, step: 1, unit: "px" },
  cta_size: { label: "Call-to-action size", min: 24, max: 48, step: 2, unit: "px" },
};

const LOGO_PLACEMENTS = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "photo-corner", label: "Corner of the photo" },
  { value: "footer-left", label: "Footer, by the CTA" },
  { value: "footer-right", label: "Footer, by the QR code" },
];

const LOGO_BACKINGS = [
  { value: "none", label: "None" },
  { value: "circle", label: "White circle" },
  { value: "pill", label: "White pill" },
];

// A ministry's curated type_system won't always include a script/accent
// font — the accent picker shouldn't just disappear when that's missing,
// so these fill in as universally elegant options.
const FALLBACK_ACCENT_FONTS = [
  { name: "Great Vibes", roles: ["accent", "script"], google_font: true },
  { name: "Pinyon Script", roles: ["accent", "script"], google_font: true },
  { name: "Sacramento", roles: ["accent", "script"], google_font: true },
];

const sectionTabStyle = (active) => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 14px",
  borderRadius: "var(--border-radius)",
  border: "none",
  background: active ? "var(--navy)" : "transparent",
  color: active ? "var(--white)" : "var(--gray-600)",
  fontSize: "13px",
  fontWeight: active ? "600" : "500",
  cursor: "pointer",
});

const FlyerStyleWizard = ({
  initialStyle,
  content,
  branding,
  platform,
  typeSystemFonts = [],
  people = [],
  layouts = [],
  hostId = "",
  onHostChange,
  speakerIds = [],
  onSpeakersChange,
  selectedLayout = "auto",
  onLayoutChange,
  hasSubtitle,
  hasDescription,
  hasTags,
  onComplete,
  onCancel,
}) => {
  const [style, setStyle] = useState(initialStyle);
  const [section, setSection] = useState("layout");
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [candidate, setCandidate] = useState(null); // { _id, url } awaiting accept/reject
  const [generatingBg, setGeneratingBg] = useState(false);
  const [bgError, setBgError] = useState("");

  // Load every font the ministry has curated, plus the fallback accent
  // fonts (cheap to always load, used only when the ministry has none of
  // its own), once, so font swatches and the live preview can actually
  // render in the real typeface rather than just naming it.
  useEffect(() => {
    const googleFonts = [...typeSystemFonts, ...FALLBACK_ACCENT_FONTS].filter(
      (f) => f.google_font !== false,
    );
    if (!googleFonts.length) return;
    const id = "wizard-type-system-fonts";
    if (document.getElementById(id)) return;
    const families = googleFonts
      .map((f) => `family=${f.name.replace(/\s+/g, "+")}:wght@400;600;800`)
      .join("&");
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }, [typeSystemFonts]);

  const sections = useMemo(() => {
    const list = [
      { key: "layout", label: "Layout" },
      { key: "people", label: "Host & Speakers" },
      { key: "background", label: "Background" },
      { key: "typography", label: "Typography" },
      { key: "colors", label: "Colors" },
    ];
    if (branding?.logo_url) list.push({ key: "logo", label: "Logo" });
    list.push({ key: "sizing", label: "Sizing" });
    return list;
  }, [branding]);

  // Mirrors src/services/layouts/index.js#suggestLayout — when the wizard
  // is on "auto", the preview should show whatever layout generation would
  // actually pick, not just always default to one layout regardless of who
  // got selected in Host & Speakers.
  const resolvedLayout = useMemo(() => {
    if (selectedLayout !== "auto") return selectedLayout;
    const host = people.find((p) => p._id === hostId);
    const hasHost = !!(host && (host.cutout_url || host.headshot_url));
    const speakerCount = speakerIds.length;
    if (speakerCount >= 3 && !hasHost) return "showcase";
    if (hasHost && speakerCount >= 1) return "monument";
    if (hasHost && speakerCount === 0) return "feature";
    return "monument";
  }, [selectedLayout, people, hostId, speakerIds]);

  // So the live preview actually shows who got picked in Host & Speakers,
  // not just affect which layout auto-suggest resolves to.
  const resolvedHost = people.find((p) => p._id === hostId) || null;
  const resolvedSpeakers = people.filter((p) => speakerIds.includes(p._id));

  const sizeSteps = useMemo(() => {
    const list = ["title_size"];
    if (hasSubtitle) list.push("subtitle_size");
    if (hasDescription) list.push("description_size");
    list.push("cta_size");
    return list;
  }, [hasSubtitle, hasDescription]);

  const set = (key, value) => setStyle((s) => ({ ...s, [key]: value }));

  const topicHint = [content?.title, ...(content?.theme_tags || [])]
    .filter(Boolean)
    .join(", ");

  const deleteCandidate = async (id) => {
    try {
      await client.delete(`/api/backgrounds/${id}`);
    } catch {
      // Best-effort cleanup — an orphaned unused background image isn't
      // worth failing the wizard over.
    }
  };

  const handleGenerateBackground = async () => {
    setGeneratingBg(true);
    setBgError("");
    try {
      const res = await client.post("/api/flyers/background-preview", {
        topic_hint: topicHint,
      });
      setCandidate({ _id: res.data._id, url: res.data.url });
    } catch (err) {
      setBgError(err.response?.data?.error || "Failed to generate an image");
    } finally {
      setGeneratingBg(false);
    }
  };

  const handleUseCandidate = () => {
    setBackgroundUrl(candidate.url);
    setCandidate(null);
  };

  const handleTryAnother = async () => {
    const rejected = candidate;
    setCandidate(null);
    if (rejected) await deleteCandidate(rejected._id);
    handleGenerateBackground();
  };

  const handleSkipCandidate = async () => {
    const rejected = candidate;
    setCandidate(null);
    if (rejected) await deleteCandidate(rejected._id);
  };

  const handleChangeAcceptedBackground = () => {
    setBackgroundUrl(null);
  };

  const displayFonts = typeSystemFonts.filter((f) => f.roles?.includes("display"));
  const curatedAccentFonts = typeSystemFonts.filter(
    (f) => f.roles?.includes("accent") || f.roles?.includes("script"),
  );
  const accentFonts = curatedAccentFonts.length
    ? curatedAccentFonts
    : FALLBACK_ACCENT_FONTS;
  const colorVariants = deriveColorVariants({
    primary: branding?.colors?.primary,
    accent: branding?.colors?.accent,
    gold: branding?.colors?.gold,
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <FlyerPreviewCanvas
          content={content}
          style={style}
          branding={branding}
          platform={platform}
          backgroundImageUrl={backgroundUrl}
          layout={resolvedLayout}
          host={resolvedHost}
          speakers={resolvedSpeakers}
        />

        <div
          style={{
            background: "var(--white)",
            border: "0.5px solid var(--gray-300)",
            borderRadius: "var(--border-radius-lg)",
            display: "flex",
            width: "560px",
            maxHeight: "640px",
          }}
        >
          <div
            style={{
              width: "150px",
              borderRight: "0.5px solid var(--gray-300)",
              padding: "16px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              flexShrink: 0,
            }}
          >
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                style={sectionTabStyle(section === s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div
            style={{
              flex: 1,
              padding: "22px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {section === "layout" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Layout
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    onClick={() => onLayoutChange?.("auto")}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "var(--border-radius)",
                      border: `1.5px solid ${selectedLayout === "auto" ? "var(--navy)" : "var(--gray-300)"}`,
                      background: selectedLayout === "auto" ? "#f4f8fb" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--navy)" }}>
                      Auto-suggest
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>
                      Picked based on whether there's a host or speakers
                    </div>
                  </button>
                  {layouts.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => onLayoutChange?.(l.id)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: "var(--border-radius)",
                        border: `1.5px solid ${selectedLayout === l.id ? "var(--navy)" : "var(--gray-300)"}`,
                        background: selectedLayout === l.id ? "#f4f8fb" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: "500", color: "var(--navy)" }}>
                        {l.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px" }}>
                        {l.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {section === "people" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Host &amp; Speakers
                </div>
                {people.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                    No one in the roster yet — add people on the People page first.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "6px" }}>Host</div>
                    <select
                      value={hostId}
                      onChange={(e) => {
                        const newHostId = e.target.value;
                        onHostChange?.(newHostId);
                        // The same person showing up as both the host and a
                        // speaker card looks like a duplicate-data bug, not
                        // a deliberate choice — picking someone as host
                        // un-checks them as a speaker automatically.
                        if (newHostId && speakerIds.includes(newHostId)) {
                          onSpeakersChange?.(speakerIds.filter((id) => id !== newHostId));
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "0.5px solid var(--gray-300)",
                        borderRadius: "var(--border-radius)",
                        fontSize: "13px",
                        marginBottom: "18px",
                      }}
                    >
                      <option value="">No host</option>
                      {people.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                          {p.title ? ` — ${p.title}` : ""}
                        </option>
                      ))}
                    </select>

                    <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "6px" }}>Speakers</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflow: "auto" }}>
                      {people.filter((p) => p._id !== hostId).map((p) => {
                        const checked = speakerIds.includes(p._id);
                        return (
                          <div
                            key={p._id}
                            {...clickableDivProps(() =>
                              onSpeakersChange?.(
                                checked
                                  ? speakerIds.filter((id) => id !== p._id)
                                  : [...speakerIds, p._id],
                              ),
                            )}
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
                  </>
                )}
              </div>
            )}

            {section === "background" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Background image
                </div>
                <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Generate a real, relevant image (worship, a gathered group, hands raised) instead of a plain gradient. You choose whether to use it — nothing is final until you say so.
                </div>

                {bgError && (
                  <div style={{ fontSize: "12px", color: "#c0504d", marginBottom: "10px" }}>{bgError}</div>
                )}

                {backgroundUrl ? (
                  <div>
                    <img
                      src={backgroundUrl}
                      alt="Selected background"
                      style={{ width: "100%", borderRadius: "var(--border-radius)", marginBottom: "10px" }}
                    />
                    <button onClick={handleChangeAcceptedBackground} style={secondaryBtn}>
                      ↺ Use a different image
                    </button>

                    <div style={{ fontSize: "12px", color: "var(--gray-600)", margin: "18px 0 6px" }}>
                      Brand gradient on top — {style.gradient_overlay_opacity}%
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={style.gradient_overlay_opacity}
                      onChange={(e) => set("gradient_overlay_opacity", Number(e.target.value))}
                      style={{ width: "100%" }}
                    />
                  </div>
                ) : candidate ? (
                  <div>
                    <img
                      src={candidate.url}
                      alt="Generated candidate"
                      style={{ width: "100%", borderRadius: "var(--border-radius)", marginBottom: "10px" }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={handleUseCandidate} style={primaryBtn}>
                        ✓ Use this
                      </button>
                      <button onClick={handleTryAnother} disabled={generatingBg} style={secondaryBtn}>
                        {generatingBg ? "Generating..." : "Try another"}
                      </button>
                      <button onClick={handleSkipCandidate} style={textBtn}>
                        Skip
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleGenerateBackground} disabled={generatingBg} style={primaryBtn}>
                    {generatingBg ? "Generating..." : "✦ Generate an image"}
                  </button>
                )}
              </div>
            )}

            {section === "typography" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Typography
                </div>
                {displayFonts.length > 0 && (
                  <FontGroup
                    label="Title font"
                    fonts={displayFonts}
                    selected={style.display_font}
                    onSelect={(name) => set("display_font", name)}
                  />
                )}
                {accentFonts.length > 0 && (
                  <FontGroup
                    label="Accent font"
                    fonts={accentFonts}
                    selected={style.accent_font}
                    onSelect={(name) => set("accent_font", name)}
                  />
                )}
              </div>
            )}

            {section === "colors" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Colors
                </div>
                <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Each option is derived from your own brand colors — still on brand, just a different emphasis.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries(colorVariants).map(([key, colors]) => (
                    <button
                      key={key}
                      onClick={() => set("color_variant", key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "var(--border-radius)",
                        border: `1.5px solid ${style.color_variant === key ? "var(--navy)" : "var(--gray-300)"}`,
                        background: style.color_variant === key ? "#f4f8fb" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex" }}>
                        {[colors.primary, colors.accent, colors.gold].map((c, i) => (
                          <span
                            key={i}
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background: c,
                              marginLeft: i > 0 ? "-6px" : 0,
                              border: "1.5px solid white",
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: "13px", color: "var(--charcoal)" }}>
                        {COLOR_VARIANT_LABELS[key] || key}
                      </span>
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: "12px", color: "var(--gray-600)", margin: "20px 0 6px" }}>
                  Gradient direction (used when there's no background photo) — {style.gradient_angle}°
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={style.gradient_angle}
                  onChange={(e) => set("gradient_angle", Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {section === "logo" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Logo
                </div>
                <div style={{ marginBottom: "18px" }}>
                  <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "6px" }}>Size</div>
                  <input
                    type="range"
                    min={40}
                    max={140}
                    step={4}
                    value={style.logo_size}
                    onChange={(e) => set("logo_size", Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "6px" }}>Placement</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {LOGO_PLACEMENTS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => set("logo_placement", p.value)}
                      style={{
                        textAlign: "left",
                        padding: "9px 12px",
                        borderRadius: "var(--border-radius)",
                        border: `1.5px solid ${style.logo_placement === p.value ? "var(--navy)" : "var(--gray-300)"}`,
                        background: style.logo_placement === p.value ? "#f4f8fb" : "transparent",
                        fontSize: "13px",
                        color: "var(--charcoal)",
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: "12px", color: "var(--gray-600)", margin: "18px 0 6px" }}>
                  Backing (helps it stand out on a photo or bold gradient)
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {LOGO_BACKINGS.map((b) => (
                    <button
                      key={b.value}
                      onClick={() => set("logo_backing", b.value)}
                      style={{
                        flex: 1,
                        padding: "9px 8px",
                        borderRadius: "var(--border-radius)",
                        border: `1.5px solid ${style.logo_backing === b.value ? "var(--navy)" : "var(--gray-300)"}`,
                        background: style.logo_backing === b.value ? "#f4f8fb" : "transparent",
                        fontSize: "12px",
                        color: "var(--charcoal)",
                        cursor: "pointer",
                      }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {section === "sizing" && (
              <div>
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "15px", color: "var(--navy)", marginBottom: "12px" }}>
                  Sizing
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {sizeSteps.map((key) => {
                    const f = SIZE_FIELDS[key];
                    return (
                      <div key={key}>
                        <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "6px" }}>
                          {f.label} — {style[key]}{f.unit}
                        </div>
                        <input
                          type="range"
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          value={style[key]}
                          onChange={(e) => set(key, Number(e.target.value))}
                          style={{ width: "100%" }}
                        />
                      </div>
                    );
                  })}
                  {hasDescription && (
                    <ToggleRow
                      label="Show description"
                      value={style.description_visible}
                      onChange={(v) => set("description_visible", v)}
                    />
                  )}
                  {hasTags && (
                    <ToggleRow
                      label="Show theme tags"
                      value={style.tags_visible}
                      onChange={(v) => set("tags_visible", v)}
                    />
                  )}
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: "8px", borderTop: "0.5px solid var(--gray-200)", paddingTop: "16px" }}>
              <button
                onClick={() => onComplete(style, backgroundUrl)}
                style={{ ...primaryBtn, flex: 1 }}
              >
                ✦ Generate flyer
              </button>
              <button onClick={onCancel} style={textBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FontGroup = ({ label, fonts, selected, onSelect }) => (
  <div style={{ marginBottom: "18px" }}>
    <div style={{ fontSize: "12px", color: "var(--gray-600)", marginBottom: "8px" }}>{label}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {fonts.map((f) => (
        <button
          key={f.name}
          onClick={() => onSelect(f.name)}
          style={{
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: "var(--border-radius)",
            border: `1.5px solid ${selected === f.name ? "var(--navy)" : "var(--gray-300)"}`,
            background: selected === f.name ? "#f4f8fb" : "transparent",
            fontFamily: `'${f.name}', serif`,
            fontSize: "16px",
            color: "var(--charcoal)",
            cursor: "pointer",
          }}
        >
          {f.name}
        </button>
      ))}
    </div>
  </div>
);

const ToggleRow = ({ label, value, onChange }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>{label}</div>
    <div style={{ display: "flex", gap: "6px" }}>
      <button
        onClick={() => onChange(true)}
        style={{
          padding: "6px 14px",
          borderRadius: "var(--border-radius)",
          border: `1px solid ${value ? "var(--navy)" : "var(--gray-300)"}`,
          background: value ? "var(--navy)" : "transparent",
          color: value ? "var(--white)" : "var(--gray-600)",
          fontSize: "12px",
        }}
      >
        Show
      </button>
      <button
        onClick={() => onChange(false)}
        style={{
          padding: "6px 14px",
          borderRadius: "var(--border-radius)",
          border: `1px solid ${!value ? "var(--navy)" : "var(--gray-300)"}`,
          background: !value ? "var(--navy)" : "transparent",
          color: !value ? "var(--white)" : "var(--gray-600)",
          fontSize: "12px",
        }}
      >
        Hide
      </button>
    </div>
  </div>
);

const primaryBtn = {
  padding: "10px 16px",
  background: "var(--navy)",
  color: "var(--white)",
  border: "none",
  borderRadius: "var(--border-radius)",
  fontSize: "13px",
  fontWeight: "500",
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 16px",
  background: "transparent",
  color: "var(--gray-600)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius)",
  fontSize: "13px",
  cursor: "pointer",
};

const textBtn = {
  padding: "10px 16px",
  background: "transparent",
  color: "var(--gray-500)",
  border: "none",
  fontSize: "13px",
  cursor: "pointer",
};

export default FlyerStyleWizard;
