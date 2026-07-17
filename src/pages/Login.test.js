import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "./Login";

const mockLogin = jest.fn();
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

beforeEach(() => {
  mockLogin.mockReset();
  window.history.replaceState({}, "", "/login");
});

test("shows an inline error on failed login, without navigating away", async () => {
  mockLogin.mockRejectedValue({ response: { data: { error: "Invalid email or password" } } });

  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByText("Sign In"));

  expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
});

test("shows a session-expired banner when redirected here with ?expired=1, then strips it from the URL", async () => {
  window.history.replaceState({}, "", "/login?expired=1");

  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Your session expired — please sign in again.")).toBeInTheDocument();
  expect(window.location.search).toBe("");
});

test("does not show the session-expired banner on a normal visit", () => {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

  expect(screen.queryByText(/session expired/)).not.toBeInTheDocument();
});
