import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Team from "./Team";

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
    if (url === "/api/ministry/team") {
      return Promise.resolve({
        data: [
          { _id: "u1", name: "Alex Admin", email: "alex@ktm.com", role: "admin" },
          { _id: "u2", name: "Tina Team", email: "tina@ktm.com", role: "team" },
        ],
      });
    }
    if (url === "/api/invites") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
});

test("lists the team roster with each person's current role", async () => {
  render(<Team />);

  expect(await screen.findByText("Alex Admin")).toBeInTheDocument();
  expect(screen.getByText("Tina Team")).toBeInTheDocument();
});

test("changing someone's role calls the update endpoint and reflects it immediately", async () => {
  client.put.mockResolvedValue({ data: { _id: "u2", role: "leader" } });
  render(<Team />);

  await screen.findByText("Tina Team");
  const selects = screen.getAllByRole("combobox");
  const tinaSelect = selects[1];
  expect(tinaSelect.value).toBe("team");

  fireEvent.change(tinaSelect, { target: { value: "leader" } });

  await waitFor(() => expect(client.put).toHaveBeenCalledWith("/api/ministry/team/u2", { role: "leader" }));
  await waitFor(() => expect(tinaSelect.value).toBe("leader"));
});

test("sending an invite posts the email/name/role and shows it in the pending list", async () => {
  client.post.mockResolvedValue({
    data: {
      _id: "inv1",
      name: "New Person",
      email: "newperson@ktm.com",
      role: "leader",
      invite_link: "https://margin-app.example/join/abc123",
    },
  });

  render(<Team />);
  await screen.findByText("Alex Admin");

  fireEvent.click(screen.getByText("+ Add member"));
  fireEvent.change(screen.getByPlaceholderText("Name (optional)"), { target: { value: "New Person" } });
  fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "newperson@ktm.com" } });
  fireEvent.click(screen.getByText("Create invite"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/invites",
      expect.objectContaining({ name: "New Person", email: "newperson@ktm.com" }),
    ),
  );

  expect(await screen.findByText("Pending invites")).toBeInTheDocument();
  expect(screen.getByText(/invited as Leader/)).toBeInTheDocument();
});

test("pressing Enter in the email field sends the invite without clicking the button", async () => {
  client.post.mockResolvedValue({
    data: {
      _id: "inv2",
      name: "",
      email: "quick@ktm.com",
      role: "team",
      invite_link: "https://margin-app.example/join/xyz789",
    },
  });

  render(<Team />);
  await screen.findByText("Alex Admin");

  fireEvent.click(screen.getByText("+ Add member"));
  fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: "quick@ktm.com" } });
  fireEvent.keyDown(screen.getByPlaceholderText("Email"), { key: "Enter" });

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith(
      "/api/invites",
      expect.objectContaining({ email: "quick@ktm.com" }),
    ),
  );
});

test("revoking an invite removes it from the pending list", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/ministry/team") return Promise.resolve({ data: [] });
    if (url === "/api/invites") {
      return Promise.resolve({
        data: [
          {
            _id: "inv1",
            name: "New Person",
            email: "newperson@ktm.com",
            role: "team",
            invite_link: "https://margin-app.example/join/abc123",
          },
        ],
      });
    }
    return Promise.resolve({ data: [] });
  });
  client.delete.mockResolvedValue({ data: { revoked: true } });

  render(<Team />);
  expect(await screen.findByText("New Person")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Revoke"));

  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/invites/inv1"));
  await waitFor(() => expect(screen.queryByText("New Person")).not.toBeInTheDocument());
});

test("shows an error if the role change is rejected (e.g. last admin)", async () => {
  client.put.mockRejectedValue({ response: { data: { error: "Can't remove the last admin — promote someone else first" } } });
  render(<Team />);

  await screen.findByText("Alex Admin");
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[0], { target: { value: "team" } });

  expect(await screen.findByText(/last admin/)).toBeInTheDocument();
});

test("shows a member's other linked ministries when they belong to more than one", async () => {
  client.get.mockImplementation((url) => {
    if (url === "/api/ministry/team") {
      return Promise.resolve({
        data: [
          {
            _id: "u1",
            name: "Alex Admin",
            email: "alex@ktm.com",
            role: "admin",
            other_ministries: [{ ministry_id: "salt-light", name: "Salt & Light", role: "admin" }],
          },
          { _id: "u2", name: "Tina Team", email: "tina@ktm.com", role: "team", other_ministries: [] },
        ],
      });
    }
    if (url === "/api/invites") return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });

  render(<Team />);

  await screen.findByText("Alex Admin");
  expect(screen.getByText(/Also in:/)).toBeInTheDocument();
  expect(screen.getByText("Salt & Light")).toBeInTheDocument();
  expect(screen.getByText("(admin)")).toBeInTheDocument();
  // Tina has no other memberships, so no "Also in:" line for her.
  expect(screen.getAllByText(/Also in:/).length).toBe(1);
});
