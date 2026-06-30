import React, { useEffect } from "react";
import { deriveColorVariants } from "../utils/colorVariants";

// A live, client-side mirror of the backend layout templates
// (src/services/layouts/*.js) — deliberately simplified approximations, not
// pixel-perfect copies, so the wizard can update instantly as sliders/
// choices change without a Puppeteer round-trip per tick. The real PNG
// always comes from the server; this is just so adjustments (including
// which layout is selected) aren't blind. Each of the 4 layouts gets its
// own distinct branch below — picking a different layout in the wizard
// must visibly change this preview, or the choice looks like it did
// nothing even though the real generated flyer would differ correctly.
const PLATFORM_DIMENSIONS = {
  Instagram: { width: 1080, height: 1350 },
  Facebook: { width: 1200, height: 1200 },
  "Quote card": { width: 1080, height: 1080 },
  Email: { width: 1200, height: 628 },
};

const CANVAS_WIDTH = 480;

// Loads a Google Font on demand so the preview can actually show a font
// override, not just apply a CSS font-family the browser doesn't have.
const useGoogleFont = (fontName) => {
  useEffect(() => {
    if (!fontName) return;
    const id = `preview-font-${fontName.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, "+")}:wght@400;600;800&display=swap`;
    document.head.appendChild(link);
  }, [fontName]);
};

const initials = (name = "") => (name.trim().charAt(0) || "?").toUpperCase();

