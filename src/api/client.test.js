import client from "./client";

// Axios doesn't expose a way to invoke an interceptor directly, but it
// does keep them on this internal array — calling the rejected handler
// ourselves lets us test the 401 behavior without mocking a real network
// round trip.
const rejectedHandler = client.interceptors.response.handlers[0].rejected;

const originalLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  delete window.location;
  window.location = { ...originalLocation, href: "", pathname: "/dashboard" };
});

afterAll(() => {
  window.location = originalLocation;
});

test("a 401 with no prior token (a failed login attempt) does not redirect", async () => {
  window.location.pathname = "/login";
  await expect(
    rejectedHandler({ response: { status: 401 } }),
  ).rejects.toBeDefined();

  expect(window.location.href).toBe("");
});

test("a 401 on a request that was carrying a token clears storage and redirects with ?expired=1", async () => {
  localStorage.setItem("margin_token", "stale-token");
  localStorage.setItem("margin_ministry_id", "ktm-test");
  localStorage.setItem("margin_user", JSON.stringify({ name: "Test" }));

  await expect(
    rejectedHandler({ response: { status: 401 } }),
  ).rejects.toBeDefined();

  expect(localStorage.getItem("margin_token")).toBeNull();
  expect(localStorage.getItem("margin_ministry_id")).toBeNull();
  expect(localStorage.getItem("margin_user")).toBeNull();
  expect(window.location.href).toBe("/login?expired=1");
});

test("does not redirect again if already on the login page", async () => {
  localStorage.setItem("margin_token", "stale-token");
  window.location.pathname = "/login";

  await expect(
    rejectedHandler({ response: { status: 401 } }),
  ).rejects.toBeDefined();

  expect(window.location.href).toBe("");
});

test("a non-401 error is passed through untouched", async () => {
  await expect(
    rejectedHandler({ response: { status: 500 } }),
  ).rejects.toBeDefined();

  expect(window.location.href).toBe("");
});
