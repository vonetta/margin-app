import React from "react";

// A live, client-side mirror of src/services/layouts/monument.js's no-host
// composition (Content Studio's chat never collects a host/speakers, so
// that half of the real template never applies here). This is NOT a
// pixel-perfect copy of the server-rendered flyer — it's deliberately a
// simplified approximation so the wizard can update it instantly as
// sliders move, without a Puppeteer round-trip per tick. The real PNG
// always comes from the server; this is just so adjustments aren't blind.
// Mirrors src/services/layouts/shared.js's PLATFORM_DIMENSIONS — the
// preview should match the real output's aspect ratio, or sliders end up
// tuned against proportions the actual flyer won't have.
const PLATFORM_DIMENSIONS = {
  Instagram: { width: 1080, height: 1350 },
  Facebook: { width: 1200, height: 1200 },
  "Quote card": { width: 1080, height: 1080 },
  Email: { width: 1200, height: 628 },
};

const CANVAS_WIDTH = 320;

const FlyerPreviewCanvas = ({ content = {}, style = {}, branding = {}, platform = null }) => {
  const colors = branding.colors || {};
  const primary = colors.primary || "#1a1a2e";
  const accent = colors.accent || "#e94560";
  const gold = colors.gold || "#f5a623";
  const bg = colors.background || "#ffffff";

  const realDims = PLATFORM_DIMENSIONS[platform] || { width: 1080, height: 1350 };
  const SCALE = CANVAS_WIDTH / realDims.width;
  const CANVAS_HEIGHT = Math.round(realDims.height * SCALE);

  const px = (n) => Math.max(6, Math.round(n * SCALE));

  const metaItems = [
    content.date && { icon: "📅", value: content.date },
    content.location && { icon: "📍", value: content.location },
    content.cost && { icon: "💰", value: content.cost },
  ].filter(Boolean);

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
          flex: "0 0 auto",
          minHeight: px(260),
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "44%",
            borderLeft: `${px(6)}px solid ${gold}`,
            background: `radial-gradient(circle at 25% 15%, rgba(255,255,255,0.18), transparent 45%), linear-gradient(165deg, ${primary}, ${accent}, ${gold})`,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "58%",
            padding: `${px(48)}px ${px(56)}px`,
          }}
        >
          <div
            style={{
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
                fontFamily: "cursive",
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
                marginTop: px(18),
                fontSize: px(13),
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: primary,
                textTransform: "uppercase",
              }}
            >
              {content.theme_tags.join(" • ")}
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
            <div style={{ marginTop: px(16), display: "flex", flexDirection: "column", gap: px(4) }}>
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
          flex: 1,
          background: primary,
          borderTop: `${px(4)}px solid ${gold}`,
          display: "flex",
          alignItems: "center",
          padding: `0 ${px(56)}px`,
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: px(style.cta_size || 34),
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
