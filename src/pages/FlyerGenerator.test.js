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
    if (url === "/api/social-posts") return Promise.resolve({ data: { _id: "sp1" } });
    return Promise.resolve({ data: {} });
  });

  render(<FlyerGenerator />);
  await screen.findByText("Worship Intensive");

  fireEvent.change(screen.getByPlaceholderText("Worship Workshop"), { target: { value: "New Flyer" } });
  fireEvent.click(screen.getByText(/Generate flyer/));

  fireEvent.click(await screen.findByText("⌘ Post to social"));
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

test("deleting a flyer requires a confirm step before the DELETE call fires", async () => {
  client.delete.mockResolvedValue({ data: { deleted: true } });

  render(<FlyerGenerator />);
  await screen.findByText("Worship Intensive");

  fireEvent.click(screen.getByText("✕ Delete"));
  expect(client.delete).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Confirm"));
  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/flyers/f1"));
});
