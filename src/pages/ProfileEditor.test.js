import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfileEditor from "./ProfileEditor";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { ministries: [{ ministry_id: "ktm-test", role: "admin" }] },
    ministryId: "ktm-test",
    refreshUser: jest.fn(),
    switchMinistry: jest.fn(),
  }),
}));

beforeEach(() => {
  client.get.mockReset();
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        data: { voice_profile: {}, hashtags: {}, sops: [], templates: [] },
      });
    }
    if (url === "/api/ministry/sub-ministries") {
      return Promise.resolve({
        data: [{ _id: "s1", ministry_id: "salt-light", name: "Salt & Light", tagline: "" }],
      });
    }
    if (url === "/api/ministry/org-overview") {
      return Promise.resolve({
        data: [
          {
            ministry_id: "salt-light",
            name: "Salt & Light",
            team_count: 3,
            pending_approvals: 2,
            open_tasks: 5,
            upcoming_events: 1,
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
});

test("shows aggregate counts next to each sub-ministry, without exposing individual records", async () => {
  render(<ProfileEditor />);
  await screen.findByText("Voice");

  fireEvent.click(screen.getByText("Sub-ministries"));

  await screen.findByText("Salt & Light");
  expect(await screen.findByText("3")).toBeInTheDocument();
  expect(screen.getByText("team")).toBeInTheDocument();
  expect(screen.getByText("2")).toBeInTheDocument();
  expect(screen.getByText("pending approvals")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument();
  expect(screen.getByText("open tasks")).toBeInTheDocument();
});

test("connecting a social account navigates the browser to Meta's OAuth URL", async () => {
  const originalLocation = window.location;
  delete window.location;
  window.location = { ...originalLocation, href: "", search: "" };

  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
    if (url === "/api/ministry/sub-ministries") return Promise.resolve({ data: [] });
    if (url === "/api/ministry/org-overview") return Promise.resolve({ data: [] });
    if (url === "/api/social/accounts") return Promise.resolve({ data: [] });
    if (url === "/api/social/connect") {
      return Promise.resolve({ data: { url: "https://www.facebook.com/v19.0/dialog/oauth?client_id=123" } });
    }
    return Promise.resolve({ data: [] });
  });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Social accounts"));

  fireEvent.click(await screen.findByText("Connect with Facebook"));

  await waitFor(() =>
    expect(window.location.href).toBe("https://www.facebook.com/v19.0/dialog/oauth?client_id=123"),
  );

  window.location = originalLocation;
});

test("lists connected social accounts and disconnects one after confirming", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
    if (url === "/api/ministry/sub-ministries") return Promise.resolve({ data: [] });
    if (url === "/api/ministry/org-overview") return Promise.resolve({ data: [] });
    if (url === "/api/social/accounts") {
      return Promise.resolve({
        data: [
          { _id: "acct1", page_name: "KTM Main Page", instagram_username: "ktm_ministries", status: "active" },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: { deleted: true } });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Social accounts"));

  expect(await screen.findByText("KTM Main Page")).toBeInTheDocument();
  expect(screen.getByText(/@ktm_ministries/)).toBeInTheDocument();

  fireEvent.click(screen.getByText("Disconnect"));
  expect(client.delete).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText("Confirm"));
  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/social/accounts/acct1"));
});

test("shows a status message and lands on the Social tab after a Meta redirect back", async () => {
  const originalLocation = window.location;
  delete window.location;
  window.location = { ...originalLocation, search: "?social=connected", pathname: "/profile" };

  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
    if (url === "/api/social/accounts") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });

  render(<ProfileEditor />);

  expect(await screen.findByText(/Connected!/)).toBeInTheDocument();
  expect(screen.getByText("Connected accounts (0)")).toBeInTheDocument();

  window.location = originalLocation;
});

test("still renders the sub-ministry even if the overview fetch fails", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({ data: { voice_profile: {} } });
    }
    if (url === "/api/ministry/sub-ministries") {
      return Promise.resolve({
        data: [{ _id: "s1", ministry_id: "salt-light", name: "Salt & Light" }],
      });
    }
    if (url === "/api/ministry/org-overview") {
      return Promise.reject(new Error("network error"));
    }
    return Promise.resolve({ data: [] });
  });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Sub-ministries"));

  expect(await screen.findByText("Salt & Light")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText("team")).not.toBeInTheDocument());
});

describe("SOPs tab", () => {
  const pendingDraft = {
    _id: "sop1",
    title: "Sunday Setup",
    content: "1. Arrange chairs\n2. Test sound",
    status: "pending_review",
  };

  test("drafts a new SOP from uploaded images and notes", async () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
      if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
      return Promise.resolve({ data: [] });
    });
    client.post.mockImplementation((url) => {
      if (url === "/api/profile/sops/draft") return Promise.resolve({ data: pendingDraft });
      return Promise.resolve({ data: {} });
    });

    render(<ProfileEditor />);
    await screen.findByText("Voice");
    fireEvent.click(screen.getByText("SOPs"));

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
      if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
      if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
      return Promise.resolve({ data: [] });
    });
    client.put.mockImplementation((url) => {
      if (url === "/api/profile/sops/drafts/sop1/approve") {
        return Promise.resolve({ data: { ...pendingDraft, status: "approved" } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<ProfileEditor />);
    await screen.findByText("Voice");
    fireEvent.click(screen.getByText("SOPs"));

    await screen.findByText("Sunday Setup");
    fireEvent.click(screen.getByText("✓ Approve"));

    await waitFor(() =>
      expect(client.put).toHaveBeenCalledWith("/api/profile/sops/drafts/sop1/approve", {}),
    );

    // Approved now, so it drops out of the default "Pending" filter view.
    await waitFor(() => expect(screen.queryByText("Sunday Setup")).not.toBeInTheDocument());
  });

  test("edits an SOP draft's title and content before saving", async () => {
    client.get.mockImplementation((url) => {
      if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
      if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
      return Promise.resolve({ data: [] });
    });
    client.put.mockResolvedValue({
      data: { ...pendingDraft, title: "Sunday Morning Setup" },
    });

    render(<ProfileEditor />);
    await screen.findByText("Voice");
    fireEvent.click(screen.getByText("SOPs"));

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
      if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
      if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
      return Promise.resolve({ data: [] });
    });
    client.delete.mockResolvedValue({ data: { deleted: true } });

    render(<ProfileEditor />);
    await screen.findByText("Voice");
    fireEvent.click(screen.getByText("SOPs"));

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
      if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {} } });
      if (url === "/api/profile/sops/drafts") return Promise.resolve({ data: [pendingDraft] });
      return Promise.resolve({ data: [] });
    });
    client.post.mockImplementation((url) => {
      if (url === "/api/profile/sops") {
        return Promise.resolve({ data: { ...pendingDraft, _id: "sop2", title: "Existing SOP" } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<ProfileEditor />);
    await screen.findByText("Voice");
    fireEvent.click(screen.getByText("SOPs"));

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
});
