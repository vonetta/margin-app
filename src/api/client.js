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
  if (ministryId) {
    config.headers["x-ministry-id"] = ministryId;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("margin_token");
      localStorage.removeItem("margin_ministry_id");
      localStorage.removeItem("margin_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default client;
