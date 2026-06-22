const applyBranding = (branding) => {
  if (!branding) return;

  const root = document.documentElement;

  if (branding.colors) {
    if (branding.colors.primary)
      root.style.setProperty("--primary", branding.colors.primary);
    if (branding.colors.accent)
      root.style.setProperty("--accent", branding.colors.accent);
    if (branding.colors.gold)
      root.style.setProperty("--gold", branding.colors.gold);
  }

  if (branding.fonts) {
    if (branding.fonts.heading) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${branding.fonts.heading.replace(" ", "+")}:wght@400;500;600&family=${(branding.fonts.body || "Montserrat").replace(" ", "+")}:wght@300;400;500;600&display=swap`;
      document.head.appendChild(link);
      root.style.setProperty(
        "--font-heading",
        `'${branding.fonts.heading}', serif`,
      );
      root.style.setProperty(
        "--font-body",
        `'${branding.fonts.body || "Montserrat"}', sans-serif`,
      );
    }
  }
};

const resetBranding = () => {
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--accent");
  root.style.removeProperty("--gold");
  root.style.removeProperty("--font-heading");
  root.style.removeProperty("--font-body");
};

export { applyBranding, resetBranding };
