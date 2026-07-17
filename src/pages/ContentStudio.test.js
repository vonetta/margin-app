import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContentStudio from "./ContentStudio";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
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

const finalizeChatResponseWithTone = {
  data: {
    ...finalizeChatResponse.data,
    tone: "energetic",
  },
};

const finalizeChatResponseWithTier1Fields = {
  data: {
    ...finalizeChatResponse.data,
    event: {
      ...finalizeChatResponse.data.event,
      kicker: "Renewed — Week 3",
      rsvp_by: "July 8",
      contact: "Questions? Text Sarah at 555-1234",
    },
  },
};

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
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

test("threads kicker, rsvp_by, and contact from the chat-drafted event through to flyer generation", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponseWithTier1Fields);
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

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/flyers/generate",
      expect.objectContaining({
        kicker: "Renewed — Week 3",
        rsvp_by: "July 8",
        contact: "Questions? Text Sarah at 555-1234",
      }),
    ),
  );
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

test("picking AI Studio sends engine: ai and skips the layout field", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponse);
    if (url === "/api/flyers/generate")
      return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
    return Promise.resolve({ data: {} });
  });

  render(<ContentStudio />);

  fireEvent.change(screen.getByText("Flyer engine").parentElement.querySelector("select"), {
    target: { value: "ai" },
  });

  const textarea = screen.getByPlaceholderText(
    "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided...",
  );
  fireEvent.change(textarea, { target: { value: "Worship Intensive" } });
  fireEvent.click(screen.getByText("✦ Start"));

  await screen.findAllByText("Final caption");

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/flyers/generate",
      expect.objectContaining({ engine: "ai", layout: undefined }),
    ),
  );
});

describe("tone-aware flyer generation", () => {
  const withToneOptions = (url) => {
    if (url === "/api/flyers/infer-tone") return Promise.resolve({ data: { tone: null, options: ["formal", "energetic"] } });
    return null;
  };

  test("threads the AI-proposed tone through to the auto-generated flyer", async () => {
    client.post.mockImplementation((url) => {
      const opts = withToneOptions(url);
      if (opts) return opts;
      if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponseWithTone);
      if (url === "/api/flyers/generate")
        return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
      return Promise.resolve({ data: {} });
    });

    render(<ContentStudio />);
    const textarea = screen.getByPlaceholderText(
      "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided...",
    );
    fireEvent.change(textarea, { target: { value: "Pizza Night" } });
    fireEvent.click(screen.getByText("✦ Start"));

    await screen.findAllByText("Final caption");

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({ tone: "energetic" }),
      ),
    );
  });

  test("shows a visible, editable tone control pre-filled with the detected tone", async () => {
    client.post.mockImplementation((url) => {
      const opts = withToneOptions(url);
      if (opts) return opts;
      if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponseWithTone);
      if (url === "/api/flyers/generate")
        return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
      return Promise.resolve({ data: {} });
    });

    render(<ContentStudio />);
    const textarea = screen.getByPlaceholderText(
      "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided...",
    );
    fireEvent.change(textarea, { target: { value: "Pizza Night" } });
    fireEvent.click(screen.getByText("✦ Start"));

    await screen.findAllByText("Final caption");
    await screen.findByAltText("Generated flyer");

    expect(screen.getByText(/detected: energetic/)).toBeInTheDocument();
    const select = document.getElementById("content-studio-tone");
    expect(select.value).toBe("energetic");
  });

  test("changing the tone dropdown regenerates the flyer with the new value", async () => {
    client.post.mockImplementation((url) => {
      const opts = withToneOptions(url);
      if (opts) return opts;
      if (url === "/api/content/chat") return Promise.resolve(finalizeChatResponseWithTone);
      if (url === "/api/flyers/generate")
        return Promise.resolve({ data: { social_url: "https://r2.dev/flyer.png" } });
      return Promise.resolve({ data: {} });
    });

    render(<ContentStudio />);
    const textarea = screen.getByPlaceholderText(
      "Worship Workshop, July 20, 12pm - 6pm, $100, lunch provided...",
    );
    fireEvent.change(textarea, { target: { value: "Pizza Night" } });
    fireEvent.click(screen.getByText("✦ Start"));

    await screen.findAllByText("Final caption");
    await screen.findByAltText("Generated flyer");

    client.post.mockClear();
    fireEvent.change(document.getElementById("content-studio-tone"), { target: { value: "formal" } });

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({ tone: "formal" }),
      ),
    );
  });

  test("does not render a tone control when the ministry has no defined tone categories", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/infer-tone")
        return Promise.resolve({ data: { tone: null, options: [] } });
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

    expect(document.getElementById("content-studio-tone")).toBeNull();
  });
});

test("shows an error if approving a queued draft fails", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { type_system: { fonts: [] } } });
    if (url === "/api/content/drafts") {
      return Promise.resolve({
        data: [
          {
            _id: "d1",
            platform: "Instagram",
            caption: "Join us Sunday!",
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.post.mockResolvedValue({ data: { options: [] } });
  client.put.mockRejectedValue({ response: { data: { error: "Draft was already handled" } } });

  render(<ContentStudio />);
  fireEvent.click(await screen.findByText(/Draft queue/));

  fireEvent.click(await screen.findByText("✓ Approve & queue"));

  expect(await screen.findByText("Draft was already handled")).toBeInTheDocument();
});

test("shows an error if rejecting a queued draft fails", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { type_system: { fonts: [] } } });
    if (url === "/api/content/drafts") {
      return Promise.resolve({
        data: [
          {
            _id: "d1",
            platform: "Instagram",
            caption: "Join us Sunday!",
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.post.mockResolvedValue({ data: { options: [] } });
  client.put.mockRejectedValue(new Error("network error"));

  render(<ContentStudio />);
  fireEvent.click(await screen.findByText(/Draft queue/));

  fireEvent.click(await screen.findByText("✕ Reject"));

  expect(await screen.findByText("Failed to reject this draft")).toBeInTheDocument();
});
