import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContentStudio from "./ContentStudio";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    switchMinistry: jest.fn(),
    ministry: { branding: { colors: { primary: "#03293F", accent: "#EA8A8B", gold: "#DAAE4F" } } },
  }),
}));

const finalizeChatResponse = {
  data: {
    done: true,
    caption: "Final caption",
    event: { title: "Worship Intensive", theme_tags: ["Worship"] },
    style: {
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
    },
    messages: [
      { role: "user", content: "Worship Intensive" },
      { role: "assistant", content: "Final caption" },
    ],
  },
};

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { type_system: { fonts: [] } } });
    if (url === "/api/people") return Promise.resolve({ data: [] });
    if (url === "/api/flyers/layouts")
      return Promise.resolve({
        data: [
          { id: "monument", name: "Monument", description: "Host beside title" },
          { id: "canvas", name: "Canvas", description: "Full-bleed venue photo" },
        ],
      });
    return Promise.resolve({ data: [] });
  });
});

test("generates the matching flyer automatically as soon as the caption finalizes", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponse);
    if (url === "/api/flyers/generate")
      return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
    return Promise.resolve({ data: {} });
  });

  render(<ContentStudio />);

  const textarea = screen.getByPlaceholderText(
    "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided...",
  );
  fireEvent.change(textarea, { target: { value: "Worship Intensive" } });
  fireEvent.click(screen.getByText("✦ Start"));

  await screen.findAllByText("Final caption");

  // No extra click needed — the flyer generates alongside the caption.
  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/flyers/generate",
      expect.objectContaining({ title: "Worship Intensive" }),
    ),
  );
  await screen.findByAltText("Generated flyer");
});

test("sends the wizard's chosen layout through to the actual flyer-generation request", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponse);
    if (url === "/api/flyers/generate")
      return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
    return Promise.resolve({ data: {} });
  });

  render(<ContentStudio />);

  const textarea = screen.getByPlaceholderText(
    "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided...",
  );
  fireEvent.change(textarea, { target: { value: "Worship Intensive" } });
  fireEvent.click(screen.getByText("✦ Start"));

  await screen.findAllByText("Final caption");
  await screen.findByAltText("Generated flyer");

  // The flyer already auto-generated, so this reopens the wizard to adjust it.
  fireEvent.click(screen.getByText("↺ Adjust styling"));

  // Layout is the wizard's default opening section.
  fireEvent.click(await screen.findByText("Canvas"));
  fireEvent.click(screen.getByText("✦ Generate flyer"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/flyers/generate",
      expect.objectContaining({ layout: "canvas" }),
    ),
  );
});

test("does not auto-generate a flyer when the user uploaded one they already made", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/content/extract-flyer") {
      return Promise.resolve({ data: { title: "Worship Intensive", date: "August 15" } });
    }
    if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponse);
    if (url === "/api/flyers/generate")
      return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
    return Promise.resolve({ data: {} });
  });

  render(<ContentStudio />);

  const file = new File(["fake"], "flyer.png", { type: "image/png" });
  const fileInput = document.querySelector('input[type="file"]');
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith("/api/content/extract-flyer", expect.anything(), expect.anything()),
  );

  fireEvent.click(screen.getByText("✦ Start"));
  await screen.findAllByText("Final caption");

  // Give any (incorrect) auto-generation a chance to fire before asserting it didn't.
  await new Promise((r) => setTimeout(r, 0));
  expect(client.post).not.toHaveBeenCalledWith("/api/flyers/generate", expect.anything());
});
