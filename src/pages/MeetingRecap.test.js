import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MeetingRecap from "./MeetingRecap";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

let mockRole = "admin";
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { ministries: [{ ministry_id: "ktm-test", role: mockRole }] },
    ministryId: "ktm-test",
  }),
}));

const draftWithTasks = {
  _id: "draft1",
  meeting_title: "Leadership Meeting",
  meeting_date: "2026-06-01T00:00:00Z",
  created_at: "2026-06-01T00:00:00Z",
  tasks: [
    {
      _id: "task1",
      description: "Design the conference flyer",
      assignee_name_raw: "Mesha",
      matched_user_id: "u1",
      due_date: null,
      status: "pending_review",
    },
    {
      _id: "task2",
      description: "Confirm the venue",
      assignee_name_raw: null,
      matched_user_id: null,
      due_date: null,
      status: "pending_review",
    },
  ],
};

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  mockRole = "admin";
  client.get.mockImplementation((url) => {
    if (url === "/api/ministry/team") {
      return Promise.resolve({ data: [{ _id: "u1", name: "Prophetess Mesha" }] });
    }
    if (url === "/api/meetings/transcripts") return Promise.resolve({ data: [draftWithTasks] });
    return Promise.resolve({ data: [] });
  });
});

test("uploads a transcript file and extracts tasks", async () => {
  client.post.mockResolvedValue({ data: draftWithTasks });

  render(<MeetingRecap />);
  await screen.findByText("Meeting Recap");

  const file = new File(["WEBVTT\n\ntranscript text"], "transcript.vtt", { type: "text/vtt" });
  const fileInput = document.querySelector('input[type="file"]');
  fireEvent.change(fileInput, { target: { files: [file] } });
  fireEvent.click(screen.getByText("✦ Extract tasks"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/meetings/transcript",
      expect.anything(),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
    ),
  );
});

test("shows the matched assignee and unmatched task distinctly", async () => {
  render(<MeetingRecap />);

  expect(await screen.findByText("Design the conference flyer")).toBeInTheDocument();
  expect(screen.getByText(/Prophetess Mesha/)).toBeInTheDocument();
  expect(screen.getByText("Confirm the venue")).toBeInTheDocument();
  expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
});

test("approving a task calls the approve endpoint", async () => {
  client.put.mockResolvedValue({
    data: { ...draftWithTasks, tasks: [{ ...draftWithTasks.tasks[0], status: "approved" }, draftWithTasks.tasks[1]] },
  });

  render(<MeetingRecap />);
  await screen.findByText("Design the conference flyer");

  fireEvent.click(screen.getAllByText("✓ Approve")[0]);

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/meetings/transcripts/draft1/tasks/task1/approve", {}),
  );
});

test("rejecting a task calls the reject endpoint", async () => {
  client.put.mockResolvedValue({
    data: { ...draftWithTasks, tasks: [{ ...draftWithTasks.tasks[0], status: "rejected" }, draftWithTasks.tasks[1]] },
  });

  render(<MeetingRecap />);
  await screen.findByText("Design the conference flyer");

  fireEvent.click(screen.getAllByText("✕ Reject")[0]);

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/meetings/transcripts/draft1/tasks/task1/reject", {}),
  );
});

test("editing a task lets you fix the assignee before approving", async () => {
  client.put.mockResolvedValue({ data: draftWithTasks });

  render(<MeetingRecap />);
  await screen.findByText("Confirm the venue");

  const editButtons = screen.getAllByText("✎ Edit");
  fireEvent.click(editButtons[1]); // the unassigned task

  const select = screen.getByDisplayValue("No assignee");
  fireEvent.change(select, { target: { value: "u1" } });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/meetings/transcripts/draft1/tasks/task2",
      expect.objectContaining({ matched_user_id: "u1" }),
    ),
  );
});

test("shows a restricted message for a team-role user", async () => {
  mockRole = "team";
  render(<MeetingRecap />);
  expect(
    await screen.findByText("Only admins and leaders can view and manage meeting recaps."),
  ).toBeInTheDocument();
});
