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

describe("with an org family (parent/sub-ministry)", () => {
  const familyDraft = {
    _id: "draft2",
    meeting_title: "Shared Leadership Meeting",
    meeting_date: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    ministry_id: "ktm-test",
    tasks: [
      {
        _id: "task1",
        description: "Rent the van",
        assignee_name_raw: "Monita",
        matched_user_id: "u2",
        due_date: null,
        target_ministry_id: "salt-light-test",
        ministry_uncertain: true,
        status: "pending_review",
      },
      {
        _id: "task2",
        description: "Confirm KTM Sunday service",
        assignee_name_raw: null,
        matched_user_id: null,
        due_date: null,
        target_ministry_id: "ktm-test",
        ministry_uncertain: false,
        status: "pending_review",
      },
    ],
  };

  beforeEach(() => {
    client.get.mockImplementation((url, opts) => {
      if (url === "/api/ministry/family") {
        return Promise.resolve({
          data: [
            { ministry_id: "ktm-test", name: "KTM Test" },
            { ministry_id: "salt-light-test", name: "Salt & Light Test" },
          ],
        });
      }
      if (url === "/api/ministry/team") {
        if (opts?.headers?.["x-ministry-id"] === "salt-light-test") {
          return Promise.resolve({ data: [{ _id: "u2", name: "Dr. Monitta Williams" }] });
        }
        return Promise.resolve({ data: [{ _id: "u1", name: "Prophetess Mesha" }] });
      }
      if (url === "/api/meetings/transcripts") return Promise.resolve({ data: [familyDraft] });
      return Promise.resolve({ data: [] });
    });
  });

  test("flags an uncertain ministry guess and shows a quiet ministry name otherwise", async () => {
    render(<MeetingRecap />);

    await screen.findByText("Rent the van");
    expect(screen.getAllByText(/Salt & Light Test/).length).toBeGreaterThan(0);
    expect(screen.getByText(/unsure — check this one/)).toBeInTheDocument();
    expect(screen.getAllByText(/KTM Test/).length).toBeGreaterThan(0);
  });

  test("shows a live per-ministry task-count summary", async () => {
    render(<MeetingRecap />);
    expect(await screen.findByText(/Where these land/)).toBeInTheDocument();
    expect(screen.getByText(/Salt & Light Test \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/KTM Test \(1\)/)).toBeInTheDocument();
  });

  test("changing the ministry dropdown while editing clears the assignee and saves target_ministry_id", async () => {
    client.put.mockResolvedValue({ data: familyDraft });

    render(<MeetingRecap />);
    await screen.findByText("Rent the van");

    fireEvent.click(screen.getAllByText("✎ Edit")[0]);

    const ministrySelect = screen.getByDisplayValue("Salt & Light Test");
    fireEvent.change(ministrySelect, { target: { value: "ktm-test" } });

    expect(screen.getByDisplayValue("No assignee")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        "/api/meetings/transcripts/draft2/tasks/task1",
        expect.objectContaining({ target_ministry_id: "ktm-test", matched_user_id: null }),
      ),
    );
  });
});
