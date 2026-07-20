import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

  jest.useFakeTimers();
  fireEvent.click(screen.getByText("Confirm"));

  expect(screen.getByText("KTM Main Page deleted")).toBeInTheDocument();
  expect(client.delete).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(6000);
  });
  jest.useRealTimers();

  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/social/accounts/acct1"));
});

test("removing a sample phrase hides it immediately, then defers the DELETE call behind an undo window", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        data: { voice_profile: { sample_phrases: ["Secure your spot today"] } },
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: {} });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Phrases"));

  expect(await screen.findByText("Secure your spot today")).toBeInTheDocument();

  jest.useFakeTimers();
  fireEvent.click(screen.getByText("✕"));

  expect(screen.queryByText("Secure your spot today")).not.toBeInTheDocument();
  expect(client.delete).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(6000);
  });
  jest.useRealTimers();

  await waitFor(() =>
    expect(client.delete).toHaveBeenCalledWith("/api/profile/phrases", {
      data: { phrase: "Secure your spot today" },
    }),
  );
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

test("edits communication registers and includes them in the voice save", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        data: { voice_profile: { registers: { formal: "Reverent and clear" } } },
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<ProfileEditor />);
  await screen.findByText("Voice");

  const formalInput = screen.getByDisplayValue("Reverent and clear");
  fireEvent.change(formalInput, { target: { value: "Reverent, warm, and clear" } });

  const energeticInput = screen.getByLabelText("energetic");
  fireEvent.change(energeticInput, { target: { value: "Upbeat and inviting" } });

  fireEvent.click(screen.getByText("Save voice profile"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith(
      "/api/profile/voice",
      expect.objectContaining({
        registers: { formal: "Reverent, warm, and clear", energetic: "Upbeat and inviting" },
      }),
    ),
  );
});

test("saves platform settings with per-platform notes, dropping notes for removed platforms", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        data: {
          voice_profile: {},
          platforms: ["Instagram", "Email"],
          platform_notes: { Instagram: "Keep it short", Email: "Can be longer" },
        },
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Advanced"));

  const platformsInput = await screen.findByDisplayValue("Instagram, Email");
  fireEvent.change(platformsInput, { target: { value: "Instagram" } });

  fireEvent.click(screen.getByText("Save platform settings"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/platform-settings", {
      platforms: ["Instagram"],
      platform_notes: { Instagram: "Keep it short" },
    }),
  );
});

test("saves visual guidelines as a list split from newline-separated text", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({ data: { voice_profile: {}, visual_prohibitions: ["Neon colors"] } });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Advanced"));

  const textarea = await screen.findByDisplayValue("Neon colors");
  fireEvent.change(textarea, { target: { value: "Neon colors\nCluttered backgrounds" } });

  fireEvent.click(screen.getByText("Save visual guidelines"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/visual-guidelines", {
      visual_prohibitions: ["Neon colors", "Cluttered backgrounds"],
    }),
  );
});

test("adds a template locally then saves the full list to the templates endpoint", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {}, templates: [] } });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Advanced"));

  fireEvent.change(await screen.findByPlaceholderText("Title (e.g. Event Announcement)"), {
    target: { value: "Event Announcement" },
  });
  fireEvent.change(screen.getByPlaceholderText("Template content..."), {
    target: { value: "Join us for {{event}} on {{date}}." },
  });
  fireEvent.click(screen.getByText("+ Add template"));

  expect(await screen.findByText("Event Announcement")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Save templates"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/templates", {
      templates: [{ title: "Event Announcement", content: "Join us for {{event}} on {{date}}." }],
    }),
  );
});

test("removes a recurring content entry before saving", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        data: { voice_profile: {}, recurring_content: [{ title: "Weekly Verse", content: "John 3:16" }] },
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });

  render(<ProfileEditor />);
  await screen.findByText("Voice");
  fireEvent.click(screen.getByText("Advanced"));

  expect(await screen.findByText("Weekly Verse")).toBeInTheDocument();
  fireEvent.click(screen.getByText("✕"));
  expect(screen.queryByText("Weekly Verse")).not.toBeInTheDocument();

  fireEvent.click(screen.getByText("Save recurring content"));

  await waitFor(() =>
    expect(client.put).toHaveBeenCalledWith("/api/profile/recurring-content", { recurring_content: [] }),
  );
});

test("warns before switching tabs with unsaved voice edits, and respects Cancel", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: { persona_name: "Original" } } });
    return Promise.resolve({ data: [] });
  });

  const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

  render(<ProfileEditor />);
  await screen.findByText("Voice");

  fireEvent.change(screen.getByDisplayValue("Original"), { target: { value: "Changed" } });
  fireEvent.click(screen.getByText("Phrases"));

  expect(confirmSpy).toHaveBeenCalled();
  // Cancelled, so the tab did not actually switch.
  expect(screen.getByDisplayValue("Changed")).toBeInTheDocument();
  expect(screen.queryByText("Add a sample phrase")).not.toBeInTheDocument();

  confirmSpy.mockRestore();
});

test("switches tabs freely once unsaved voice edits are saved", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: { persona_name: "Original" } } });
    return Promise.resolve({ data: [] });
  });
  client.put.mockResolvedValue({ data: {} });
  const confirmSpy = jest.spyOn(window, "confirm");

  render(<ProfileEditor />);
  await screen.findByText("Voice");

  fireEvent.change(screen.getByDisplayValue("Original"), { target: { value: "Changed" } });
  fireEvent.click(screen.getByText("Save voice profile"));
  await waitFor(() => expect(client.put).toHaveBeenCalled());
  // The mocked GET always echoes back "Original" — waiting for it to
  // reappear confirms the post-save refetch (and snapshot reset) landed.
  await screen.findByDisplayValue("Original");

  fireEvent.click(screen.getByText("Phrases"));
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(await screen.findByText("Add a sample phrase")).toBeInTheDocument();

  confirmSpy.mockRestore();
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

