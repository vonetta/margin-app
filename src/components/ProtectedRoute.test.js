import { render, screen } from "@testing-library/react";
import ProtectedRoute from "./ProtectedRoute";

let mockAuth;
jest.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

let lastNavigateTo = null;
jest.mock("react-router-dom", () => ({
  Navigate: ({ to }) => {
    lastNavigateTo = to;
    return <div>Redirecting to {to}</div>;
  },
}));

beforeEach(() => {
  lastNavigateTo = null;
});

test("redirects to /login when there's no user", () => {
  mockAuth = { user: null, ministry: null, loading: false };

  render(
    <ProtectedRoute>
      <div>Secret content</div>
    </ProtectedRoute>,
  );

  expect(lastNavigateTo).toBe("/login");
});

test("renders children for a logged-in user when requireOnboarding isn't set", () => {
  mockAuth = {
    user: { name: "Test" },
    ministry: { onboarding_complete: false },
    loading: false,
  };

  render(
    <ProtectedRoute>
      <div>Secret content</div>
    </ProtectedRoute>,
  );

  expect(screen.getByText("Secret content")).toBeInTheDocument();
});

test("redirects to /onboarding for a requireOnboarding route when onboarding isn't complete", () => {
  mockAuth = {
    user: { name: "Test" },
    ministry: { onboarding_complete: false },
    loading: false,
  };

  render(
    <ProtectedRoute requireOnboarding>
      <div>Content Studio</div>
    </ProtectedRoute>,
  );

  expect(lastNavigateTo).toBe("/onboarding");
});

test("renders children for a requireOnboarding route once onboarding is complete", () => {
  mockAuth = {
    user: { name: "Test" },
    ministry: { onboarding_complete: true },
    loading: false,
  };

  render(
    <ProtectedRoute requireOnboarding>
      <div>Content Studio</div>
    </ProtectedRoute>,
  );

  expect(screen.getByText("Content Studio")).toBeInTheDocument();
});
