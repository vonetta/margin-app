import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Dashboard from "./Dashboard";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  put: jest.fn(),
}));
const client = require("../api/client");

let mockUser = { name: "Test User" };
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    ministryId: "ktm-test",
    ministry: { name: "KTM Test", onboarding_complete: true },
  }),
}));

beforeEach(() => {
  client.get.mockReset();
  client.put.mockReset();
  mockUser = { name: "Test User", ministries: [{ ministry_id: "ktm-test", role: "admin" }] };
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
  expect(screen.getByText(/\/ 5/)).toBeInTheDocument();
  expect(screen.getByText("Team members")).toBeInTheDocument();
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

test("never fetches or shows plan/billing usage for a non-admin (leader or team)", async () => {
  mockUser = { name: "Test User", ministries: [{ ministry_id: "ktm-test", role: "leader" }] };
  client.get.mockResolvedValue({
    data: { plan: "small", usage: { team_members: { used: 3, limit: 5 } } },
  });

  render(<Dashboard />);

  await screen.findByText(/Welcome back/);
  expect(screen.queryByText(/plan$/)).not.toBeInTheDocument();
  expect(client.get).not.toHaveBeenCalledWith("/api/ministry/plan-usage");
});

describe("My Tasks and Upcoming widgets", () => {
  test("shows open tasks sorted by due date, with an overdue one flagged", async () => {
    mockUser = {
      name: "Test User",
      ministries: [{ ministry_id: "ktm-test", name: "KTM Test" }],
    };

    client.get.mockImplementation((url, opts) => {
      if (url === "/api/ministry/plan-usage") return Promise.reject(new Error("skip"));
      if (url === "/api/tasks") {
        expect(opts.headers["x-ministry-id"]).toBe("ktm-test");
        return Promise.resolve({
          data: [
            { _id: "t1", title: "Overdue task", due_date: "2020-01-01T00:00:00Z", status: "open" },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Dashboard />);

    expect(await screen.findByText("Overdue task")).toBeInTheDocument();
  });

  test("only ever fetches/shows the currently active ministry, even with multiple memberships", async () => {
    mockUser = {
      name: "Test User",
      ministries: [
        { ministry_id: "ktm-test", name: "KTM Test" },
        { ministry_id: "salt-light", name: "Salt & Light" },
      ],
    };

    client.get.mockImplementation((url, opts) => {
      if (url === "/api/ministry/plan-usage") return Promise.reject(new Error("skip"));
      if (url === "/api/tasks" && opts.headers["x-ministry-id"] === "ktm-test") {
        return Promise.resolve({
          data: [{ _id: "t1", title: "KTM task", due_date: null, status: "open" }],
        });
      }
      // Should never be called for a ministry other than the active one.
      if (url === "/api/tasks" && opts.headers["x-ministry-id"] === "salt-light") {
        return Promise.resolve({
          data: [{ _id: "t2", title: "Salt & Light task", due_date: null, status: "open" }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Dashboard />);

    expect(await screen.findByText("KTM task")).toBeInTheDocument();
    expect(screen.queryByText("Salt & Light task")).not.toBeInTheDocument();
    const taskCalls = client.get.mock.calls.filter(([url]) => url === "/api/tasks");
    expect(taskCalls.length).toBe(1);
    expect(taskCalls[0][1].headers["x-ministry-id"]).toBe("ktm-test");
  });

  test("completing a task removes it from the list", async () => {
    mockUser = {
      name: "Test User",
      ministries: [{ ministry_id: "ktm-test", name: "KTM Test" }],
    };

    client.get.mockImplementation((url) => {
      if (url === "/api/ministry/plan-usage") return Promise.reject(new Error("skip"));
      if (url === "/api/tasks") {
        return Promise.resolve({
          data: [{ _id: "t1", title: "Water the plants", due_date: null, status: "open" }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.put.mockResolvedValue({ data: {} });

    render(<Dashboard />);

    const checkbox = await screen.findByTitle("Mark complete");
    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        "/api/tasks/t1/complete",
        null,
        expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Water the plants")).not.toBeInTheDocument());
  });

  test("shows an error and keeps the task visible if completing it fails", async () => {
    mockUser = {
      name: "Test User",
      ministries: [{ ministry_id: "ktm-test", name: "KTM Test" }],
    };

    client.get.mockImplementation((url) => {
      if (url === "/api/ministry/plan-usage") return Promise.reject(new Error("skip"));
      if (url === "/api/tasks") {
        return Promise.resolve({
          data: [{ _id: "t1", title: "Water the plants", due_date: null, status: "open" }],
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.put.mockRejectedValue(new Error("network error"));

    render(<Dashboard />);

    const checkbox = await screen.findByTitle("Mark complete");
    fireEvent.click(checkbox);

    expect(await screen.findByText("Failed to complete that task — try again")).toBeInTheDocument();
    expect(screen.getByText("Water the plants")).toBeInTheDocument();
  });

  test("shows upcoming calendar occurrences within the next 14 days", async () => {
    mockUser = {
      name: "Test User",
      ministries: [{ ministry_id: "ktm-test", name: "KTM Test" }],
    };

    client.get.mockImplementation((url) => {
      if (url === "/api/ministry/plan-usage") return Promise.reject(new Error("skip"));
      if (url === "/api/events/expanded") {
        return Promise.resolve({
          data: [
            {
              _id: "e1",
              title: "Prayer Call",
              location: "Zoom",
              occurrence_start: "2099-01-01T18:00:00Z",
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Dashboard />);

    expect(await screen.findByText("Prayer Call")).toBeInTheDocument();
    expect(screen.getByText(/Zoom/)).toBeInTheDocument();
  });

  test("shows an empty state when there are no open tasks or upcoming events", async () => {
    mockUser = {
      name: "Test User",
      ministries: [{ ministry_id: "ktm-test", name: "KTM Test" }],
    };
    client.get.mockImplementation((url) => {
      if (url === "/api/ministry/plan-usage") return Promise.reject(new Error("skip"));
      return Promise.resolve({ data: [] });
    });

    render(<Dashboard />);

    expect(await screen.findByText("Nothing on your task list.")).toBeInTheDocument();
    expect(await screen.findByText(/Nothing in the next 14 days/)).toBeInTheDocument();
  });
});
