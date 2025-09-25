import api from './index';

export const login = (username, password) => api.post("/auth/login", { username, password });
export const getMe = () => api.get("/auth/me");
export const updatePassword = (currentPassword, newPassword) =>
  api.patch("/auth/password", { currentPassword, newPassword });
export const updateExcludedIps = (ips) => api.put("/auth/excluded-ips", { ips });