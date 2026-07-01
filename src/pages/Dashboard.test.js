import { render, screen } from "@testing-library/react";
import Dashboard from "./Dashboard";

jest.mock("../api/client", () => ({
  get: jest.fn(),
}));
const client = require("../api/client");

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { name: "Test User" },
    ministryId: "ktm-test",
    ministry: { name: "KTM Test", onboarding_complete: true },
  }),
}));

beforeEach(() => {
  client.get.mockReset();
});

test("shows plan usage with limits for a capped plan", async () => {
  client.get.mockResolvedValue({
    data: {
      plan: "small",
      usage: {
        team_members: { used: 3, limit: 5 },
        sub_ministries: { used: 0, limit: 0 },
        flyers_per_month: { used: 10, limit: 15 },
      },
    },
  });

  render(<Dashboard />);

  expect(await screen.findByText("small plan")).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText(/5 Team members/)).toBeInTheDocument();
});

test("shows an infinity symbol for unlimited (null) limits", async () => {
  client.get.mockResolvedValue({
    data: {
      plan: "enterprise",
      usage: {
        team_members: { used: 12, limit: null },
        sub_ministries: { used: 2, limit: null },
        flyers_per_month: { used: 40, limit: null },
      },
    },
  });

  render(<Dashboard />);

  expect(await screen.findByText("enterprise plan")).toBeInTheDocument();
  expect(screen.getAllByText(/∞/).length).toBe(3);
});

test("does not break the dashboard if plan usage fails to load", async () => {
  client.get.mockRejectedValue(new Error("network error"));

  render(<Dashboard />);

  expect(await screen.findByText(/Welcome back/)).toBeInTheDocument();
  expect(screen.queryByText(/plan$/)).not.toBeInTheDocument();
});
