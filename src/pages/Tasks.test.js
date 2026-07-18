import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  userEvent.selectOptions(await screen.findByLabelText("Assign to"), ["u2"]);
  fireEvent.change(document.querySelector('input[type="date"]'), {
    target: { value: "2026-07-01" },
  });

  fireEvent.click(screen.getByText("Assign task"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        title: "Confirm worship setlist",
        assigned_to: ["u2"],
      }),
    ),
  );
});

test("assigning a task to more than one person sends both ids", async () => {
  client.post.mockResolvedValue({ data: { group_id: "g1", tasks: [{ _id: "t1" }, { _id: "t2" }] } });
  render(<Tasks />);

  fireEvent.click(screen.getByText("+ New task"));
  fireEvent.change(screen.getByPlaceholderText("Task title"), {
    target: { value: "Set up the check-in table" },
  });
  userEvent.selectOptions(await screen.findByLabelText("Assign to"), ["u1", "u2"]);

  fireEvent.click(screen.getByText("Assign task"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({ assigned_to: ["u1", "u2"] }),
    ),
  );
});

test("marking a task complete opens a notes field, then calls the complete endpoint with the right ministry header", async () => {
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

  const notesField = await screen.findByPlaceholderText("Add a note about how this was completed (optional)");
  fireEvent.change(notesField, { target: { value: "Wrapped up early" } });
  fireEvent.click(screen.getByText("Confirm complete"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/t1/complete",
      { notes: "Wrapped up early" },
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("completing a task without entering notes sends notes: undefined", async () => {
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
  fireEvent.click(await screen.findByText("Confirm complete"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/t1/complete",
      { notes: undefined },
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("cancelling the completion notes field leaves the task open", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [{ _id: "t1", title: "Do the thing", status: "open", ministry_id: "ktm-test" }],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<Tasks />);
  fireEvent.click(await screen.findByText("✓ Done"));
  await screen.findByText("Confirm complete");
  fireEvent.click(screen.getByText("Cancel"));

  expect(screen.queryByText("Confirm complete")).not.toBeInTheDocument();
  expect(client.put).not.toHaveBeenCalled();
});

test("viewing a completed task shows a read-only detail view with a notes editor", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [
          {
            _id: "t1",
            title: "Do the thing",
            status: "done",
            ministry_id: "ktm-test",
            completed_at: "2026-06-01T12:00:00Z",
            completion_notes: "Finished ahead of schedule",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<Tasks />);
  fireEvent.click(await screen.findByText("Show completed"));
  fireEvent.click(await screen.findByText("View"));

  expect(await screen.findByText("Finished ahead of schedule")).toBeInTheDocument();
  expect(screen.getByText(/Completed/)).toBeInTheDocument();

  fireEvent.click(screen.getByText("Edit notes"));
  const textarea = screen.getByDisplayValue("Finished ahead of schedule");
  fireEvent.change(textarea, { target: { value: "Updated notes" } });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/t1",
      { completion_notes: "Updated notes" },
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("putting a task on hold from the list view calls the hold endpoint, and shows an on-hold badge + Resume button", async () => {
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
  fireEvent.click(await screen.findByText("⏸ Hold"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/tasks/t1/hold",
      {},
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("an on-hold task in the list view shows a badge and a Resume button instead of Hold", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [
          {
            _id: "t1",
            title: "Blocked task",
            status: "on_hold",
            hold_reason: "Waiting on the vendor",
            ministry_id: "ktm-test",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });

  render(<Tasks />);
  expect(await screen.findByText("⏸ On hold")).toBeInTheDocument();
  expect(screen.getByText("▶ Resume")).toBeInTheDocument();
  expect(screen.queryByText("⏸ Hold")).not.toBeInTheDocument();
});

test("a shared task shows co-assignee chips outside the board, with a working remove control", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [
          {
            _id: "t1",
            title: "Shared setup",
            status: "open",
            ministry_id: "ktm-test",
            group_id: "g1",
            siblings: [{ task_id: "t2", user_id: "u2", name: "Tina Team", status: "open" }],
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: { deleted: true } });

  render(<Tasks />);
  expect(await screen.findByText("Tina Team")).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Remove Tina Team from "Shared setup"'));

  await waitFor(() =>
    expect(client.delete).toHaveBeenCalledWith(
      "/api/tasks/t2",
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("adding someone from the list view's own select calls the assignees endpoint", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [{ _id: "t1", title: "Solo task", status: "open", ministry_id: "ktm-test", assigned_to: "u1" }],
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
  client.post.mockResolvedValue({ data: {} });

  render(<Tasks />);
  const select = await screen.findByLabelText('Add someone else to "Solo task"');
  userEvent.selectOptions(select, ["u2"]);

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/tasks/t1/assignees",
      { user_id: "u2" },
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

test("deleting a task requires a confirm step before the DELETE call fires", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/tasks") {
      return Promise.resolve({
        data: [{ _id: "t1", title: "Do the thing", status: "open", ministry_id: "ktm-test" }],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: {} });

  render(<Tasks />);
  fireEvent.click(await screen.findByText("✕"));
  expect(client.delete).not.toHaveBeenCalled();

  fireEvent.click(await screen.findByText("Confirm"));
  await waitFor(() =>
    expect(client.delete).toHaveBeenCalledWith(
      "/api/tasks/t1",
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});

test("setting a weekly repeat sends the recurrence_rule", async () => {
  client.post.mockResolvedValue({ data: { _id: "t1" } });
  render(<Tasks />);

  fireEvent.click(screen.getByText("+ New task"));
  fireEvent.change(screen.getByPlaceholderText("Task title"), {
    target: { value: "Submit the bulletin" },
  });
  userEvent.selectOptions(await screen.findByLabelText("Assign to"), ["u2"]);
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
  userEvent.selectOptions(await screen.findByLabelText("Assign to"), ["u2"]);
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

describe("Everyone's tasks tab", () => {
  test("is hidden for a plain team member", async () => {
    render(<Tasks />);
    await screen.findByText(/My tasks/);
    expect(screen.queryByText("Everyone's tasks")).not.toBeInTheDocument();
  });

  test("shows tasks grouped by assignee for an admin, defaulting to open only", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url, opts) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        expect(opts.params.status).toBe("active");
        return Promise.resolve({
          data: { u2: { name: "Tina Team", tasks: [{ _id: "t1", title: "Rent the van", status: "open" }] } },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));

    expect(await screen.findByText("Rent the van")).toBeInTheDocument();
    expect(within(screen.getByTestId("board-column-u2")).getAllByText(/Tina Team/).length).toBeGreaterThan(0);
  });

  test("dragging a card into another person's column adds them (never replaces the original assignee)", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: { name: "Alex Admin", tasks: [{ _id: "t1", title: "Rent the van", status: "open", assigned_to: "u1" }] },
            u2: { name: "Tina Team", tasks: [] },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.post.mockResolvedValue({ data: {} });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    const card = await screen.findByText("Rent the van");

    fireEvent.dragStart(card);
    fireEvent.drop(screen.getByTestId("board-column-u2"));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "/api/tasks/t1/assignees",
        { user_id: "u2" },
        expect.anything(),
      ),
    );
  });

  test("dragging a card into the Done column completes it", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: {
              name: "Alex Admin",
              tasks: [{ _id: "t1", title: "Rent the van", status: "open", assigned_to: "u1" }],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.put.mockResolvedValue({ data: {} });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    const card = await screen.findByText("Rent the van");

    fireEvent.dragStart(card);
    fireEvent.drop(screen.getByTestId("board-column-done"));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        "/api/tasks/t1/complete",
        null,
        expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
      ),
    );
  });

  test("switching to 'Open + completed' refetches with status=all", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "leader", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url, opts) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    await screen.findByText("No tasks to show.");

    fireEvent.click(screen.getByText("Open + completed"));

    await waitFor(() => {
      const calls = client.get.mock.calls.filter(([url]) => url === "/api/tasks/team-overview");
      expect(calls[calls.length - 1][1].params.status).toBe("all");
    });
  });

  test("a card's add-someone select works without dragging (keyboard/click alternative)", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: { name: "Alex Admin", tasks: [{ _id: "t1", title: "Rent the van", status: "open", assigned_to: "u1" }] },
            u2: { name: "Tina Team", tasks: [] },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.post.mockResolvedValue({ data: {} });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    await screen.findByText("Rent the van");

    fireEvent.change(screen.getByLabelText('Add someone else to "Rent the van"'), { target: { value: "u2" } });

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith("/api/tasks/t1/assignees", { user_id: "u2" }, expect.anything()),
    );
  });

  test("adding someone renders a removable chip on the card", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: {
              name: "Alex Admin",
              tasks: [{ _id: "t1", title: "Set up check-in", status: "open", assigned_to: "u1", group_id: "g1" }],
            },
            u2: {
              name: "Tina Team",
              tasks: [{ _id: "t2", title: "Set up check-in", status: "open", assigned_to: "u2", group_id: "g1" }],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));

    expect(await screen.findAllByText(/Tina Team/)).not.toHaveLength(0);
    expect(screen.getByLabelText('Remove Tina Team from "Set up check-in"')).toBeInTheDocument();
  });

  test("removing a co-assignee deletes just their own row", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: {
              name: "Alex Admin",
              tasks: [{ _id: "t1", title: "Set up check-in", status: "open", assigned_to: "u1", group_id: "g1" }],
            },
            u2: {
              name: "Tina Team",
              tasks: [{ _id: "t2", title: "Set up check-in", status: "open", assigned_to: "u2", group_id: "g1" }],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.delete.mockResolvedValue({ data: { deleted: true } });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    await screen.findAllByText(/Tina Team/);

    fireEvent.click(screen.getByLabelText('Remove Tina Team from "Set up check-in"'));

    await waitFor(() =>
      expect(client.delete).toHaveBeenCalledWith(
        "/api/tasks/t2",
        expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
      ),
    );
  });

  test("putting a task on hold shows a badge and a Resume button", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: {
              name: "Alex Admin",
              tasks: [{ _id: "t1", title: "Rent the van", status: "on_hold", assigned_to: "u1", hold_reason: "Waiting" }],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));

    expect(await screen.findByText("⏸ On hold")).toBeInTheDocument();
    expect(screen.getByLabelText('Resume "Rent the van"')).toBeInTheDocument();
    expect(screen.queryByLabelText('Put "Rent the van" on hold')).not.toBeInTheDocument();
  });

  test("clicking Hold calls the hold endpoint", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: { name: "Alex Admin", tasks: [{ _id: "t1", title: "Rent the van", status: "open", assigned_to: "u1" }] },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.put.mockResolvedValue({ data: {} });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    await screen.findByText("Rent the van");

    fireEvent.click(screen.getByLabelText('Put "Rent the van" on hold'));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        "/api/tasks/t1/hold",
        {},
        expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
      ),
    );
  });

  test("a card's 'Mark done' button works without dragging", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: { name: "Alex Admin", tasks: [{ _id: "t1", title: "Rent the van", status: "open", assigned_to: "u1" }] },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.put.mockResolvedValue({ data: {} });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    await screen.findByText("Rent the van");

    fireEvent.click(screen.getByLabelText('Mark "Rent the van" done'));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        "/api/tasks/t1/complete",
        null,
        expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
      ),
    );
  });

  test("Done column's 'Reopen' button works without dragging", async () => {
    mockUseAuth.mockReturnValue({
      ministryId: "ktm-test",
      user: {
        ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test", color: "#03293F" }],
      },
    });
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/tasks/team-overview") {
        return Promise.resolve({
          data: {
            u1: { name: "Alex Admin", tasks: [{ _id: "t1", title: "Rent the van", status: "done", assigned_to: "u1" }] },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    client.put.mockResolvedValue({ data: {} });

    render(<Tasks />);
    fireEvent.click(await screen.findByText("Everyone's tasks"));
    await screen.findByText("Rent the van");

    fireEvent.click(screen.getByLabelText('Reopen "Rent the van"'));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith(
        "/api/tasks/t1/reopen",
        null,
        expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
      ),
    );
  });
});

