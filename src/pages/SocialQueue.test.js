import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SocialQueue from "./SocialQueue";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

beforeEach(() => {
  client.get.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  client.get.mockImplementation((url) => {
    if (url === "/api/social/accounts") {
      return Promise.resolve({
        data: [
          { _id: "acct1", page_name: "KTM Page", instagram_username: "ktm_ministries" },
        ],
      });
    }
    if (url === "/api/social-posts") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
});

test("lists pending posts and lets an admin pick targets, schedule, and approve", async () => {
  client.get.mockImplementation((url, opts) => {
    if (url === "/api/social/accounts") {
      return Promise.resolve({
        data: [{ _id: "acct1", page_name: "KTM Page", instagram_username: "ktm_ministries" }],
      });
    }
    if (url === "/api/social-posts") {
      return Promise.resolve({
        data: [
          {
            _id: "post1",
            caption: "Join us Sunday!",
            graphic_urls: ["https://example.com/flyer.png"],
            status: "pending_approval",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<SocialQueue />);

  expect(await screen.findByText("Join us Sunday!")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Review & approve"));

  fireEvent.click(await screen.findByText(/KTM Page \(Facebook\)/));
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-08-01" } });
  fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: "10:00" } });

  fireEvent.click(screen.getByText("Approve & schedule"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/social-posts/post1/approve",
      expect.objectContaining({
        targets: [{ social_account_id: "acct1", platform: "facebook" }],
      }),
    ),
  );
});

test("rejecting a post requires a confirm step", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/social/accounts") return Promise.resolve({ data: [] });
    if (url === "/api/social-posts") {
      return Promise.resolve({
        data: [{ _id: "post1", caption: "x", graphic_urls: [], status: "pending_approval" }],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<SocialQueue />);
  await screen.findByText("x");

  fireEvent.click(screen.getByText("Reject"));
  expect(client.put).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Confirm reject"));
  await waitFor(() => expect(client.put).toHaveBeenCalledWith("/api/social-posts/post1/reject"));
});

test("shows per-target results on a posted item", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/social/accounts") return Promise.resolve({ data: [] });
    if (url === "/api/social-posts") {
      return Promise.resolve({
        data: [
          {
            _id: "post1",
            caption: "x",
            graphic_urls: [],
            status: "posted",
            post_results: [
              { platform: "facebook", status: "success" },
              { platform: "instagram", status: "failed", error: "Invalid token" },
            ],
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<SocialQueue />);
  fireEvent.click(screen.getByText("Posted"));

  expect(await screen.findByText(/facebook/)).toBeInTheDocument();
  expect(screen.getByText(/instagram — Invalid token/)).toBeInTheDocument();
});
