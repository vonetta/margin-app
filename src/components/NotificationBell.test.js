import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotificationBell from "./NotificationBell";

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

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const renderBell = () => render(<NotificationBell />);

beforeEach(() => {
  client.get.mockReset();
  client.put.mockReset();
  mockNavigate.mockReset();
  mockUseAuth.mockReturnValue({
    user: { ministries: [{ ministry_id: "ktm-test", role: "admin", name: "KTM Test" }] },
  });
});

test("shows an unread count badge", async () => {
  client.get.mockResolvedValue({
    data: [
      { _id: "n1", title: "New task assigned to you", body: "Confirm setlist", read: false, created_at: new Date().toISOString() },
      { _id: "n2", title: "Already seen", read: true, created_at: new Date().toISOString() },
    ],
  });

  renderBell();

  expect(await screen.findByText("1")).toBeInTheDocument();
});

test("clicking an unread notification marks it read and navigates to its link", async () => {
  client.get.mockResolvedValue({
    data: [
      {
        _id: "n1",
        title: "Event needs approval",
        body: "Worship Intensive",
        read: false,
        link: "/calendar",
        ministry_id: "ktm-test",
        created_at: new Date().toISOString(),
      },
    ],
  });
  client.put.mockResolvedValue({ data: {} });

  renderBell();

  fireEvent.click(screen.getByText("Notifications"));
  fireEvent.click(await screen.findByText("Event needs approval"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/notifications/n1/read",
      null,
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
  expect(mockNavigate).toHaveBeenCalledWith("/calendar");
});

test("mark all read clears the unread badge", async () => {
  client.get.mockResolvedValue({
    data: [{ _id: "n1", title: "Unread one", read: false, ministry_id: "ktm-test", created_at: new Date().toISOString() }],
  });
  client.put.mockResolvedValue({ data: {} });

  renderBell();

  fireEvent.click(screen.getByText("Notifications"));
  fireEvent.click(await screen.findByText("Mark all read"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/notifications/read-all",
      null,
      expect.objectContaining({ headers: { "x-ministry-id": "ktm-test" } }),
    ),
  );
});
