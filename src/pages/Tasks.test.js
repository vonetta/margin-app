import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Tasks from "./Tasks";

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
      ministries: [{ ministry_id: "ktm-test", role: "team", name: "KTM Test", color: "#03293F" }],
    },
  });
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") return Promise.resolve({ data: [] });
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

test("assigning a task posts the title, assignee, and due date", async () => {
  client.post.mockResolvedValue({ data: { _id: "t1" } });
  render(<Tasks />);

  fireEvent.click(screen.getByText("+ New task"));
  fireEvent.change(screen.getByPlaceholderText("Task title"), {
    target: { value: "Confirm worship setlist" },
  });
  fireEvent.change(await screen.findByDisplayValue("Assign to..."), {
    target: { value: "u2" },
  });
  fireEvent.change(document.querySelector('input[type="date"]'), {
    target: { value: "2026-07-01" },
  });

  fireEvent.click(screen.getByText("Assign task"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        title: "Confirm worship setlist",
        assigned_to: "u2",
      }),
    ),
  );
});

test("marking a task complete calls the complete endpoint with the right ministry header", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [{ _id: "t1", title: "Do the thing", status: "open", ministry_id: "ktm-test" }],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<Tasks />);
  fireEvent.click(await screen.findByText("✓ Done"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/t1/complete",
      null,
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("clicking a task opens an edit form pre-filled with its current details", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [
          {
            _id: "t1",
            title: "Confirm worship setlist",
            description: "Check with the worship team",
            status: "open",
            ministry_id: "ktm-test",
            assigned_to: "u2",
            due_date: "2026-07-01T00:00:00Z",
            recurrence_rule: "FREQ=WEEKLY",
          },
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

  render(<Tasks />);
  fireEvent.click(await screen.findByText("Confirm worship setlist"));

  expect(await screen.findByDisplayValue("Confirm worship setlist")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Check with the worship team")).toBeInTheDocument();
  expect(screen.getByDisplayValue("2026-07-01")).toBeInTheDocument();
  const assigneeSelect = screen.getAllByRole("combobox").find((el) => el.value === "u2");
  expect(assigneeSelect).toBeTruthy();
});

test("saving an edit calls PUT with the updated fields and the right ministry header", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [{ _id: "t1", title: "Old title", status: "open", ministry_id: "ktm-test", assigned_to: "u2" }],
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

  render(<Tasks />);
  fireEvent.click(await screen.findByText("Old title"));

  const titleInput = await screen.findByDisplayValue("Old title");
  fireEvent.change(titleInput, { target: { value: "New title" } });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ title: "New title", assigned_to: "u2" }),
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("cancel discards edits without saving", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [{ _id: "t1", title: "Untouched title", status: "open", ministry_id: "ktm-test", assigned_to: "u2" }],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<Tasks />);
  fireEvent.click(await screen.findByText("Untouched title"));

  const titleInput = await screen.findByDisplayValue("Untouched title");
  fireEvent.change(titleInput, { target: { value: "Changed but not saved" } });
  fireEvent.click(screen.getByText("Cancel"));

  expect(await screen.findByText("Untouched title")).toBeInTheDocument();
  expect(client.put).not.toHaveBeenCalled();
});

test("setting a weekly repeat sends the recurrence_rule", async () => {
  client.post.mockResolvedValue({ data: { _id: "t1" } });
  render(<Tasks />);

  fireEvent.click(screen.getByText("+ New task"));
  fireEvent.change(screen.getByPlaceholderText("Task title"), {
    target: { value: "Submit the bulletin" },
  });
  fireEvent.change(await screen.findByDisplayValue("Assign to..."), {
    target: { value: "u2" },
  });
  fireEvent.change(document.querySelector('input[type="date"]'), {
    target: { value: "2026-07-01" },
  });
  fireEvent.change(screen.getByText("Does not repeat").closest("select"), {
    target: { value: "WEEKLY" },
  });

  fireEvent.click(screen.getByText("Assign task"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        title: "Submit the bulletin",
        recurrence_rule: "FREQ=WEEKLY",
      }),
    ),
  );
});

test("blocks creating a recurring task with no due date", async () => {
  render(<Tasks />);

  fireEvent.click(screen.getByText("+ New task"));
  fireEvent.change(screen.getByPlaceholderText("Task title"), {
    target: { value: "Submit the bulletin" },
  });
  fireEvent.change(await screen.findByDisplayValue("Assign to..."), {
    target: { value: "u2" },
  });
  fireEvent.change(screen.getByText("Does not repeat").closest("select"), {
    target: { value: "WEEKLY" },
  });

  fireEvent.click(screen.getByText("Assign task"));

  expect(await screen.findByText(/needs a due date/)).toBeInTheDocument();
  expect(client.post).not.toHaveBeenCalled();
});

test("shows a recurrence indicator on a recurring task", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [
          {
            _id: "t1",
            title: "Submit the bulletin",
            status: "open",
            ministry_id: "ktm-test",
            recurrence_rule: "FREQ=WEEKLY",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<Tasks />);
  expect(await screen.findByText(/↻ Weekly/)).toBeInTheDocument();
});

test("approvals tab only queries ministries where the user is admin or leader", async () => {
  mockUseAuth.mockReturnValue({
    ministryId: "ktm-test",
    user: {
      ministries: [
        { ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" },
        { ministry_id: "team-only-test", role: "team", name: "Team Only", color: "#7a3b3b" },
      ],
    },
  });
  client.get.mockImplementation((url, opts) => {
    if (url === "/api/tasks") return Promise.resolve({ data: [] });
    if (url === "/api/events") {
      return Promise.resolve({
        data: [{ _id: "e1", title: "Pending Flyer Event" }],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<Tasks />);
  fireEvent.click(await screen.findByText(/Needs approval/));

  expect(await screen.findByText("Pending Flyer Event")).toBeInTheDocument();
  const eventCalls = client.get.mock.calls.filter(([url]) => url === "/api/events");
  expect(eventCalls.length).toBe(1);
  expect(eventCalls[0][1].headers["x-ministry-id"]).toBe("ktm-test");
});
