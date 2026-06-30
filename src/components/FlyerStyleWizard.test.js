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
  logo_backing: "none",
  color_variant: "brand",
  gradient_angle: 165,
  gradient_overlay_opacity: 0,
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

  fireEvent.click(screen.getByText("Background"));
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

  fireEvent.click(screen.getByText("Background"));
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
  fireEvent.click(screen.getByText("Triad"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].color_variant).toBe("triad");
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
  fireEvent.click(screen.getByText("Footer, by the QR code"));
  fireEvent.click(screen.getByText("White pill"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].logo_placement).toBe("footer-right");
  expect(onComplete.mock.calls[0][0].logo_backing).toBe("pill");
});

test("always offers accent font suggestions, even when the ministry has none curated", () => {
  const onComplete = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      typeSystemFonts={[{ name: "Cinzel", roles: ["display"], google_font: true }]}
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Typography"));
  expect(screen.getByText("Great Vibes")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Great Vibes"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].accent_font).toBe("Great Vibes");
});

test("lets the user adjust the gradient direction", () => {
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
  fireEvent.change(screen.getByRole("slider"), { target: { value: "60" } });
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].gradient_angle).toBe(60);
});

test("lets the user dial in a gradient overlay once a background image is accepted", async () => {
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

  // No overlay control before there's an image to overlay onto.
  expect(screen.queryByText(/Brand gradient on top/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByText("Background"));
  fireEvent.click(screen.getByText("✦ Generate an image"));
  fireEvent.click(await screen.findByText("✓ Use this"));

  expect(screen.getByText(/Brand gradient on top/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider"), { target: { value: "40" } });
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  expect(onComplete.mock.calls[0][0].gradient_overlay_opacity).toBe(40);
});

test("lets the user pick a layout, host, and speakers; forwards them on complete", () => {
  const onComplete = jest.fn();
  const onLayoutChange = jest.fn();
  const onHostChange = jest.fn();
  const onSpeakersChange = jest.fn();
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      layouts={[
        { id: "monument", name: "Monument", description: "Host beside title" },
        { id: "feature", name: "Feature", description: "Single headliner" },
      ]}
      people={[
        { _id: "p1", name: "Apostle Khy", title: "Apostle" },
        { _id: "p2", name: "Jordan Franco", title: "Speaker" },
      ]}
      selectedLayout="auto"
      onLayoutChange={onLayoutChange}
      hostId=""
      onHostChange={onHostChange}
      speakerIds={[]}
      onSpeakersChange={onSpeakersChange}
      hasSubtitle
      hasDescription
      hasTags
      onComplete={onComplete}
      onCancel={() => {}}
    />,
  );

  // Layout is the default opening section.
  expect(screen.getByText("Monument")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Feature"));
  expect(onLayoutChange).toHaveBeenCalledWith("feature");

  fireEvent.click(screen.getByText("Host & Speakers"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "p1" } });
  expect(onHostChange).toHaveBeenCalledWith("p1");

  const matches = screen.getAllByText("Jordan Franco — Speaker");
  fireEvent.click(matches[matches.length - 1]);
  expect(onSpeakersChange).toHaveBeenCalledWith(["p2"]);
});

test("shows a friendly message in Host & Speakers when the roster is empty", () => {
  render(
    <FlyerStyleWizard
      initialStyle={initialStyle}
      content={content}
      branding={branding}
      platform="Instagram"
      people={[]}
      hasSubtitle
      hasDescription
      hasTags
      onComplete={() => {}}
      onCancel={() => {}}
    />,
  );

  fireEvent.click(screen.getByText("Host & Speakers"));
  expect(screen.getByText(/No one in the roster yet/)).toBeInTheDocument();
});

test("the live preview canvas actually reflects the selectedLayout prop, not always the same layout", () => {
  const props = {
    initialStyle,
    content,
    branding,
    platform: "Instagram",
    layouts: [
      { id: "monument", name: "Monument", description: "Host beside title" },
      { id: "canvas", name: "Canvas", description: "Full-bleed venue photo" },
    ],
    onLayoutChange: () => {},
    hasSubtitle: true,
    hasDescription: true,
    hasTags: true,
    onComplete: () => {},
    onCancel: () => {},
  };

  const { rerender } = render(<FlyerStyleWizard {...props} selectedLayout="auto" />);
  // "auto" with no host/speakers resolves to monument — no "Save the Date"
  // panel, which is canvas's distinguishing element.
  expect(screen.queryByText("Save the Date")).not.toBeInTheDocument();

  rerender(<FlyerStyleWizard {...props} selectedLayout="canvas" />);
  expect(screen.getByText("Save the Date")).toBeInTheDocument();
});
