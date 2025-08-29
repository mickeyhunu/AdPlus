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

export const login = (username, password) => api.post("/auth/login", { username, password });
export const getMe = () => api.get("/auth/me");
export const fetchStats = (arg = 7, bucket, ad) => {
  // 호환성 처리: 숫자면 예전 방식, 객체면 새로운 방식
  let params = {};
  if (typeof arg === "number") {
    params.days = arg;
    if (bucket) params.bucket = bucket;
    if (ad && ad !== "ALL") params.ad = ad;
  } else if (arg && typeof arg === "object") {
    const { days = 7, bucket: b, ad: a } = arg;
    params.days = days;
    if (b) params.bucket = b;
    if (a && a !== "ALL") params.ad = a;
  } else {
    params.days = 7;
  }
  return api.get("/ads/stats", { params });
};

// 내 광고 목록 가져오기
export const fetchMyAds = () => api.get("/ads/list");

export default api;
