import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Calendar from "./Calendar";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

const mockUseAuth = jest.fn();
jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({
    ministryId: "ktm-test",
    user: {
      ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
    },
  });
  client.get.mockImplementation((url) => {
    if (url === "/api/events/expanded") return Promise.resolve({ data: [] });
    if (url === "/api/events") return Promise.resolve({ data: [] });
    if (url === "/api/ministry/team") {
      return Promise.resolve({
        data: [
          { _id: "u1", name: "Alex Admin", role: "admin" },
          { _id: "u2", name: "Tina Team", role: "team" },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
});

test("creating a twice-weekly recurring event builds the correct RRULE", async () => {
  client.post.mockResolvedValue({ data: { _id: "e1" } });
  render(<Calendar />);

  fireEvent.click(screen.getByText("+ New event"));
  fireEvent.change(screen.getByPlaceholderText("Event title"), {
    target: { value: "Prayer Call" },
  });
  fireEvent.change(document.querySelector('input[type="date"]'), {
    target: { value: "2026-06-02" },
  });

  fireEvent.change(screen.getByText("Does not repeat").closest("select"), {
    target: { value: "WEEKLY" },
  });

  const tuButtons = screen.getAllByText("Tu").filter((el) => el.tagName === "BUTTON");
  const thButtons = screen.getAllByText("Th").filter((el) => el.tagName === "BUTTON");
  fireEvent.click(tuButtons[0]);
  fireEvent.click(thButtons[0]);

  fireEvent.click(screen.getByText("Add to calendar"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({
        title: "Prayer Call",
        recurrence_rule: "FREQ=WEEKLY;BYDAY=TU,TH",
      }),
    ),
  );
});

test("approving a pending event from the queue calls the approve endpoint", async () => {
  client.get.mockImplementation((url, opts) => {
    if (url === "/api/events" && opts?.params?.status === "pending") {
      return Promise.resolve({
        data: [
          {
            _id: "evt-pending",
            title: "Worship Intensive",
            start: "2026-08-15T17:00:00Z",
            source: "flyer",
            ministry_id: "ktm-test",
          },
        ],
      });
    }
    if (url === "/api/events/expanded") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<Calendar />);
  fireEvent.click(await screen.findByText(/Approval queue/));

  fireEvent.click(await screen.findByText("Approve"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/events/evt-pending/approve",
      null,
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("restricting an internal event to specific team members sends their ids as visible_to", async () => {
  client.post.mockResolvedValue({ data: { _id: "e1" } });
  render(<Calendar />);

  fireEvent.click(screen.getByText("+ New event"));
  fireEvent.change(screen.getByPlaceholderText("Event title"), {
    target: { value: "Leadership Prayer Call" },
  });
  fireEvent.change(document.querySelector('input[type="date"]'), {
    target: { value: "2026-06-02" },
  });

  fireEvent.click(await screen.findByText("Tina Team"));

  fireEvent.click(screen.getByText("Add to calendar"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({
        title: "Leadership Prayer Call",
        visible_to: ["u2"],
      }),
    ),
  );
});

test("aggregates events from every ministry membership, one request per ministry", async () => {
  mockUseAuth.mockReturnValue({
    ministryId: "ktm-test",
    user: {
      ministries: [
        { ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" },
        { ministry_id: "salt-light-test", role: "admin", name: "Salt & Light", color: "#7a3b3b" },
      ],
    },
  });
  client.get.mockImplementation((url, opts) => {
    if (url === "/api/events/expanded") {
      const mId = opts?.headers?.["x-ministry-id"];
      if (mId === "ktm-test") {
        return Promise.resolve({
          data: [{ _id: "e1", title: "KTM Event", occurrence_start: "2026-06-15T18:00:00Z", status: "approved" }],
        });
      }
      if (mId === "salt-light-test") {
        return Promise.resolve({
          data: [{ _id: "e2", title: "Salt & Light Event", occurrence_start: "2026-06-16T18:00:00Z", status: "approved" }],
        });
      }
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: [] });
  });

  render(<Calendar />);

  expect(await screen.findByText("KTM Test")).toBeInTheDocument();
  expect(await screen.findByText("Salt & Light")).toBeInTheDocument();
  expect(await screen.findByText("KTM Event")).toBeInTheDocument();
  expect(await screen.findByText("Salt & Light Event")).toBeInTheDocument();
});

test("shows a task due today on the calendar grid and lets you mark it done from there", async () => {
  const today = new Date();
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [
          {
            _id: "task1",
            title: "Confirm worship setlist",
            status: "open",
            due_date: today.toISOString(),
            ministry_id: "ktm-test",
          },
        ],
      });
    }
    if (url === "/api/events/expanded") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<Calendar />);

  const chip = await screen.findByText(/☐ Confirm worship setlist/);
  expect(chip).toBeInTheDocument();

  fireEvent.click(chip.closest("div[style*='cursor: pointer']") || chip.parentElement.parentElement);

  fireEvent.click(await screen.findByText("✓ Done"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/task1/complete",
      null,
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("website tab shows the public ICS feed URL for the active ministry", async () => {
  render(<Calendar />);
  fireEvent.click(screen.getByText("Website"));

  const input = await screen.findByDisplayValue(/ktm-test\.ics/);
  expect(input).toBeInTheDocument();
});
