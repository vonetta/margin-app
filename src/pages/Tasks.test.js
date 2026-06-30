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
