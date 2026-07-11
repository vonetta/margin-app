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

test("clicking Edit on a recent flyer restores its content into the form, leaving date/time/rsvp_by blank", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/people") return Promise.resolve({ data: [] });
    if (url === "/api/flyers/layouts") return Promise.resolve({ data: [] });
    if (url === "/api/flyers") {
      return Promise.resolve({
        data: [
          {
            _id: "f1",
            title: "Pizza Party",
            subtitle: "Slimey yet satisfying",
            layout: "monument",
            engine: "ai",
            social_url: "https://example.com/f1.png",
            created_at: "2026-06-01T00:00:00Z",
            content: {
              title: "Pizza Party",
              subtitle: "Slimey yet satisfying",
              location: "123 Main St, Los Angeles, CA",
              cost: "$5",
              contact: "Vonetta 211-232-4356",
              date: "Saturday, July 18, 2026, 5:30 – 8:00 PM",
              rsvp_by: "Friday, July 17, 2026",
              theme_tags: ["kids", "fun"],
              highlights: ["Free pizza", "Games"],
            },
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<FlyerGenerator />);
  fireEvent.click(await screen.findByText("✎ Edit"));

  expect(screen.getByPlaceholderText("Worship Workshop")).toHaveValue("Pizza Party");
  expect(screen.getByPlaceholderText("123 Main St, Atlanta GA")).toHaveValue("123 Main St, Los Angeles, CA");
  expect(screen.getByLabelText("Event date")).toHaveValue("");
  expect(screen.getByLabelText("RSVP by date")).toHaveValue("");
  expect(await screen.findByText(/weren't saved in a re-editable/)).toBeInTheDocument();
});

test("blocks generation without a date, including after editing a past flyer that had one stripped", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/flyers/generate") return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });

  render(<FlyerGenerator />);
  await screen.findByText("Worship Intensive");

  fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
  expect(screen.getByText(/Generate flyer/)).toBeDisabled();

  fireEvent.click(await screen.findByText("✎ Edit"));
  expect(screen.getByLabelText("Event date")).toHaveValue("");
  expect(screen.getByText(/Generate flyer/)).toBeDisabled();

  expect(client.post).not.toHaveBeenCalledWith("/api/flyers/generate", expect.anything());
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
  fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-08-15" } });
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

    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-08-15" } });
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

describe("description, audience, theme tags, and highlights (Tier 0 fields)", () => {
  test("sends description, audience, and parsed theme_tags/highlights in the generate payload", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/generate")
        return Promise.resolve({
          data: { _id: "f-new", title: "New Flyer", layout: "monument", social_url: "https://example.com/new.png" },
        });
      return Promise.resolve({ data: {} });
    });

    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");

    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
    fireEvent.change(screen.getByPlaceholderText("A short, evocative sentence about the heart of the event"), {
      target: { value: "Step into the supernatural." },
    });
    fireEvent.change(screen.getByPlaceholderText("Worship leaders, singers, and songwriters"), {
      target: { value: "Leaders and prophetic voices" },
    });
    fireEvent.change(screen.getByPlaceholderText("Teaching, Impartation, Activation"), {
      target: { value: "Teaching,  Impartation ,Activation" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/Hands-on prophetic activation/),
      { target: { value: "Hands-on prophetic activation\n\nTime for personal ministry" } },
    );
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-08-15" } });
    fireEvent.click(screen.getByText(/Generate flyer/));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({
          description: "Step into the supernatural.",
          audience: "Leaders and prophetic voices",
          theme_tags: ["Teaching", "Impartation", "Activation"],
          highlights: ["Hands-on prophetic activation", "Time for personal ministry"],
        }),
      ),
    );
  });

  test("omits description/audience/theme_tags/highlights entirely when left blank", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/generate")
        return Promise.resolve({
          data: { _id: "f-new", title: "New Flyer", layout: "monument", social_url: "https://example.com/new.png" },
        });
      return Promise.resolve({ data: {} });
    });

    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");

    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-08-15" } });
    fireEvent.click(screen.getByText(/Generate flyer/));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({
          description: undefined,
          audience: undefined,
          theme_tags: undefined,
          highlights: undefined,
        }),
      ),
    );
  });
});

describe("kicker, time/end_time, rsvp_by, and contact (Tier 1 fields)", () => {
  test("sends kicker, start/end time, rsvp_by, and contact in the generate payload", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/generate")
        return Promise.resolve({
          data: { _id: "f-new", title: "New Flyer", layout: "monument", social_url: "https://example.com/new.png" },
        });
      return Promise.resolve({ data: {} });
    });

    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");

    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
    fireEvent.change(screen.getByPlaceholderText("Renewed — Week 3"), { target: { value: "Renewed — Week 3" } });
    fireEvent.change(screen.getByLabelText("Event start time"), { target: { value: "17:00" } });
    fireEvent.change(screen.getByLabelText("Event end time"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByLabelText("RSVP by date"), { target: { value: "2026-07-08" } });
    fireEvent.change(screen.getByPlaceholderText("Questions? Text Sarah at 555-1234"), {
      target: { value: "Questions? Text Sarah at 555-1234" },
    });
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-08-15" } });
    fireEvent.click(screen.getByText(/Generate flyer/));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({
          kicker: "Renewed — Week 3",
          time: "17:00",
          end_time: "19:00",
          rsvp_by: "2026-07-08",
          contact: "Questions? Text Sarah at 555-1234",
        }),
      ),
    );
  });

  test("omits kicker/time/end_time/rsvp_by/contact entirely when left blank", async () => {
    client.post.mockImplementation((url) => {
      if (url === "/api/flyers/generate")
        return Promise.resolve({
          data: { _id: "f-new", title: "New Flyer", layout: "monument", social_url: "https://example.com/new.png" },
        });
      return Promise.resolve({ data: {} });
    });

    render(<FlyerGenerator />);
    await screen.findByText("Worship Intensive");

    fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
    fireEvent.change(screen.getByLabelText("Event date"), { target: { value: "2026-08-15" } });
    fireEvent.click(screen.getByText(/Generate flyer/));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/flyers/generate",
        expect.objectContaining({
          kicker: undefined,
          time: undefined,
          end_time: undefined,
          rsvp_by: undefined,
          contact: undefined,
        }),
      ),
    );
  });
});
