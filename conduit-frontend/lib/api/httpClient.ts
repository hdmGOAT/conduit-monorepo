import axios from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "./authToken";

const appAPIClient = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

appAPIClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    if (!("Authorization" in config.headers)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

appAPIClient.interceptors.response.use(
  (response) => {
    const token = response.data?.access_token;
    if (typeof token === "string" && token.length > 0 && response.config.url?.includes("/auth/")) {
      setAccessToken(token);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const requestUrl = String(originalRequest.url ?? "");
    if (requestUrl.includes("/auth/login") || requestUrl.includes("/auth/refresh") || requestUrl.includes("/auth/register")) {
      clearAccessToken();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await axios.post(
        "/api/auth/refresh",
        {},
        {
          baseURL: "",
          withCredentials: true,
        }
      );

      const nextToken = refreshResponse.data?.access_token;
      if (typeof nextToken !== "string" || nextToken.length === 0) {
        clearAccessToken();
        return Promise.reject(error);
      }

      setAccessToken(nextToken);
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return appAPIClient.request(originalRequest);
    } catch (refreshError) {
      clearAccessToken();
      return Promise.reject(refreshError);
    }
  }
);

export default appAPIClient;
