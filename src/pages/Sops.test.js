import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Sops from "./Sops";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

let mockRole = "admin";
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { ministries: [{ ministry_id: "ktm-test", role: mockRole }] },
    ministryId: "ktm-test",
  }),
}));

const pendingDraft = {
  _id: "sop1",
  title: "Sunday Setup",
  content: "1. Arrange chairs\n2. Test sound",
  status: "pending_review",
};

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  mockRole = "admin";
});

test("drafts a new SOP from uploaded images and notes", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.post.mockImplementation((url) => {
    if (url === "/api/profile/sops/draft") return Promise.resolve({ data: pendingDraft });
    return Promise.resolve({ data: {} });
  });

  render(<Sops />);
  await screen.findByText("SOPs");

  const file = new File(["fake"], "process.png", { type: "image/png" });
  const fileInput = document.querySelector('input[type="file"]');
  fireEvent.change(fileInput, { target: { files: [file] } });

  fireEvent.change(screen.getByPlaceholderText("Notes about this process..."), {
    target: { value: "These are screenshots of Sunday setup" },
  });
  fireEvent.click(screen.getByText("✦ Draft SOP"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/profile/sops/draft",
      expect.anything(),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } }),
    ),
  );

  expect(await screen.findByText("Sunday Setup")).toBeInTheDocument();
});

test("approves a pending SOP draft", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.put.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts/sop1/approve") {
      return Promise.resolve({ data: { ...pendingDraft, status: "approved" } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<Sops />);
  await screen.findByText("Sunday Setup");
  fireEvent.click(screen.getByText("✓ Approve"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/sops/drafts/sop1/approve", {}),
  );

  // Approved now, so it drops out of the default "Pending" filter view.
  await waitFor(() => expect(screen.queryByText("Sunday Setup")).not.toBeInTheDocument());
});

test("rejecting a draft opens a notes field and sends the notes to the reject endpoint", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.put.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts/sop1/reject") {
      return Promise.resolve({ data: { ...pendingDraft, status: "rejected" } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<Sops />);
  await screen.findByText("Sunday Setup");
  fireEvent.click(screen.getByText("✕ Reject"));

  fireEvent.change(screen.getByPlaceholderText(/Why is this being rejected/), {
    target: { value: "Wrong setup order for this event type." },
  });
  fireEvent.click(screen.getByText("Confirm reject"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/sops/drafts/sop1/reject", {
      notes: "Wrong setup order for this event type.",
    }),
  );
});

test("rejecting a draft without entering notes sends notes: undefined", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: { ...pendingDraft, status: "rejected" } });

  render(<Sops />);
  await screen.findByText("Sunday Setup");
  fireEvent.click(screen.getByText("✕ Reject"));
  fireEvent.click(screen.getByText("Confirm reject"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/sops/drafts/sop1/reject", { notes: undefined }),
  );
});

test("edits an SOP draft's title and content before saving", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({
    data: { ...pendingDraft, title: "Sunday Morning Setup" },
  });

  render(<Sops />);
  await screen.findByText("Sunday Setup");
  fireEvent.click(screen.getByText("✎ Edit"));

  const titleInput = screen.getByDisplayValue("Sunday Setup");
  fireEvent.change(titleInput, { target: { value: "Sunday Morning Setup" } });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/profile/sops/drafts/sop1",
      expect.objectContaining({ title: "Sunday Morning Setup" }),
    ),
  );
});

test("deleting an SOP draft requires a confirm step", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: { deleted: true } });

  render(<Sops />);
  await screen.findByText("Sunday Setup");
  fireEvent.click(screen.getByText("Delete"));
  expect(client.delete).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Confirm delete"));
  await waitFor(() =>
    expect(client.delete).toHaveBeenCalledWith("/api/profile/sops/drafts/sop1"),
  );
});

test("adding an SOP you already wrote skips AI drafting but still lands in Pending", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    return Promise.resolve({ data: [] });
  });
  client.post.mockImplementation((url) => {
    if (url === "/api/profile/sops") {
      return Promise.resolve({ data: { ...pendingDraft, _id: "sop2", title: "Existing SOP" } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<Sops />);
  await screen.findByText("SOPs");
  fireEvent.click(screen.getByText("I already have an SOP"));

  fireEvent.change(screen.getByPlaceholderText("Title"), {
    target: { value: "Existing SOP" },
  });
  fireEvent.change(screen.getByPlaceholderText("Paste the SOP content here..."), {
    target: { value: "1. Do the thing." },
  });
  fireEvent.click(screen.getByText("Add SOP"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith("/api/profile/sops", {
      title: "Existing SOP",
      content: "1. Do the thing.",
    }),
  );
});

test("exports an SOP as a PDF via a blob download, in internal or clean mode", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
    if (url.startsWith("/api/profile/sops/drafts/sop1/export")) {
      return Promise.resolve({ data: new Blob(["fake-pdf"]) });
    }
    return Promise.resolve({ data: [] });
  });

  const createObjectURL = jest.fn().mockReturnValue("blob:fake-url");
  const revokeObjectURL = jest.fn();
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;

  render(<Sops />);
  await screen.findByText("Sunday Setup");
  fireEvent.click(screen.getByText("⬇ Export (clean)"));

  await waitFor(() =>
    expect(client.get).toHaveBeenCalledWith(
      "/api/profile/sops/drafts/sop1/export?mode=clean",
      { responseType: "blob" },
    ),
  );
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
});

test("shows a restricted message for a team-role user instead of the SOPs UI", async () => {
  mockRole = "team";

  render(<Sops />);
  expect(
    await screen.findByText("Only admins and leaders can view and manage SOPs."),
  ).toBeInTheDocument();
});
