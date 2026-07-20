import { render, screen, fireEvent } from "@testing-library/react";
import QuickCreateMenu from "./QuickCreateMenu";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockNavigate.mockReset();
});

test("is closed by default and opens on Cmd+K", () => {
  render(<QuickCreateMenu />);
  expect(screen.queryByText("Quick create")).not.toBeInTheDocument();

  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(screen.getByText("Quick create")).toBeInTheDocument();
});

test("opens on Ctrl+K too", () => {
  render(<QuickCreateMenu />);
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(screen.getByText("Quick create")).toBeInTheDocument();
});

test("Escape closes the menu", () => {
  render(<QuickCreateMenu />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(screen.getByText("Quick create")).toBeInTheDocument();

  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByText("Quick create")).not.toBeInTheDocument();
});

test("each action navigates to its page with openCreate in route state", () => {
  render(<QuickCreateMenu />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });

  fireEvent.click(screen.getByText("New Task"));
  expect(mockNavigate).toHaveBeenCalledWith("/tasks", { state: { openCreate: true } });
});

test("clicking the backdrop closes the menu without navigating", () => {
  const { container } = render(<QuickCreateMenu />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });

  const backdrop = container.querySelector('[style*="position: fixed"]');
  fireEvent.click(backdrop);

  expect(screen.queryByText("Quick create")).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});
