import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateMinistry from "./CreateMinistry";

const mockRegisterMinistry = jest.fn();
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ registerMinistry: mockRegisterMinistry }),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }) => <a href="#">{children}</a>,
}));

beforeEach(() => {
  mockRegisterMinistry.mockReset();
  mockNavigate.mockReset();
});

test("slugifies the ministry name into a workspace URL as the admin types", () => {
  render(<CreateMinistry />);

  const nameInput = document.querySelectorAll("input")[0];
  fireEvent.change(nameInput, { target: { value: "Grace & Fire Ministries" } });

  const slugInput = document.querySelectorAll("input")[1];
  expect(slugInput.value).toBe("grace-fire-ministries");
});

test("submitting creates the ministry and navigates to onboarding", async () => {
  mockRegisterMinistry.mockResolvedValue({ id: "u1" });

  render(<CreateMinistry />);

  const inputs = document.querySelectorAll("input");
  fireEvent.change(inputs[0], { target: { value: "Grace & Fire Ministries" } });
  fireEvent.change(inputs[2], { target: { value: "Founding Admin" } });
  fireEvent.change(inputs[3], { target: { value: "founder@grace.com" } });
  fireEvent.change(inputs[4], { target: { value: "Password123" } });

  fireEvent.click(screen.getByText("Create ministry"));

  await waitFor(() =>
    expect(mockRegisterMinistry).toHaveBeenCalledWith({
      ministry_id: "grace-fire-ministries",
      ministry_name: "Grace & Fire Ministries",
      name: "Founding Admin",
      email: "founder@grace.com",
      password: "Password123",
    }),
  );
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/onboarding"));
});

test("shows an error message when creation fails", async () => {
  mockRegisterMinistry.mockRejectedValue({
    response: { data: { error: "Ministry ID already in use" } },
  });

  render(<CreateMinistry />);

  const inputs = document.querySelectorAll("input");
  fireEvent.change(inputs[0], { target: { value: "Existing Ministry" } });
  fireEvent.change(inputs[2], { target: { value: "Admin" } });
  fireEvent.change(inputs[3], { target: { value: "admin@existing.com" } });
  fireEvent.change(inputs[4], { target: { value: "Password123" } });

  fireEvent.click(screen.getByText("Create ministry"));

  expect(await screen.findByText("Ministry ID already in use")).toBeInTheDocument();
});
