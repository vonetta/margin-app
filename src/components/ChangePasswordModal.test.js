import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePasswordModal from "./ChangePasswordModal";

jest.mock("../api/client", () => ({
  put: jest.fn(),
}));
const client = require("../api/client");

beforeEach(() => {
  client.put.mockReset();
});

test("opens the modal, submits current/new password, and shows a success message", async () => {
  client.put.mockResolvedValue({ data: { success: true } });

  render(<ChangePasswordModal />);
  fireEvent.click(screen.getByText("⚿ Change password"));

  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPassword123" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword456" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword456" } });
  fireEvent.click(screen.getByText("Change password", { selector: "button" }));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/auth/change-password", {
      current_password: "OldPassword123",
      new_password: "NewPassword456",
    }),
  );
  expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
});

test("shows an inline error without submitting if the new passwords don't match", async () => {
  render(<ChangePasswordModal />);
  fireEvent.click(screen.getByText("⚿ Change password"));

  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPassword123" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword456" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Mismatch789" } });
  fireEvent.click(screen.getByText("Change password", { selector: "button" }));

  expect(await screen.findByText("New passwords don't match")).toBeInTheDocument();
  expect(client.put).not.toHaveBeenCalled();
});

test("shows the server's error if the current password is wrong", async () => {
  client.put.mockRejectedValue({ response: { data: { error: "Current password is incorrect" } } });

  render(<ChangePasswordModal />);
  fireEvent.click(screen.getByText("⚿ Change password"));

  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "WrongPassword" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword456" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewPassword456" } });
  fireEvent.click(screen.getByText("Change password", { selector: "button" }));

  expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
});

test("closing and reopening the modal clears the form", async () => {
  render(<ChangePasswordModal />);
  fireEvent.click(screen.getByText("⚿ Change password"));

  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPassword123" } });
  fireEvent.click(screen.getByText("Cancel"));

  fireEvent.click(screen.getByText("⚿ Change password"));
  expect(screen.getByLabelText("Current password").value).toBe("");
});