describe("similar-task warning on the create form", () => {
  test("warns when typing a title similar to an existing task", async () => {
    client.get.mockImplementation((url, opts) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/ministry/team") {
        return Promise.resolve({ data: [{ _id: "u1", name: "Alex Admin", role: "admin" }] });
      }
      if (url === "/api/tasks/similar") {
        expect(opts.params.title).toBe("Rent a van");
        return Promise.resolve({
          data: [{ _id: "t1", title: "Rent the van", assignee_name: "Alex Admin", status: "open" }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(screen.getByText("+ New task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Rent a van" } });

    expect(await screen.findByText(/Looks similar to an existing task/)).toBeInTheDocument();
    expect(screen.getByText("Rent the van")).toBeInTheDocument();
  });

  test("does not check for a very short title", async () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks/similar") {
        throw new Error("should not be called for a short title");
      }
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(screen.getByText("+ New task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Van" } });

    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryByText(/Looks similar to an existing task/)).not.toBeInTheDocument();
  });

  test("clears the warning once the form is reset", async () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/tasks") return Promise.resolve({ data: [] });
      if (url === "/api/events") return Promise.resolve({ data: [] });
      if (url === "/api/ministry/team") {
        return Promise.resolve({ data: [{ _id: "u1", name: "Alex Admin", role: "admin" }] });
      }
      if (url === "/api/tasks/similar") {
        return Promise.resolve({
          data: [{ _id: "t1", title: "Rent the van", assignee_name: "Alex Admin", status: "open" }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<Tasks />);
    fireEvent.click(screen.getByText("+ New task"));
    fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Rent a van" } });
    await screen.findByText(/Looks similar to an existing task/);

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/Looks similar to an existing task/)).not.toBeInTheDocument();
  });
});
