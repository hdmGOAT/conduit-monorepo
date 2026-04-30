import axios from "axios";

export function getAPIErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (payload && typeof payload === "object" && "error" in payload) {
      const message = payload.error;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  }

  return fallback;
}
