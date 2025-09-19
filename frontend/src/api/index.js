import axios from "axios";

// 백엔드와 같은 도메인에서 서빙되므로 상대 경로로 충분
const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export function setToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

if (typeof window !== "undefined") {
  const storedToken = window.localStorage.getItem("token");
  if (storedToken) setToken(storedToken);
}

export default api;