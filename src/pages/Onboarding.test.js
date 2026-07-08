import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Onboarding from "./Onboarding";

jest.mock("../api/client", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));
const client = require("../api/client");

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ refreshUser: jest.fn() }) }));

beforeEach(() => {
  client.get.mockReset();
  client.post.mockReset();
  client.put.mockReset();
  // loadExisting on mount: minimal ministry + profile so the wizard renders.
  client.get.mockImplementation((url) => {
    if (url === "/api/ministry") return Promise.resolve({ data: { branding: {} } });
    if (url === "/api/profile") return Promise.resolve({ data: { voice_profile: {}, hashtags: {}, ctas: {} } });
    return Promise.resolve({ data: {} });
  });
});

test("prefilling from a website posts the URL and shows a success notice", async () => {
  client.post.mockResolvedValue({
    data: {
      voice_profile: { persona_name: "Grace", tone_pillars: ["warm"], sample_phrases: [], avoid: [] },
      suggested_colors: { primary: "#2b4a7a", accent: "" },
      hashtags: { brand: ["#Grace"], content: [] },
      source: { url: "https://grace.org/", had_readable_text: true },
    },
  });

  render(<Onboarding />);
  await screen.findByText("✨ Start from your website");

  fireEvent.change(screen.getByPlaceholderText("https://yourministry.org"), {
    target: { value: "https://grace.org" },
  });
  fireEvent.click(screen.getByText("Fill from my website"));

  await waitFor(() =>
    expect(client.post).toHaveBeenCalledWith("/api/profile/onboarding/prefill", {
      website_url: "https://grace.org",
      past_posts: undefined,
    }),
  );
  expect(await screen.findByText(/drafted your profile from your website/)).toBeInTheDocument();
});

test("a thin scrape tells the user to fill in manually", async () => {
  client.post.mockResolvedValue({
    data: {
      voice_profile: { persona_name: "", tone_pillars: [], sample_phrases: [], avoid: [] },
      suggested_colors: {},
      hashtags: {},
      source: { had_readable_text: false },
    },
  });

  render(<Onboarding />);
  await screen.findByText("✨ Start from your website");
  fireEvent.change(screen.getByPlaceholderText("https://yourministry.org"), {
    target: { value: "https://sparse.org" },
  });
  fireEvent.click(screen.getByText("Fill from my website"));

  expect(await screen.findByText(/couldn't pull much/i)).toBeInTheDocument();
});

test("a blocked/invalid URL surfaces the server's error message", async () => {
  client.post.mockRejectedValue({ response: { data: { error: "That address isn't allowed" } } });

  render(<Onboarding />);
  await screen.findByText("✨ Start from your website");
  fireEvent.change(screen.getByPlaceholderText("https://yourministry.org"), {
    target: { value: "http://169.254.169.254" },
  });
  fireEvent.click(screen.getByText("Fill from my website"));

  expect(await screen.findByText("That address isn't allowed")).toBeInTheDocument();
});

test("the fill button is disabled until a URL is entered", async () => {
  render(<Onboarding />);
  await screen.findByText("✨ Start from your website");
  expect(screen.getByText("Fill from my website")).toBeDisabled();
});
