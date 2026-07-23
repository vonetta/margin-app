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
    {
      key: "calendar",
      type: "calendar",
      title: "Kingdom Calendar",
      enabled: true,
      order: 3,
      content: {
        entries: [
          { title: "Prophetic Intensive", start_date: "2026-08-07T13:00:00Z", end_date: "2026-08-09T20:00:00Z", location: "Atlanta, GA" },
        ],
      },
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

test("filling in the leader message's saying, signature, and quote fields sends them on save", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: fullIssue });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("From the Leader");

  fireEvent.change(screen.getByPlaceholderText(/Closing line/), {
    target: { value: "Keep trusting. Keep building. Keep believing." },
  });
  fireEvent.change(screen.getByPlaceholderText(/Signature/), { target: { value: "Apostle Khy" } });
  fireEvent.change(screen.getByPlaceholderText(/Pull-quote/), {
    target: { value: "The pressure that feels like it will break you is preparing you to carry what will change many." },
  });
  fireEvent.click(screen.getAllByText("Save")[0]);

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/newsletter/issues/iss1",
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            key: "leader_message",
            content: expect.objectContaining({
              saying: "Keep trusting. Keep building. Keep believing.",
              signature: "Apostle Khy",
              quote: "The pressure that feels like it will break you is preparing you to carry what will change many.",
            }),
          }),
        ]),
      }),
    ),
  );
});

test("filling in the scholar's-desk title, subtitle, and a key takeaway sends them on save", async () => {
  const issueWithGuestColumn = {
    ...fullIssue,
    sections: [
      ...fullIssue.sections,
      {
        key: "guest_column",
        type: "text_block",
        title: "The Scholar's Desk",
        enabled: true,
        order: 4,
        content: { body: "" },
      },
    ],
  };
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: issueWithGuestColumn });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: issueWithGuestColumn });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("The Scholar's Desk");

  const titleInputs = screen.getAllByPlaceholderText("Title (optional)");
  fireEvent.change(titleInputs[titleInputs.length - 1], { target: { value: "Cracking the Code" } });
  const subtitleInputs = screen.getAllByPlaceholderText("Subtitle (optional)");
  fireEvent.change(subtitleInputs[subtitleInputs.length - 1], {
    target: { value: "The Mechanics of Under-Pressure Faith" },
  });
  fireEvent.click(screen.getAllByText("+ Add takeaway").pop());
  const takeawayInputs = screen.getAllByPlaceholderText("Takeaway 1");
  fireEvent.change(takeawayInputs[takeawayInputs.length - 1], {
    target: { value: "Comfort has both an emotional and legal dimension." },
  });
  fireEvent.click(screen.getAllByText("Save")[0]);

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/newsletter/issues/iss1",
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            key: "guest_column",
            content: expect.objectContaining({
              title: "Cracking the Code",
              subtitle: "The Mechanics of Under-Pressure Faith",
              key_takeaways: ["Comfort has both an emotional and legal dimension."],
            }),
          }),
        ]),
      }),
    ),
  );
});

test("the key-takeaways add button disappears once 3 are added", async () => {
  const issueWithTakeaways = {
    ...fullIssue,
    sections: [
      {
        key: "guest_column",
        type: "text_block",
        title: "The Scholar's Desk",
        enabled: true,
        order: 0,
        content: { body: "", key_takeaways: ["One", "Two", "Three"] },
      },
    ],
  };
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: issueWithTakeaways });
    return Promise.resolve({ data: [] });
  });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("The Scholar's Desk");

  expect(screen.queryByText("+ Add takeaway")).not.toBeInTheDocument();
});

test("setting a calendar entry's start and end dates sends both on save", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/newsletter/issues") return Promise.resolve({ data: [issueSummary] });
    if (url === "/api/newsletter/issues/iss1") return Promise.resolve({ data: fullIssue });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: fullIssue });

  render(<Newsletter />);
  fireEvent.click(await screen.findByText("July 2026"));
  await screen.findByText("Kingdom Calendar");

  expect(screen.getByDisplayValue("2026-08-07")).toBeInTheDocument();
  expect(screen.getByDisplayValue("2026-08-09")).toBeInTheDocument();

  fireEvent.click(screen.getAllByText("Save")[0]);

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/newsletter/issues/iss1",
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            key: "calendar",
            content: expect.objectContaining({
              entries: expect.arrayContaining([
                expect.objectContaining({ start_date: "2026-08-07T13:00:00Z", end_date: "2026-08-09T20:00:00Z" }),
              ]),
            }),
          }),
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
