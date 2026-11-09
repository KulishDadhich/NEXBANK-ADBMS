import axios from "axios";
export const api = axios.create({ baseURL: "/api", withCredentials: true });
let token = "";
let refreshing: Promise<string> | null = null;
export function setToken(value: string) {
  token = value;
}
api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export async function refresh() {
  if (!refreshing)
    refreshing = axios
      .post("/api/auth/refresh", {}, { withCredentials: true })
      .then((r) => {
        token = r.data.accessToken;
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status === 401 &&
      !config._retry &&
      !config.url.includes("/auth/")
    ) {
      config._retry = true;
      try {
        await refresh();
        return api(config);
      } catch {
        token = "";
        window.dispatchEvent(new Event("session-expired"));
      }
    }
    return Promise.reject(error);
  },
);
export const errorText = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.error || "Unable to connect. Please try again."
    : error instanceof Error
      ? error.message
      : "Something went wrong";
export function money(value: string | number | bigint = "0") {
  const n = BigInt(value),
    negative = n < 0n,
    v = negative ? -n : n;
  return (
    (negative ? "-" : "") +
    "₹" +
    (v / 100n).toLocaleString("en-IN") +
    "." +
    (v % 100n).toString().padStart(2, "0")
  );
}
