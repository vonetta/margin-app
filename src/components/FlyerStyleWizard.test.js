import { render, screen, fireEvent } from "@testing-library/react";
import FlyerStyleWizard from "./FlyerStyleWizard";

const initialStyle = {
  title_size: 70,
  subtitle_size: 48,
  description_visible: true,
  description_size: 18,
  tags_visible: true,
  host_photo_size: 230,
  speaker_photo_size: 170,
  cta_size: 34,
};

const content = {
  title: "Test Event",
  subtitle: "A Subtitle",
  description: "A description.",
  theme_tags: ["Tag1"],
};

test("accumulates slider changes across every step into the final onComplete payload", () => {
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={{}}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  // Step 1: title_size
  fireEvent.change(screen.getByRole("slider"), { target: { value: "90" } });
  expect(screen.getByText(/90px/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Next"));

  // Step 2: subtitle_size — the step-1 change must still be reflected in
  // the live preview canvas after moving on, not just at the moment it
  // was made.
  // The canvas is a scaled-down miniature (480px wide vs. the real
  // 1080px-wide Instagram output), so 90px title_size becomes ~40px there
  // — confirming the canvas tracks the change at all, not a literal match.
  const scaledTitlePx = Math.round(90 * (480 / 1080));
  expect(screen.getByText("Test Event")).toHaveStyle(
    `font-size: ${scaledTitlePx}px`,
  );

  fireEvent.change(screen.getByRole("slider"), { target: { value: "60" } });
  expect(screen.getByText(/60px/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Next"));

  // Step 3: description_visible (boolean — Hide)
  fireEvent.click(screen.getByText("Hide"));
  fireEvent.click(screen.getByText("Next"));

  // Step 4: description_size
  fireEvent.change(screen.getByRole("slider"), { target: { value: "20" } });
  fireEvent.click(screen.getByText("Next"));

  // Step 5: tags_visible (boolean — Hide)
  fireEvent.click(screen.getByText("Hide"));
  fireEvent.click(screen.getByText("Next"));

  // Step 6 (last): cta_size, then Generate flyer
  fireEvent.change(screen.getByRole("slider"), { target: { value: "44" } });
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete).toHaveBeenCalledWith({
    title_size: 90,
    subtitle_size: 60,
    description_visible: false,
    description_size: 20,
    tags_visible: false,
    host_photo_size: 230,
    speaker_photo_size: 170,
    cta_size: 44,
  });
});

test("skips the subtitle size step when the event has no subtitle text", () => {
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={{ title: "Test Event" }}
      branding={{}}
      platform="Instagram"
      hasSubtitle={false}
      hasDescription={false}
      hasTags={false}
      onComplete={() => {}}
      onCancel={() => {}}
    />,
  );

  // With no subtitle/description/tags, only title_size and cta_size remain
  // — a slider that can't change anything visible on the flyer shouldn't
  // be presented as a step at all.
  expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  expect(screen.getByText("Title size")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Next"));
  expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
  expect(screen.getByText("Call-to-action size")).toBeInTheDocument();
});
