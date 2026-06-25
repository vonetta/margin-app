import React, { useMemo, useState } from "react";
import FlyerPreviewCanvas from "./FlyerPreviewCanvas";

// Mirrors src/services/layouts/styleSchema.js on the backend — kept in sync
// manually since the wizard needs human-readable labels/steps the backend
// schema doesn't carry. The backend re-validates/clamps everything
// regardless, so a mismatch here can't produce a broken flyer, just a
// slider that doesn't quite match the server's range.
const FIELDS = {
  title_size: { label: "Title size", min: 40, max: 96, step: 2, unit: "px" },
  subtitle_size: { label: "Subtitle size", min: 24, max: 64, step: 2, unit: "px" },
  description_size: { label: "Description size", min: 14, max: 24, step: 1, unit: "px" },
  tags_visible: { label: "Show theme tags" },
  description_visible: { label: "Show description" },
  cta_size: { label: "Call-to-action size", min: 24, max: 48, step: 2, unit: "px" },
};

const cardStyle = {
  background: "var(--white)",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius-lg)",
  padding: "28px",
  width: "320px",
};

const FlyerStyleWizard = ({
  initialStyle,
  content,
  branding,
  platform,
  hasDescription,
  hasTags,
  onComplete,
  onCancel,
}) => {
  const [style, setStyle] = useState(initialStyle);
  const [stepIndex, setStepIndex] = useState(0);

  // Build the step list once: skip description/tags steps entirely when
  // there's nothing for them to control, since toggling visibility for
  // content that doesn't exist isn't a meaningful choice.
  const steps = useMemo(() => {
    const list = ["title_size", "subtitle_size"];
    if (hasDescription) list.push("description_visible", "description_size");
    if (hasTags) list.push("tags_visible");
    list.push("cta_size");
    return list;
  }, [hasDescription, hasTags]);

  const stepKey = steps[stepIndex];
  const field = FIELDS[stepKey];
  const isLast = stepIndex === steps.length - 1;
  const isBoolean = stepKey === "tags_visible" || stepKey === "description_visible";

  const handleNext = () => {
    if (isLast) {
      onComplete(style);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleBack = () => setStepIndex((i) => Math.max(0, i - 1));

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
        />

        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              color: "var(--gray-500)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "6px",
            }}
          >
            Step {stepIndex + 1} of {steps.length}
          </div>
          <div
            style={{
              fontFamily: "Cinzel, serif",
              fontSize: "16px",
              fontWeight: "500",
              color: "var(--navy)",
              marginBottom: "20px",
            }}
          >
            {field.label}
          </div>

          {isBoolean ? (
            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              <button
                onClick={() => setStyle((s) => ({ ...s, [stepKey]: true }))}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "var(--border-radius)",
                  border: `0.5px solid ${style[stepKey] ? "var(--navy)" : "var(--gray-300)"}`,
                  background: style[stepKey] ? "var(--navy)" : "transparent",
                  color: style[stepKey] ? "var(--white)" : "var(--gray-600)",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
              >
                Show
              </button>
              <button
                onClick={() => setStyle((s) => ({ ...s, [stepKey]: false }))}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "var(--border-radius)",
                  border: `0.5px solid ${!style[stepKey] ? "var(--navy)" : "var(--gray-300)"}`,
                  background: !style[stepKey] ? "var(--navy)" : "transparent",
                  color: !style[stepKey] ? "var(--white)" : "var(--gray-600)",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
              >
                Hide
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: "24px" }}>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={style[stepKey]}
                onChange={(e) =>
                  setStyle((s) => ({ ...s, [stepKey]: Number(e.target.value) }))
                }
                style={{ width: "100%" }}
              />
              <div
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: "var(--gray-600)",
                  marginTop: "8px",
                }}
              >
                {style[stepKey]}
                {field.unit}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleNext}
              style={{
                flex: 1,
                padding: "10px 16px",
                background: "var(--navy)",
                color: "var(--white)",
                border: "none",
                borderRadius: "var(--border-radius)",
                fontSize: "13px",
                fontWeight: "500",
              }}
            >
              {isLast ? "✦ Generate flyer" : "Next"}
            </button>
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: "10px 16px",
                  background: "transparent",
                  color: "var(--gray-600)",
                  border: "0.5px solid var(--gray-300)",
                  borderRadius: "var(--border-radius)",
                  fontSize: "13px",
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={onCancel}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: "var(--gray-500)",
                border: "none",
                fontSize: "13px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlyerStyleWizard;
