import axios from "axios";

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("margin_token");
  const ministryId = localStorage.getItem("margin_ministry_id");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // A caller can pass its own x-ministry-id (e.g. the Calendar page
  // fetching events across several ministry memberships at once) —
  // only fall back to the active ministry when nothing was set.
  if (ministryId && !config.headers["x-ministry-id"]) {
    config.headers["x-ministry-id"] = ministryId;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // A 401 with no prior token is just a failed login attempt (bad
      // password) — that has its own inline error in Login.js and must
      // not be clobbered by a forced redirect. Only a request that WAS
      // carrying a token means a previously-authenticated session just
      // got invalidated (expired/revoked), which is the case worth
      // bouncing to login with an explanation for.
      const hadToken = !!localStorage.getItem("margin_token");
      localStorage.removeItem("margin_token");
      localStorage.removeItem("margin_ministry_id");
      localStorage.removeItem("margin_user");
      if (hadToken && window.location.pathname !== "/login") {
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject(error);
  },
);

export default client;
