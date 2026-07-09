import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FlyerGenerator from "./FlyerGenerator";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.delete.mockReset();
  client.get.mockImplementation((url) => {
    if (url === "/api/people") return Promise.resolve({ data: [] });
    if (url === "/api/flyers/layouts") return Promise.resolve({ data: [] });
    if (url === "/api/flyers") {
      return Promise.resolve({
        data: [
          {
            _id: "f1",
            title: "Worship Intensive",
            layout: "monument",
            social_url: "https://example.com/f1.png",
            created_at: "2026-06-01T00:00:00Z",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
});

test("shows recent flyers fetched from the history endpoint", async () => {
  render(<FlyerGenerator />);

  expect(await screen.findByText("Recent flyers")).toBeInTheDocument();
  expect(await screen.findByText("Worship Intensive")).toBeInTheDocument();
});

test("shows an empty state when there is no flyer history", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/flyers") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });

  render(<FlyerGenerator />);

  expect(await screen.findByText("No flyers generated yet.")).toBeInTheDocument();
});

test("preparing a social post from a generated flyer sends the caption and graphic to the queue", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/flyers/generate") {
      return Promise.resolve({
        data: { _id: "f-new", title: "New Flyer", layout: "monument", social_url: "https://example.com/new.png" },
      });
    }
    if (url === "/api/flyers/f-new/generate-caption") {
      return Promise.resolve({ data: { caption: "AI-drafted caption" } });
    }
    if (url === "/api/social-posts") return Promise.resolve({ data: { _id: "sp1" } });
    return Promise.resolve({ data: {} });
  });

  render(<FlyerGenerator />);
  await screen.findByText("Worship Intensive");

  fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
  fireEvent.click(screen.getByText(/Generate flyer/));

  fireEvent.click(await screen.findByText("⌘ Post to social"));

  // Opening the form auto-drafts a caption in the ministry's AI voice
  // instead of starting from a blank textarea.
  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith("/api/flyers/f-new/generate-caption", {}),
  );
  await screen.findByDisplayValue("AI-drafted caption");

  fireEvent.change(screen.getByPlaceholderText("Caption for this post..."), {
    target: { value: "Come join us!" },
  });
  fireEvent.click(screen.getByText("Send for approval"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith("/api/social-posts", {
      flyer_id: "f-new",
      caption: "Come join us!",
      graphic_urls: ["https://example.com/new.png"],
      post_type: "image",
    }),
  );

  expect(await screen.findByText(/Sent to the social queue/)).toBeInTheDocument();
});

test("disables the collage layout until a host or speaker photo is selected", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/people") {
      return Promise.resolve({
        data: [{ _id: "p1", name: "Jane Host", headshot_url: "https://example.com/jane.jpg" }],
      });
    }
    if (url === "/api/flyers/layouts") {
      return Promise.resolve({
        data: [
          { id: "monument", name: "Monument", description: "Host + speakers" },
          { id: "collage", name: "Collage", description: "Scattered photo cards" },
        ],
      });
    }
    if (url === "/api/flyers") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });

  render(<FlyerGenerator />);

  const collageOption = await screen.findByText("Collage");
  expect(
    screen.getByText("Add a host or speaker photo to unlock this layout"),
  ).toBeInTheDocument();

  fireEvent.click(collageOption);
  // Still shows the locked hint — selecting it should have been a no-op.
  expect(
    screen.getByText("Add a host or speaker photo to unlock this layout"),
  ).toBeInTheDocument();

  fireEvent.change(document.querySelector("select"), {
    target: { value: "p1" },
  });

  expect(await screen.findByText("Scattered photo cards")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Collage"));
  expect(screen.getByText("Scattered photo cards")).toBeInTheDocument();
});

test("deleting a flyer requires a confirm step before the DELETE call fires", async () => {
  client.delete.mockResolvedValue({ data: { deleted: true } });

  render(<FlyerGenerator />);
  await screen.findByText("Worship Intensive");

  fireEvent.click(screen.getByText("✕ Delete"));
  expect(client.delete).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Confirm"));
  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/flyers/f1"));
});

describe("tone suggestion (manual entry)", () => {
  test("does not show a tone control before the ministry's own categories are known", async () => {
    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");
    expect(document.getElementById("flyer-tone")).toBeNull();
  });

  test("suggests a tone from the title after a debounce, and includes it in the generate payload", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/infer-tone")
        return Promise.resolve({ data: { tone: "energetic", options: ["formal", "energetic"] } });
      if (url === "/api/flyers/generate")
        return Promise.resolve({
          data: { _id: "f-new", title: "Pizza Night", layout: "monument", social_url: "https://example.com/new.png" },
        });
      return Promise.resolve({ data: {} });
    });

    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");

    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "Pizza Night" } });

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith("/api/flyers/infer-tone", {
        title: "Pizza Night",
        subtitle: "",
      }),
    );

    const select = await screen.findByLabelText("Tone");
    await waitFor(() => expect(select.value).toBe("energetic"));

    fireEvent.click(screen.getByText(/Generate flyer/));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({ tone: "energetic" }),
      ),
    );
  });

  test("a manually chosen tone is never overwritten by a later suggestion", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/infer-tone")
        return Promise.resolve({ data: { tone: "energetic", options: ["formal", "energetic"] } });
      return Promise.resolve({ data: {} });
    });

    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");

    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "Pizza Night" } });
    const select = await screen.findByLabelText("Tone");
    await waitFor(() => expect(select.value).toBe("energetic"));

    fireEvent.change(select, { target: { value: "formal" } });
    expect(select.value).toBe("formal");

    // Further edits to the title would otherwise re-trigger the debounced
    // suggestion — it must not clobber the user's explicit choice.
    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), {
      target: { value: "Pizza Night Extravaganza" },
    });
    await new Promise((r) => setTimeout(r, 450));
    expect(select.value).toBe("formal");
  });
});