const FlyerPreviewCanvas = ({
  content = {},
  style = {},
  branding = {},
  platform = null,
  backgroundImageUrl = null,
  layout = "monument",
  host = null,
  speakers = [],
}) => {
  const baseColors = branding.colors || {};
  const variants = deriveColorVariants({
    primary: baseColors.primary,
    accent: baseColors.accent,
    gold: baseColors.gold,
  });
  const { primary, accent, gold } =
    variants[style.color_variant] || variants.brand;
  const bg = baseColors.background || "#ffffff";

  const displayFont = style.display_font || null;
  const accentFont = style.accent_font || null;
  useGoogleFont(displayFont);
  useGoogleFont(accentFont);

  const realDims = PLATFORM_DIMENSIONS[platform] || { width: 1080, height: 1350 };
  const SCALE = CANVAS_WIDTH / realDims.width;
  const CANVAS_HEIGHT = Math.round(realDims.height * SCALE);

  const px = (n) => Math.max(6, Math.round(n * SCALE));

  const gradientAngle = style.gradient_angle ?? 165;
  const brandGradientCss = `radial-gradient(circle at 25% 15%, rgba(255,255,255,0.18), transparent 45%), linear-gradient(${gradientAngle}deg, ${primary}, ${accent}, ${gold})`;

  const logoUrl = branding.logo_url;
  const logoSize = px(style.logo_size || 84);
  const logoPlacement = style.logo_placement || "top-left";
  const logoBacking = style.logo_backing || "none";
  const onFooter = logoPlacement === "footer-left" || logoPlacement === "footer-right";
  const needsInvert = onFooter && logoBacking === "none";

  const logoEl = logoUrl && (
    <span
      style={
        logoBacking === "none"
          ? {}
          : {
              display: "inline-flex",
              background: "#fff",
              borderRadius: logoBacking === "circle" ? "50%" : 999,
              padding: logoBacking === "circle" ? px(10) : `${px(8)}px ${px(16)}px`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }
      }
    >
      <img
        src={logoUrl}
        alt="logo"
        style={{
          height: logoSize,
          filter: needsInvert ? "brightness(0) invert(1)" : "none",
        }}
      />
    </span>
  );

  const wrapStyle = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: bg,
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    borderRadius: "4px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    fontFamily: "Georgia, serif",
  };

  const titleStyle = (color) => ({
    fontFamily: displayFont || "Georgia, serif",
    fontWeight: 800,
    fontSize: px(style.title_size || 70),
    lineHeight: 1.0,
    color,
    textTransform: "uppercase",
  });

  const ctaStyle = (color) => ({
    fontFamily: displayFont || "Georgia, serif",
    fontWeight: 800,
    fontSize: px((style.cta_size || 34) * 0.82),
    color,
    textTransform: "uppercase",
  });

  const tagRow = (color) =>
    style.tags_visible &&
    content.theme_tags?.length > 0 && (
      <div style={{ marginTop: px(16), display: "flex", flexWrap: "wrap", gap: px(8) }}>
        {content.theme_tags.map((t, i) => (
          <span
            key={i}
            style={{
              padding: `${px(6)}px ${px(14)}px`,
              borderRadius: px(16),
              border: `1.5px solid ${color}`,
              fontSize: px(12),
              fontWeight: 700,
              letterSpacing: "0.04em",
              color,
              textTransform: "uppercase",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    );

  const descBlock = (color) =>
    style.description_visible &&
    content.description && (
      <div
        style={{
          fontSize: px(style.description_size || 18),
          lineHeight: 1.4,
          color,
          fontStyle: "italic",
          marginTop: px(16),
        }}
      >
        {content.description}
      </div>
    );

  const personCircle = (person, size, { ribbon } = {}) => {
    const img = person.cutout_url || person.headshot_url;
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: px(size),
            height: px(size),
            borderRadius: "50%",
            border: `${px(3)}px solid #fff`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            background: img ? `url(${img})` : `${gold}4d`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: px(size * 0.3),
            fontFamily: displayFont || "Georgia, serif",
            margin: "0 auto",
          }}
        >
          {!img && initials(person.name)}
        </div>
        {ribbon && (
          <div style={{ fontSize: px(10), fontWeight: 700, letterSpacing: "0.06em", color: gold, marginTop: px(4), textTransform: "uppercase" }}>
            {ribbon}
          </div>
        )}
        <div style={{ fontSize: px(13), fontWeight: 700, marginTop: px(2), color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{person.name}</div>
      </div>
    );
  };

  // --- Monument: cream content column fading into a photo/gradient zone ---
  if (layout === "monument") {
    const metaItems = [
      content.date && { icon: "📅", value: content.date },
      content.location && { icon: "📍", value: content.location },
      content.cost && { icon: "💰", value: content.cost },
    ].filter(Boolean);

    const backgroundLayer = backgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.25)), url(${backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: brandGradientCss };

    return (
      <div style={wrapStyle}>
        <div style={{ position: "relative", flex: 1, minHeight: px(260), ...backgroundLayer }}>
          {backgroundImageUrl && style.gradient_overlay_opacity > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: brandGradientCss,
                opacity: style.gradient_overlay_opacity / 100,
                zIndex: 0,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: "58%",
              background: `linear-gradient(90deg, ${bg} 0%, ${bg} 42%, rgba(0,0,0,0) 100%)`,
              zIndex: 1,
            }}
          />
          {logoPlacement === "photo-corner" && logoEl && (
            <div style={{ position: "absolute", top: px(20), right: px(20), zIndex: 3 }}>{logoEl}</div>
          )}
          {host && (
            <div style={{ position: "absolute", top: "50%", right: "8%", transform: "translateY(-50%)", zIndex: 2 }}>
              {personCircle(host, style.host_photo_size || 230, { ribbon: "HOST" })}
            </div>
          )}
          <div style={{ position: "relative", zIndex: 2, width: "50%", padding: `${px(48)}px` }}>
            {(logoPlacement === "top-left" || logoPlacement === "top-center") && logoEl && (
              <div style={{ textAlign: logoPlacement === "top-center" ? "center" : "left", marginBottom: px(16) }}>
                {logoEl}
              </div>
            )}
            <div style={titleStyle(primary)}>{content.title || "Event Title"}</div>
            {content.subtitle && (
              <div style={{ fontFamily: accentFont || "cursive", fontSize: px(style.subtitle_size || 48), color: accent, marginTop: px(8) }}>
                {content.subtitle}
              </div>
            )}
            {tagRow(primary)}
            {descBlock("rgba(0,0,0,0.7)")}
            {content.highlights?.length > 0 && (
              <div style={{ marginTop: px(16), display: "flex", flexDirection: "column", gap: px(6) }}>
                {content.highlights.map((h, i) => (
                  <div key={i} style={{ fontSize: px(15), color: primary, fontWeight: 500 }}>
                    <span style={{ color: gold, fontWeight: 700 }}>✓ </span>
                    {h}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {speakers.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: px(20), padding: `${px(16)}px 0`, background: bg, flexWrap: "wrap" }}>
            {speakers.map((sp, i) => (
              <div key={i}>{personCircle(sp, style.speaker_photo_size || 170)}</div>
            ))}
          </div>
        )}
        {metaItems.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: px(20), padding: `${px(14)}px 0`, borderTop: "1px solid rgba(0,0,0,0.1)", borderBottom: "1px solid rgba(0,0,0,0.1)", flexWrap: "wrap", background: bg }}>
            {metaItems.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: px(6), fontSize: px(15), color: primary, fontWeight: 700 }}>
                <span style={{ width: px(28), height: px(28), borderRadius: "50%", background: primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: px(13) }}>{m.icon}</span>
                {m.value}
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: "0 0 auto", background: primary, borderTop: `${px(4)}px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: px(12), padding: `${px(18)}px ${px(48)}px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: px(12) }}>
            {logoPlacement === "footer-left" && logoEl}
            <div style={ctaStyle(gold)}>{content.cta || "Call to action"}</div>
          </div>
          {logoPlacement === "footer-right" && logoEl}
        </div>
      </div>
    );
  }

  // --- Feature: dark scrim over a hero photo/gradient, text on the left ---
  if (layout === "feature") {
    const hostImg = host && (host.cutout_url || host.headshot_url);
    const bgLayer = hostImg
      ? { backgroundImage: `url(${hostImg})`, backgroundSize: "cover", backgroundPosition: "center top" }
      : backgroundImageUrl
        ? { backgroundImage: `url(${backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
        : { background: brandGradientCss };
    return (
      <div style={{ ...wrapStyle, ...bgLayer }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${primary} 30%, ${primary}88 55%, transparent 75%)` }} />
        <div style={{ position: "relative", zIndex: 2, padding: px(40), display: "flex", flexDirection: "column", height: "100%", width: "70%" }}>
          {logoEl && <div style={{ marginBottom: px(16) }}>{logoEl}</div>}
          <div style={titleStyle("#fff")}>{content.title || "Event Title"}</div>
          {content.subtitle && (
            <div style={{ fontSize: px(style.subtitle_size || 26), color: "rgba(255,255,255,0.9)", fontStyle: "italic", marginTop: px(14) }}>
              {content.subtitle}
            </div>
          )}
          {tagRow("#fff")}
          {descBlock("rgba(255,255,255,0.85)")}
          {host && (
            <div style={{ marginTop: px(20) }}>
              <div style={{ fontSize: px(11), fontWeight: 700, letterSpacing: "0.06em", color: gold, textTransform: "uppercase" }}>
                {host.title ? "Featured Speaker" : "Host"}
              </div>
              <div style={{ fontFamily: displayFont || "Georgia, serif", fontSize: px(28), fontWeight: 700, color: "#fff", marginTop: px(2) }}>
                {host.name}
              </div>
            </div>
          )}
          <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end" }}>
            <div style={{ ...ctaStyle(gold), background: "rgba(0,0,0,0.4)", padding: `${px(8)}px ${px(14)}px`, borderRadius: px(6) }}>
              {content.cta || "Call to action"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Canvas: full-bleed photo/gradient, floating center panel, bottom CTA bar ---
  if (layout === "canvas") {
    const bgLayer = backgroundImageUrl
      ? { backgroundImage: `url(${backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: brandGradientCss };
    return (
      <div style={{ ...wrapStyle, ...bgLayer }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: px(28), display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: px(12) }}>
          <div>
            <div style={{ ...titleStyle("#fff"), fontSize: px((style.title_size || 70) * 0.85), textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
              {content.title || "Event Title"}
            </div>
            {content.subtitle && (
              <div style={{ fontFamily: accentFont || "cursive", fontSize: px(style.subtitle_size || 48), color: gold, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
                {content.subtitle}
              </div>
            )}
          </div>
          {logoEl}
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "70%",
            background: `${primary}e0`,
            border: `2px solid ${gold}`,
            padding: px(24),
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: accentFont || "cursive", fontSize: px(30), color: gold }}>Save the Date</div>
          {content.date && <div style={{ fontSize: px(18), fontWeight: 700, color: "#fff", marginTop: px(8) }}>{content.date}</div>}
          {content.location && <div style={{ fontSize: px(14), color: "rgba(255,255,255,0.9)", marginTop: px(4) }}>{content.location}</div>}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: primary, borderTop: `${px(4)}px solid ${gold}`, padding: px(16), textAlign: "center" }}>
          <div style={ctaStyle(gold)}>{content.cta || "Call to action"}</div>
        </div>
      </div>
    );
  }

  // --- Showcase: centered title over full-bleed photo/gradient, footer CTA ---
  const bgLayer = backgroundImageUrl
    ? { backgroundImage: `linear-gradient(${primary}99, ${primary}cc), url(${backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: brandGradientCss };
  return (
    <div style={{ ...wrapStyle, ...bgLayer }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: px(36), textAlign: "center" }}>
        {logoEl && <div style={{ marginBottom: px(16) }}>{logoEl}</div>}
        <div style={{ ...titleStyle("#fff"), textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{content.title || "Event Title"}</div>
        {content.subtitle && (
          <div style={{ fontFamily: accentFont || "cursive", fontSize: px(style.subtitle_size || 44), color: gold, marginTop: px(6) }}>
            {content.subtitle}
          </div>
        )}
        {tagRow("#fff")}
        {descBlock("rgba(255,255,255,0.88)")}
        {(host || speakers.length > 0) && (
          <div style={{ display: "flex", justifyContent: "center", gap: px(20), flexWrap: "wrap", marginTop: px(20) }}>
            {host && <div style={{ color: "#fff" }}>{personCircle(host, 110, { ribbon: "HOST" })}</div>}
            {speakers.map((sp, i) => (
              <div key={i} style={{ color: "#fff" }}>
                {personCircle(sp, 110, { ribbon: "SPEAKER" })}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: "0 0 auto", background: primary, borderTop: `${px(4)}px solid ${gold}`, padding: `${px(16)}px ${px(40)}px`, textAlign: "center" }}>
        <div style={ctaStyle(gold)}>{content.cta || "Call to action"}</div>
      </div>
    </div>
  );
};

export default FlyerPreviewCanvas;
