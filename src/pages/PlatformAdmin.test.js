import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PlatformAdmin from "./PlatformAdmin";

jest.mock("../api/client", () => ({
  get: jest.fn(),
}));
const client = require("../api/client");

beforeEach(() => {
  client.get.mockReset();
});

test("lists every ministry with its member count and plan", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/platform-admin/ministries") {
      return Promise.resolve({
        data: [
          { ministry_id: "ktm", name: "KTM", plan: "enterprise", member_count: 5, onboarding_complete: true },
          { ministry_id: "salt-light", name: "Salt & Light", plan: "small", member_count: 1, onboarding_complete: false, parent_ministry_id: "ktm" },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<PlatformAdmin />);

  expect(await screen.findByText("KTM")).toBeInTheDocument();
  expect(screen.getByText("Salt & Light")).toBeInTheDocument();
  expect(screen.getByText(/sub-ministry of ktm/)).toBeInTheDocument();
  expect(screen.getByText(/onboarding incomplete/)).toBeInTheDocument();
});

test("clicking a ministry loads its read-only overview", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/platform-admin/ministries") {
      return Promise.resolve({
        data: [{ ministry_id: "ktm", name: "KTM", plan: "enterprise", member_count: 1, onboarding_complete: true }],
      });
    }
    if (url === "/api/platform-admin/ministries/ktm/overview") {
      return Promise.resolve({
        data: {
          ministry: { ministry_id: "ktm", name: "KTM", plan: "enterprise" },
          team: [{ name: "Apostle Khy", email: "khy@ktm.com", role: "admin" }],
          recent_tasks: [{ title: "Set up chairs" }],
          recent_events: [{ title: "Sunday Service" }],
          recent_flyers: [{ title: "Welcome Flyer" }],
          recent_drafts: [{ subject: "Come join us" }],
        },
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<PlatformAdmin />);
  fireEvent.click(await screen.findByText("KTM"));

  await waitFor(() => expect(client.get).toHaveBeenCalledWith("/api/platform-admin/ministries/ktm/overview"));

  expect(await screen.findByText(/Apostle Khy/)).toBeInTheDocument();
  expect(screen.getByText("Set up chairs")).toBeInTheDocument();
  expect(screen.getByText("Sunday Service")).toBeInTheDocument();
  expect(screen.getByText("Welcome Flyer")).toBeInTheDocument();
  expect(screen.getByText("Come join us")).toBeInTheDocument();
});

test("shows an error if the overview fails to load", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/platform-admin/ministries") {
      return Promise.resolve({
        data: [{ ministry_id: "ktm", name: "KTM", plan: "enterprise", member_count: 1, onboarding_complete: true }],
      });
    }
    if (url === "/api/platform-admin/ministries/ktm/overview") {
      return Promise.reject({ response: { data: { error: "Failed to load ministry overview" } } });
    }
    return Promise.resolve({ data: [] });
  });

  render(<PlatformAdmin />);
  fireEvent.click(await screen.findByText("KTM"));

  expect(await screen.findByText("Failed to load ministry overview")).toBeInTheDocument();
});

test("shows an empty state when there are no ministries", async () => {
  client.get.mockResolvedValue({ data: [] });
  render(<PlatformAdmin />);
  expect(await screen.findByText("No ministries yet.")).toBeInTheDocument();
});
