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

// Calendar.js defaults its displayed month to `new Date()` (today), so any
// mocked event must fall within the *current* month/year to show up in the
// grid — a hardcoded date will silently go stale as real time passes.
// This picks a day-of-month, in the current month, at a fixed UTC hour.
const dateInCurrentMonth = (day, hour = "18:00:00") => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-${String(day).padStart(2, "0")}T${hour}Z`;
};

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

test("approving a pending event shows the suggested-tasks review panel", async () => {
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
    if (url === "/api/events/evt-pending/suggested-tasks") {
      return Promise.resolve({
        data: [
          { title: "Day-of setup for Worship Intensive", description: "Prep the space.", due_date: "2026-08-15T17:00:00Z" },
          { title: "Thank-you / debrief for Worship Intensive", description: "Send thank-yous.", due_date: "2026-08-17T17:00:00Z" },
        ],
      });
    }
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
  client.put.mockResolvedValue({ data: {} });
  client.post.mockResolvedValue({ data: {} });

  render(<Calendar />);
  fireEvent.click(await screen.findByText(/Approval queue/));
  fireEvent.click(await screen.findByText("Approve"));

  expect(await screen.findByText("Suggested tasks for this event")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Day-of setup for Worship Intensive")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Thank-you / debrief for Worship Intensive")).toBeInTheDocument();
});

test("suggested-tasks panel requires an assignee before creating a checked row", async () => {
  client.get.mockImplementation((url, opts) => {
    if (url === "/api/events" && opts?.params?.status === "pending") {
      return Promise.resolve({
        data: [{ _id: "evt-pending", title: "Worship Intensive", start: "2026-08-15T17:00:00Z", ministry_id: "ktm-test" }],
      });
    }
    if (url === "/api/events/expanded") return Promise.resolve({ data: [] });
    if (url === "/api/events/evt-pending/suggested-tasks") {
      return Promise.resolve({
        data: [{ title: "Day-of setup for Worship Intensive", due_date: "2026-08-15T17:00:00Z" }],
      });
    }
    if (url === "/api/ministry/team") {
      return Promise.resolve({ data: [{ _id: "u1", name: "Alex Admin", role: "admin" }] });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<Calendar />);
  fireEvent.click(await screen.findByText(/Approval queue/));
  fireEvent.click(await screen.findByText("Approve"));
  await screen.findByText("Suggested tasks for this event");

  fireEvent.click(screen.getByText("Create tasks"));

  expect(await screen.findByText(/Pick an assignee/)).toBeInTheDocument();
  expect(client.post).not.toHaveBeenCalled();
});

test("suggested-tasks panel creates only the checked, assigned rows", async () => {
  client.get.mockImplementation((url, opts) => {
    if (url === "/api/events" && opts?.params?.status === "pending") {
      return Promise.resolve({
        data: [{ _id: "evt-pending", title: "Worship Intensive", start: "2026-08-15T17:00:00Z", ministry_id: "ktm-test" }],
      });
    }
    if (url === "/api/events/expanded") return Promise.resolve({ data: [] });
    if (url === "/api/events/evt-pending/suggested-tasks") {
      return Promise.resolve({
        data: [
          { title: "Day-of setup for Worship Intensive", due_date: "2026-08-15T17:00:00Z" },
          { title: "Thank-you / debrief for Worship Intensive", due_date: "2026-08-17T17:00:00Z" },
        ],
      });
    }
    if (url === "/api/ministry/team") {
      return Promise.resolve({ data: [{ _id: "u1", name: "Alex Admin", role: "admin" }] });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });
  client.post.mockResolvedValue({ data: {} });

  render(<Calendar />);
  fireEvent.click(await screen.findByText(/Approval queue/));
  fireEvent.click(await screen.findByText("Approve"));
  await screen.findByText("Suggested tasks for this event");

  // Uncheck the second (thank-you) row, assign the first.
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[1]);
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[0], { target: { value: "u1" } });

  fireEvent.click(screen.getByText("Create tasks"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({ title: "Day-of setup for Worship Intensive", assigned_to: "u1" }),
      expect.anything(),
    ),
  );
  expect(client.post).toHaveBeenCalledTimes(1);
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
          data: [{ _id: "e1", title: "KTM Event", occurrence_start: dateInCurrentMonth(15), status: "approved" }],
        });
      }
      if (mId === "salt-light-test") {
        return Promise.resolve({
          data: [{ _id: "e2", title: "Salt & Light Event", occurrence_start: dateInCurrentMonth(16), status: "approved" }],
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

test("clicking Edit on an event opens the form pre-filled and saves via PUT to the event's own ministry", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/events/expanded") {
      return Promise.resolve({
        data: [
          {
            _id: "evt1",
            title: "Weekly Prayer Call",
            description: "Call in details in the group chat",
            location: "Zoom",
            start: dateInCurrentMonth(2),
            end: dateInCurrentMonth(2, "19:00:00"),
            all_day: false,
            visibility: "internal",
            recurrence_rule: "FREQ=WEEKLY",
            occurrence_start: dateInCurrentMonth(2),
            occurrence_end: dateInCurrentMonth(2, "19:00:00"),
            status: "approved",
            ministry_id: "ktm-test",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<Calendar />);

  const dayCell = await screen.findByText("Weekly Prayer Call");
  fireEvent.click(dayCell.closest("div[style*='cursor: pointer']"));

  fireEvent.click(await screen.findByText("Edit"));

  expect(await screen.findByDisplayValue("Weekly Prayer Call")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Call in details in the group chat")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Zoom")).toBeInTheDocument();
  expect(screen.getByText("Edit event")).toBeInTheDocument();

  const titleInput = screen.getByDisplayValue("Weekly Prayer Call");
  fireEvent.change(titleInput, { target: { value: "Updated Prayer Call" } });
  fireEvent.click(screen.getByText("Save changes"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/events/evt1",
      expect.objectContaining({ title: "Updated Prayer Call", recurrence_rule: "FREQ=WEEKLY" }),
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("deleting an event requires a confirm step before the DELETE call fires", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/events/expanded") {
      return Promise.resolve({
        data: [
          {
            _id: "evt1",
            title: "One-off Event",
            start: dateInCurrentMonth(2),
            occurrence_start: dateInCurrentMonth(2),
            status: "approved",
            ministry_id: "ktm-test",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: {} });

  render(<Calendar />);

  const dayCell = await screen.findByText("One-off Event");
  fireEvent.click(dayCell.closest("div[style*='cursor: pointer']"));

  fireEvent.click(await screen.findByText("Delete"));
  expect(client.delete).not.toHaveBeenCalled();

  fireEvent.click(await screen.findByText("Confirm delete"));
  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/events/evt1", expect.anything()));
});

test("website tab shows the public ICS feed URL for the active ministry", async () => {
  render(<Calendar />);
  fireEvent.click(screen.getByText("Website"));

  const input = await screen.findByDisplayValue(/ktm-test\.ics/);
  expect(input).toBeInTheDocument();
});
