// Spread onto a <div>/<span> that has an onClick so it's also keyboard-
// operable (WCAG 2.1.1) and announced as a button (4.1.2) — without
// changing it into a real <button>, which would sometimes break layout
// (e.g. a div acting as a table row or a flex container around other
// interactive children). Pass disabled to omit all of it, matching how
// the caller already guards the onClick itself.
export const clickableDivProps = (onClick, { disabled = false } = {}) => {
  if (disabled) return {};
  return {
    role: "button",
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(e);
      }
    },
  };
};
