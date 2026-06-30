import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Calendar from "./Calendar";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ ministryId: "ktm-test" }),
}));

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  client.get.mockImplementation((url) => {
    if (url === "/api/events/expanded") return Promise.resolve({ data: [] });
    if (url === "/api/events") return Promise.resolve({ data: [] });
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

  await waitFor(() => expect(client.put).toHaveBeenCalledWith("/api/events/evt-pending/approve"));
});

test("website tab shows the public ICS feed URL for the active ministry", async () => {
  render(<Calendar />);
  fireEvent.click(screen.getByText("Website"));

  const input = await screen.findByDisplayValue(/ktm-test\.ics/);
  expect(input).toBeInTheDocument();
});
