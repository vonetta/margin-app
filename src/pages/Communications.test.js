import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Communications from "./Communications";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  client.get.mockImplementation((url) => {
    if (url === "/api/people") {
      return Promise.resolve({
        data: [{ _id: "p1", name: "Dr. Robert Rush III", title: "Prophet", email: "robert@example.com" }],
      });
    }
    if (url === "/api/communications/drafts") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
});

test("picking a person from the roster fills in their name and email", async () => {
  render(<Communications />);
  const select = await screen.findByText(/Type a name manually/);
  fireEvent.change(select.closest("select"), { target: { value: "p1" } });

  expect(screen.getByPlaceholderText("Recipient name")).toHaveValue("Dr. Robert Rush III");
  expect(screen.getByPlaceholderText("Email (optional)")).toHaveValue("robert@example.com");
});

test("sends the chosen email type and recipient through to the chat request", async () => {
  client.post.mockResolvedValue({
    data: {
      done: true,
      subject: "Confirming Your Ministry Assignment",
      body: "Dear Dr. Robert,\n\nGreetings...",
      messages: [
        { role: "user", content: "Friday June 12, 7pm, $850" },
        { role: "assistant", content: "Dear Dr. Robert,\n\nGreetings..." },
      ],
    },
  });

  render(<Communications />);
  await screen.findByText(/Type a name manually/);

  fireEvent.click(screen.getByText("Confirmation & Logistics"));
  fireEvent.change(screen.getByPlaceholderText("Recipient name"), {
    target: { value: "Dr. Robert Rush III" },
  });

  const textarea = screen.getByPlaceholderText(/Friday June 12/);
  fireEvent.change(textarea, { target: { value: "Friday June 12, 7pm, $850" } });
  fireEvent.click(screen.getByText("✦ Start"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/communications/chat",
      expect.objectContaining({
        type: "confirmation",
        recipient_name: "Dr. Robert Rush III",
      }),
    ),
  );

  expect(await screen.findByText("Confirming Your Ministry Assignment")).toBeInTheDocument();
});

test("editing a saved draft's subject and body calls PUT with the updated fields", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/people") return Promise.resolve({ data: [] });
    if (url === "/api/communications/drafts") {
      return Promise.resolve({
        data: [{ _id: "d1", type: "invitation", recipient_name: "Someone", subject: "Original Subject", body: "Original body" }],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({
    data: { _id: "d1", type: "invitation", recipient_name: "Someone", subject: "New Subject", body: "New body" },
  });

  render(<Communications />);
  fireEvent.click(await screen.findByText("Draft queue"));

  fireEvent.click(await screen.findByText("Edit"));

  const subjectInput = await screen.findByDisplayValue("Original Subject");
  fireEvent.change(subjectInput, { target: { value: "New Subject" } });
  const bodyTextarea = screen.getByDisplayValue("Original body");
  fireEvent.change(bodyTextarea, { target: { value: "New body" } });

  fireEvent.click(screen.getByText("Save changes"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/communications/drafts/d1", {
      subject: "New Subject",
      body: "New body",
    }),
  );

  expect(await screen.findByText("New Subject")).toBeInTheDocument();
});

test("deleting a saved draft requires a confirm step, then defers the DELETE call behind an undo window", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/people") return Promise.resolve({ data: [] });
    if (url === "/api/communications/drafts") {
      return Promise.resolve({
        data: [{ _id: "d1", type: "invitation", recipient_name: "Someone", subject: "An Invitation", body: "Dear..." }],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: {} });

  render(<Communications />);
  fireEvent.click(await screen.findByText("Draft queue"));

  fireEvent.click(await screen.findByText("✕ Delete"));
  expect(client.delete).not.toHaveBeenCalled();

  jest.useFakeTimers();
  fireEvent.click(screen.getByText("Confirm delete"));

  expect(screen.getByText("An Invitation deleted")).toBeInTheDocument();
  expect(client.delete).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(6000);
  });
  jest.useRealTimers();

  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/communications/drafts/d1"));
});

test("saves the finalized email to the draft queue", async () => {
  client.post.mockImplementation((url) => {
    if (url === "/api/communications/chat") {
      return Promise.resolve({
        data: {
          done: true,
          subject: "An Invitation",
          body: "Dear Speaker,\n\n...",
          messages: [
            { role: "user", content: "Invite them to the conference" },
            { role: "assistant", content: "Dear Speaker,\n\n..." },
          ],
        },
      });
    }
    if (url === "/api/communications/drafts") {
      return Promise.resolve({ data: { _id: "d1" } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<Communications />);
  await screen.findByText(/Type a name manually/);

  fireEvent.change(screen.getByPlaceholderText("Recipient name"), {
    target: { value: "Someone Speaker" },
  });
  const textarea = screen.getByPlaceholderText(/Friday June 12/);
  fireEvent.change(textarea, { target: { value: "Invite them to the conference" } });
  fireEvent.click(screen.getByText("✦ Start"));

  fireEvent.click(await screen.findByText("✓ Save to drafts"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/communications/drafts",
      expect.objectContaining({
        recipient_name: "Someone Speaker",
        subject: "An Invitation",
      }),
    ),
  );
});
