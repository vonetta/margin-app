import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Newsletter from "./Newsletter";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { ministries: [{ ministry_id: "ktm-test", role: "admin" }] },
    ministryId: "ktm-test",
  }),
}));

const issueSummary = { _id: "iss1", month: 7, year: 2026, theme: "Kingdom Strength", status: "draft" };

const fullIssue = {
  _id: "iss1",
  month: 7,
  year: 2026,
  theme: "Kingdom Strength",
  status: "draft",
  sections: [
    { key: "leader_message", type: "text_block", title: "From the Leader", enabled: true, order: 0, content: { body: "", photo_url: "" } },
    { key: "milestones", type: "list_block", title: "Ministry Milestones", enabled: true, order: 1, content: { items: [] } },
    {
      key: "birthdays",
      type: "birthdays",
      title: "Kingdom Birthdays",
      enabled: true,
      order: 2,
      content: { entries: [{ name: "Jacob Trenier", date: "2000-07-07T00:00:00Z" }] },
    },
  ],
};

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
});

test("lists issues and shows their theme", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    return Promise.resolve({ data: [] });
  });

  render(<Newsletter />);

  expect(await screen.findByText("July 2026")).toBeInTheDocument();
  expect(screen.getByText("Kingdom Strength")).toBeInTheDocument();
});

test("shows an empty state when there are no issues", async () => {
  client.get.mockResolvedValue({ data: [] });
  render(<Newsletter />);
  expect(await screen.findByText("No issues yet. Create your first one above.")).toBeInTheDocument();
});

test("creates a new issue with month/year/theme", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
  client.post.mockResolvedValue({ data: fullIssue });

  render(<Newsletter />);
  await screen.findByText("No issues yet. Create your first one above.");

  fireEvent.click(screen.getByText("+ New issue"));
  fireEvent.change(screen.getByPlaceholderText("Theme (optional, e.g. Kingdom Strength)"), {
    target: { value: "Kingdom Strength" },
  });
  fireEvent.click(screen.getByText("Create issue"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/newsletter/issues",
      expect.objectContaining({ theme: "Kingdom Strength" }),
    ),
  );
});

test("selecting an issue loads and displays its sections", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    return Promise.resolve({ data: [] });
  });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));

  expect(await screen.findByText("From the Leader")).toBeInTheDocument();
  expect(screen.getByText("Ministry Milestones")).toBeInTheDocument();
  expect(screen.getByText("Kingdom Birthdays")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Jacob Trenier")).toBeInTheDocument();
});

test("editing a text_block section and saving sends the updated content", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: fullIssue });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("From the Leader");

  fireEvent.change(screen.getByPlaceholderText("Write this section's content..."), {
    target: { value: "Trust the process." },
  });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/newsletter/issues/iss1",
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({ key: "leader_message", content: expect.objectContaining({ body: "Trust the process." }) }),
        ]),
      }),
    ),
  );
});

test("toggling a section off before saving disables it in the payload", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: fullIssue });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("From the Leader");

  fireEvent.click(screen.getByLabelText("Ministry Milestones"));
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/newsletter/issues/iss1",
      expect.objectContaining({
        sections: expect.arrayContaining([expect.objectContaining({ key: "milestones", enabled: false })]),
      }),
    ),
  );
});

test("adding a list_block item and saving includes it in the payload", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: fullIssue });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("Ministry Milestones");

  fireEvent.click(screen.getByText("+ Add item"));
  fireEvent.change(screen.getByPlaceholderText("Heading"), { target: { value: "Spoke at conference" } });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/newsletter/issues/iss1",
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            key: "milestones",
            content: { items: [{ heading: "Spoke at conference", body: "" }] },
          }),
        ]),
      }),
    ),
  );
});

test("exporting an issue downloads a PDF via a blob response", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    if (url === "/api/newsletter/issues/iss1/export") return Promise.resolve({ data: new Blob(["fake-pdf"]) });
    return Promise.resolve({ data: [] });
  });

  const createObjectURL = jest.fn().mockReturnValue("blob:fake-url");
  const revokeObjectURL = jest.fn();
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("From the Leader");

  fireEvent.click(screen.getByText("Export PDF"));

  await waitFor(() =>
    expect(client.get).toHaveBeenCalledWith("/api/newsletter/issues/iss1/export", { responseType: "blob" }),
  );
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
});

test("deleting an issue hides it immediately, then defers the DELETE call behind an undo window", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: { deleted: true } });

  render(<Newsletter />);
  await screen.findByText("July 2026");

  jest.useFakeTimers();
  fireEvent.click(screen.getByText("✕"));

  expect(screen.queryByText("July 2026")).not.toBeInTheDocument();
  expect(client.delete).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(6000);
  });
  jest.useRealTimers();

  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/newsletter/issues/iss1"));
});
