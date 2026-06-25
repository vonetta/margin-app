import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FlyerStyleWizard from "./FlyerStyleWizard";

jest.mock("../api/client", () => ({
  post: jest.fn(),
  delete: jest.fn().mockResolvedValue({}),
}));
const client = require("../api/client");

const initialStyle = {
  title_size: 70,
  subtitle_size: 48,
  description_visible: true,
  description_size: 18,
  tags_visible: true,
  host_photo_size: 230,
  speaker_photo_size: 170,
  cta_size: 34,
  logo_size: 84,
  logo_placement: "top-left",
  color_variant: "brand",
  display_font: null,
  body_font: null,
  accent_font: null,
};

const content = {
  title: "Test Event",
  subtitle: "A Subtitle",
  description: "A description.",
  theme_tags: ["Tag1"],
};

const branding = {
  colors: { primary: "#03293F", accent: "#EA8A8B", gold: "#DAAE4F" },
};

beforeEach(() => {
  client.post.mockReset();
  client.delete.mockReset().mockResolvedValue({});
});

test("the Sizing section shows every control at once and accumulates changes into one onComplete call", () => {
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Sizing"));

  // No Next/Back — every slider for this event's actual content is visible
  // in the same panel at once.
  const sliders = screen.getAllByRole("slider");
  expect(sliders.length).toBe(4); // title, subtitle, description, cta

  fireEvent.change(sliders[0], { target: { value: "90" } });
  fireEvent.change(sliders[3], { target: { value: "44" } });
  fireEvent.click(screen.getAllByText("Hide")[0]);

  fireEvent.click(screen.getByText("✦ Generate flyer"));

  const [sentStyle, sentBackgroundUrl] = onComplete.mock.calls[0];
  expect(sentStyle.title_size).toBe(90);
  expect(sentStyle.cta_size).toBe(44);
  expect(sentBackgroundUrl).toBeNull();
});

test("skips the subtitle slider when the event has no subtitle text", () => {
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={{ title: "Test Event" }}
      branding={branding}
      platform="Instagram"
      hasSubtitle={false}
      hasDescription={false}
      hasTags={false}
      onComplete={() => {}}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Sizing"));
  // Only title_size and cta_size remain when nothing else exists to control.
  expect(screen.getAllByRole("slider").length).toBe(2);
});

test("lets the user generate, accept, and use a background image", async () => {
  client.post.mockResolvedValue({
    data: { _id: "bg1", url: "https://r2.dev/candidate.png" },
  });
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("✦ Generate an image"));
  await waitFor(() => expect(client.post).toHaveBeenCalledWith(
    "/api/flyers/background-preview",
    expect.objectContaining({ topic_hint: expect.stringContaining("Test Event") }),
  ));

  fireEvent.click(await screen.findByText("✓ Use this"));

  fireEvent.click(screen.getByText("✦ Generate flyer"));
  const [, sentBackgroundUrl] = onComplete.mock.calls[0];
  expect(sentBackgroundUrl).toBe("https://r2.dev/candidate.png");
});

test("deletes a rejected candidate when the user tries another", async () => {
  client.post
    .mockResolvedValueOnce({ data: { _id: "bg1", url: "https://r2.dev/first.png" } })
    .mockResolvedValueOnce({ data: { _id: "bg2", url: "https://r2.dev/second.png" } });

  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={() => {}}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("✦ Generate an image"));
  fireEvent.click(await screen.findByText("Try another"));
  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/backgrounds/bg1"));
  await waitFor(() => expect(client.post).toHaveBeenCalledTimes(2));
});

test("lets the user pick a color variant derived from brand colors", () => {
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Colors"));
  fireEvent.click(screen.getByText("Warm"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].color_variant).toBe("warm");
});

test("lets the user pick one of the ministry's curated fonts", () => {
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      typeSystemFonts={[
        { name: "Cinzel", roles: ["display"], google_font: true },
        { name: "Poppins", roles: ["display"], google_font: true },
      ]}
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Typography"));
  fireEvent.click(screen.getByText("Poppins"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].display_font).toBe("Poppins");
});

test("only shows the Logo section when the ministry has a logo", () => {
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(screen.queryByText("Logo")).not.toBeInTheDocument();
});

test("lets the user change logo size and placement when a logo exists", () => {
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={{ ...branding, logo_url: "https://r2.dev/logo.png" }}
      platform="Instagram"
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Logo"));
  fireEvent.click(screen.getByText("In the footer"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].logo_placement).toBe("footer");
});
