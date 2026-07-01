import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import JoinInvite from "./JoinInvite";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
const client = require("../api/client");

const mockRegister = jest.fn();
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ token: "abc123" }),
}));

beforeEach(() => {
  client.get.mockReset();
  mockRegister.mockReset();
  mockNavigate.mockReset();
});

test("shows the ministry name and role from the invite lookup", async () => {
  client.get.mockResolvedValue({
    data: {
      email: "newperson@ktm.com",
      name: "New Person",
      role: "leader",
      ministry_id: "ktm-test",
      ministry_name: "Khy Traylor Global Ministries",
    },
  });

  render(<JoinInvite />);

  expect(await screen.findByText(/Khy Traylor Global Ministries/)).toBeInTheDocument();
  expect(screen.getByText(/Leader/)).toBeInTheDocument();
  expect(await screen.findByDisplayValue("newperson@ktm.com")).toBeInTheDocument();
});

test("submitting registers with the invite token and navigates home", async () => {
  client.get.mockResolvedValue({
    data: {
      email: "newperson@ktm.com",
      name: "",
      role: "team",
      ministry_id: "ktm-test",
      ministry_name: "KTM Test",
    },
  });
  mockRegister.mockResolvedValue({ id: "u1" });

  render(<JoinInvite />);
  await screen.findByDisplayValue("newperson@ktm.com");

  const nameInput = document.querySelector('input[type="text"]');
  fireEvent.change(nameInput, { target: { value: "New Person" } });

  const passwordInput = document.querySelector('input[type="password"]');
  fireEvent.change(passwordInput, { target: { value: "Password123" } });

  fireEvent.click(screen.getByText("Join the team"));

  await waitFor(() =>
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "newperson@ktm.com",
        ministry_id: "ktm-test",
        invite_token: "abc123",
      }),
    ),
  );
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
});

test("shows an error for an invalid or expired invite", async () => {
  client.get.mockRejectedValue({ response: { data: { error: "This invite has expired" } } });

  render(<JoinInvite />);

  expect(await screen.findByText("This invite has expired")).toBeInTheDocument();
});
