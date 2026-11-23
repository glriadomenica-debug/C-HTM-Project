
import axios from "axios";

const api = axios.create({
  baseURL: "https://c-htm-project.onrender.com/api",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Send the login token automatically with each request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export default api;
