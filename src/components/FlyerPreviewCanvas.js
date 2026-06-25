import React, { useEffect } from "react";
import { deriveColorVariants } from "../utils/colorVariants";

// A live, client-side mirror of src/services/layouts/monument.js's no-host
// composition (Content Studio's chat never collects a host/speakers, so
// that half of the real template never applies here). This is NOT a
// pixel-perfect copy of the server-rendered flyer — it's deliberately a
// simplified approximation so the wizard can update it instantly as
// sliders/choices change, without a Puppeteer round-trip per tick. The real
// PNG always comes from the server; this is just so adjustments aren't
// blind. Mirrors monument.js's full-bleed-background + fading-scrim
// composition and percentages, not the older hard-edged side panel.
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

const FlyerPreviewCanvas = ({
  content = {},
  style = {},
  branding = {},
  platform = null,
  backgroundImageUrl = null,
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
    : {
        background: `radial-gradient(circle at 25% 15%, rgba(255,255,255,0.18), transparent 45%), linear-gradient(165deg, ${primary}, ${accent}, ${gold})`,
      };

  const logoUrl = branding.logo_url;
  const logoSize = px(style.logo_size || 84);
  const logoPlacement = style.logo_placement || "top-left";

  const logoEl = logoUrl && (
    <img
      src={logoUrl}
      alt="logo"
      style={{
        height: logoSize,
        marginBottom: px(16),
        filter: logoPlacement === "footer" ? "brightness(0) invert(1)" : "none",
      }}
    />
  );

  return (
    <div
      style={{
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
      }}
    >
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: px(260),
          ...backgroundLayer,
        }}
      >
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
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "50%",
            padding: `${px(48)}px ${px(48)}px`,
          }}
        >
          {logoPlacement !== "footer" && logoEl && (
            <div
              style={{
                textAlign: logoPlacement === "top-center" ? "center" : "left",
              }}
            >
              {logoEl}
            </div>
          )}
          <div
            style={{
              fontFamily: displayFont || "Georgia, serif",
              fontWeight: 800,
              fontSize: px(style.title_size || 70),
              lineHeight: 1.0,
              color: primary,
              textTransform: "uppercase",
            }}
          >
            {content.title || "Event Title"}
          </div>
          {content.subtitle && (
            <div
              style={{
                fontFamily: accentFont || "cursive",
                fontSize: px(style.subtitle_size || 48),
                color: accent,
                marginTop: px(8),
              }}
            >
              {content.subtitle}
            </div>
          )}
          {style.tags_visible && content.theme_tags?.length > 0 && (
            <div
              style={{
                marginTop: px(20),
                display: "flex",
                flexWrap: "wrap",
                gap: px(8),
              }}
            >
              {content.theme_tags.map((t, i) => (
                <span
                  key={i}
                  style={{
                    padding: `${px(6)}px ${px(14)}px`,
                    borderRadius: px(16),
                    border: `1.5px solid ${primary}88`,
                    fontSize: px(12),
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: primary,
                    textTransform: "uppercase",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {style.description_visible && content.description && (
            <div
              style={{
                fontSize: px(style.description_size || 18),
                lineHeight: 1.4,
                color: "rgba(0,0,0,0.7)",
                fontStyle: "italic",
                marginTop: px(16),
              }}
            >
              {content.description}
            </div>
          )}
          {content.highlights?.length > 0 && (
            <div style={{ marginTop: px(16), display: "flex", flexDirection: "column", gap: px(6) }}>
              {content.highlights.map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: px(15),
                    color: primary,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: gold, fontWeight: 700 }}>✓ </span>
                  {h}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {metaItems.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: px(20),
            padding: `${px(14)}px 0`,
            borderTop: `1px solid rgba(0,0,0,0.1)`,
            borderBottom: `1px solid rgba(0,0,0,0.1)`,
            flexWrap: "wrap",
            background: bg,
          }}
        >
          {metaItems.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: px(6),
                fontSize: px(15),
                color: primary,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: px(28),
                  height: px(28),
                  borderRadius: "50%",
                  background: primary,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: px(13),
                }}
              >
                {m.icon}
              </span>
              {m.value}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          flex: "0 0 auto",
          background: primary,
          borderTop: `${px(4)}px solid ${gold}`,
          display: "flex",
          alignItems: "center",
          gap: px(12),
          padding: `${px(18)}px ${px(48)}px`,
        }}
      >
        {logoPlacement === "footer" && logoEl}
        <div
          style={{
            fontFamily: displayFont || "Georgia, serif",
            fontWeight: 800,
            fontSize: px((style.cta_size || 34) * 0.82),
            color: gold,
            textTransform: "uppercase",
          }}
        >
          {content.cta || "Call to action"}
        </div>
      </div>
    </div>
  );
};

export default FlyerPreviewCanvas;
