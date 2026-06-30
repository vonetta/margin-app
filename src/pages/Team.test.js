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
  client.put.mockReset();
  client.get.mockResolvedValue({
    data: [
      { _id: "u1", name: "Alex Admin", email: "alex@ktm.com", role: "admin" },
      { _id: "u2", name: "Tina Team", email: "tina@ktm.com", role: "team" },
    ],
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

test("shows an error if the role change is rejected (e.g. last admin)", async () => {
  client.put.mockRejectedValue({ response: { data: { error: "Can't remove the last admin — promote someone else first" } } });
  render(<Team />);

  await screen.findByText("Alex Admin");
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[0], { target: { value: "team" } });

  expect(await screen.findByText(/last admin/)).toBeInTheDocument();
});
