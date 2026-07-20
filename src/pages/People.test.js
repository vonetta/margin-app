import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import People from "./People";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
const client = require("../api/client");

const roster = [
  { _id: "p1", name: "Apostle Khy Traylor", title: "Senior Pastor", role: "host", email: "khy@ktm.com" },
  { _id: "p2", name: "Prophetess Mesha", title: "Worship Leader", role: "speaker", email: "mesha@ktm.com" },
  { _id: "p3", name: "Conita Reed", title: "Event Coordinator", role: "leader", email: "conita@ktm.com" },
];

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  client.delete.mockReset();
  client.get.mockResolvedValue({ data: roster });
});

test("groups the roster by role with a count per group", async () => {
  render(<People />);

  expect(await screen.findByText("Hosts (1)")).toBeInTheDocument();
  expect(screen.getByText("Speakers (1)")).toBeInTheDocument();
  expect(screen.getByText("Leaders (1)")).toBeInTheDocument();
  expect(screen.getByText("Apostle Khy Traylor")).toBeInTheDocument();
});

test("search filters the roster by name, title, or email", async () => {
  render(<People />);
  await screen.findByText("Apostle Khy Traylor");

  fireEvent.change(screen.getByPlaceholderText("Search by name, title, or email..."), {
    target: { value: "mesha" },
  });

  expect(screen.queryByText("Apostle Khy Traylor")).not.toBeInTheDocument();
  expect(screen.getByText("Prophetess Mesha")).toBeInTheDocument();
});

test("shows a no-match message when the search finds nobody", async () => {
  render(<People />);
  await screen.findByText("Apostle Khy Traylor");

  fireEvent.change(screen.getByPlaceholderText("Search by name, title, or email..."), {
    target: { value: "nonexistent" },
  });

  expect(await screen.findByText(/No one matches "nonexistent"/)).toBeInTheDocument();
});

test("deleting a person requires a confirm step, then defers the DELETE call behind an undo window", async () => {
  render(<People />);
  const person = await screen.findByText("Apostle Khy Traylor");
  fireEvent.click(person);

  fireEvent.click(await screen.findByText("Delete"));
  expect(client.delete).not.toHaveBeenCalled();

  jest.useFakeTimers();
  fireEvent.click(screen.getByText("Confirm delete"));

  expect(screen.getByText("Apostle Khy Traylor deleted")).toBeInTheDocument();
  expect(client.delete).not.toHaveBeenCalled();

  act(() => {
    jest.advanceTimersByTime(6000);
  });
  jest.useRealTimers();

  await waitFor(() => expect(client.delete).toHaveBeenCalledWith("/api/people/p1"));
});

test("canceling out of the confirm step does not delete", async () => {
  render(<People />);
  const person = await screen.findByText("Apostle Khy Traylor");
  fireEvent.click(person);

  fireEvent.click(await screen.findByText("Delete"));
  fireEvent.click(screen.getByText("×"));

  expect(screen.getByText("Delete")).toBeInTheDocument();
  expect(client.delete).not.toHaveBeenCalled();
});
