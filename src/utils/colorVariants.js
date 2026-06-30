// Client-side mirror of src/services/layouts/shared.js's deriveColorVariants
// on the backend — duplicated rather than shared across repos, same as
// PLATFORM_DIMENSIONS in FlyerPreviewCanvas.js. Used only to render the
// live preview; the real flyer always re-derives these server-side from
// style.color_variant, so a mismatch here can't produce a wrong flyer,
// just a preview swatch that doesn't quite match.
const hexToHsl = (hex) => {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h2 = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h2 = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h2 = ((b - r) / d + 2) * 60;
    else h2 = ((r - g) / d + 4) * 60;
  }
  return { h: h2, s, l };
};

const hslToHex = ({ h, s, l }) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Re-hue a color to a target hue while keeping its OWN saturation/lightness
// — so a derived accent/gold stays as vivid as the real one, instead of
// inheriting primary's much darker, more muted tone.
const rehueTo = (hex, targetHue) => {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, h: ((targetHue % 360) + 360) % 360 });
};

export const COLOR_VARIANT_LABELS = {
  brand: "Brand",
  triad: "Triad",
  complementary: "Complementary",
  accent_swap: "Gold-forward",
};

export const deriveColorVariants = (colors = {}) => {
  const primary = colors.primary || "#1a1a2e";
  const accent = colors.accent || "#e94560";
  const gold = colors.gold || "#f5a623";
  const primaryHue = hexToHsl(primary).h;
  return {
    brand: { primary, accent, gold },
    triad: {
      primary,
      accent: rehueTo(accent, primaryHue + 120),
      gold: rehueTo(gold, primaryHue + 240),
    },
    complementary: {
      primary,
      accent: rehueTo(accent, primaryHue + 180),
      gold: rehueTo(gold, primaryHue + 150),
    },
    accent_swap: { primary, accent: gold, gold: accent },
  };
};
