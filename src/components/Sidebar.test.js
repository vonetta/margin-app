import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "./Sidebar";

jest.mock("./NotificationBell", () => () => <div>NotificationBell</div>);

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/" }),
}));

let mockAuth;
jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

beforeEach(() => {
  mockNavigate.mockReset();
  mockAuth = {
    user: { name: "Test User", ministries: [{ ministry_id: "ktm-test", role: "admin" }] },
    ministryId: "ktm-test",
    ministry: { name: "KTM Test" },
    logout: jest.fn(),
    switchMinistry: jest.fn(),
  };
});

test("groups nav items under Create/Operate/Setup headers for an admin", () => {
  render(<Sidebar />);

  expect(screen.getByText("Create")).toBeInTheDocument();
  expect(screen.getByText("Operate")).toBeInTheDocument();
  expect(screen.getByText("Setup")).toBeInTheDocument();

  expect(screen.getByText("Dashboard")).toBeInTheDocument();
  expect(screen.getByText("Captions")).toBeInTheDocument();
  expect(screen.getByText("Flyers")).toBeInTheDocument();
  expect(screen.getByText("Communications")).toBeInTheDocument();
  expect(screen.getByText("Social Queue")).toBeInTheDocument();
  expect(screen.getByText("Calendar")).toBeInTheDocument();
  expect(screen.getByText("Tasks")).toBeInTheDocument();
  expect(screen.getByText("Meeting Recap")).toBeInTheDocument();
  expect(screen.getByText("People")).toBeInTheDocument();
  expect(screen.getByText("Team")).toBeInTheDocument();
  expect(screen.getByText("SOPs")).toBeInTheDocument();
  expect(screen.getByText("AI Profile")).toBeInTheDocument();
  expect(screen.getByText("Resources")).toBeInTheDocument();
});

test("hides admin-only and leader-gated items, and their whole group if nothing's left, for a team member", () => {
  mockAuth.user.ministries = [{ ministry_id: "ktm-test", role: "team" }];

  render(<Sidebar />);

  expect(screen.queryByText("Social Queue")).not.toBeInTheDocument();
  expect(screen.queryByText("Team")).not.toBeInTheDocument();
  expect(screen.queryByText("Meeting Recap")).not.toBeInTheDocument();
  expect(screen.queryByText("SOPs")).not.toBeInTheDocument();

  // Operate still has Calendar/Tasks/People, so its header stays.
  expect(screen.getByText("Operate")).toBeInTheDocument();
  // Setup only had SOPs (leader-gated) + AI Profile + Resources — AI
  // Profile and Resources are open to everyone, so Setup still shows.
  expect(screen.getByText("Setup")).toBeInTheDocument();
});

test("shows Meeting Recap and SOPs for a leader (not just admin)", () => {
  mockAuth.user.ministries = [{ ministry_id: "ktm-test", role: "leader" }];

  render(<Sidebar />);

  expect(screen.getByText("Meeting Recap")).toBeInTheDocument();
  expect(screen.getByText("SOPs")).toBeInTheDocument();
  expect(screen.queryByText("Social Queue")).not.toBeInTheDocument();
  expect(screen.queryByText("Team")).not.toBeInTheDocument();
});

test("marks Resources as coming soon and doesn't navigate when clicked", () => {
  render(<Sidebar />);

  expect(screen.getByText("SOON")).toBeInTheDocument();
  screen.getByText("Resources").click();
  expect(mockNavigate).not.toHaveBeenCalledWith("/resources");
});

test("nav items are keyboard-operable (role=button, Enter navigates)", () => {
  render(<Sidebar />);

  const calendarItem = screen.getByRole("button", { name: /Calendar/ });
  expect(calendarItem).toHaveAttribute("tabIndex", "0");

  fireEvent.keyDown(calendarItem, { key: "Enter" });
  expect(mockNavigate).toHaveBeenCalledWith("/calendar");
});

test("a coming-soon item has no button role at all", () => {
  render(<Sidebar />);
  expect(screen.queryByRole("button", { name: /Resources/ })).not.toBeInTheDocument();
});
