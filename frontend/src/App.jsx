// src/App.jsx
import React, { useCallback, useEffect, useState } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Ads from "./pages/Ads";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import MyPage from "./pages/MyPage"
import ProtectedRoute from "./components/ProtectedRoute";
import { setToken } from "./api";
import { getMe } from "./api/auth";
import useIdleTimer from "./hooks/useIdleTimer";

function readStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn("[App] Failed to parse stored user", err);
    return null;
  }
}

export default function App() {
  const [token, setTok] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("token");
  });
  const [user, setUser] = useState(() => readStoredUser());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = (event) => {
      let nextUser = event?.detail;
      if (!nextUser || typeof nextUser !== "object") {
        try {
          const raw = window.localStorage.getItem("user");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              nextUser = parsed;
            }
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn("[App] Failed to parse user from storage event", err);
          }
        }
      }

      if (!nextUser || typeof nextUser !== "object") return;
      setUser(nextUser);
    };

    window.addEventListener("adplus:user-updated", handler);
    return () => window.removeEventListener("adplus:user-updated", handler);
  }, []);

  useEffect(() => {
    setToken(token);
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    if (!token) {
      setUser(null);
      storage?.removeItem("user");
      return;
    }
    getMe()
      .then(({ data }) => {
        setUser(data);
        storage?.setItem("user", JSON.stringify(data));
      })
      .catch(() => {
        setUser(null);
        storage?.removeItem("user");
    });
  }, [token]);

  // 만료 시 처리 콜백을 안정화
  const handleTimeout = useCallback(() => {
    alert("세션이 만료되어 로그아웃되었습니다.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    }
    setTok(null);
    setUser(null);
  }, []);

  // ⏱ 전역 유휴타이머 (App 상단에서 1회만)
  const { remaining: idleRemaining, reset: keepAlive } = useIdleTimer({
    enabled: !!token,
    limitMs: 60 * 60 * 1000, // 1시간
    warnBeforeMs: 60 * 1000,
    onTimeout: handleTimeout,
  });

  const handleLogout = useCallback(() => {
    alert("로그아웃되었습니다.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("user");
    }
    setTok(null);
    setUser(null);
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              token={token}
              user={user}
              onLogout={handleLogout}
              idleRemaining={idleRemaining}
              onKeepAlive={keepAlive}
            >
              <Home />
            </Layout>
          }
        />

        <Route
          path="/login"
          element={
            token ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Layout
                token={token}
                user={user}
                onLogout={handleLogout}
                idleRemaining={idleRemaining}
                onKeepAlive={keepAlive}
              >
                <Login
                  onLogin={(t) => {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem("token", t);
                    }
                    setTok(t); // useEffect가 /auth/me로 user 로딩
                  }}
                />
              </Layout>
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute token={token}>
              <Layout
                token={token}
                user={user}
                onLogout={handleLogout}
                idleRemaining={idleRemaining}
                onKeepAlive={keepAlive}
              >
                <Dashboard user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ads"
          element={
            <ProtectedRoute token={token}>
              <Layout
                token={token}
                user={user}
                onLogout={handleLogout}
                idleRemaining={idleRemaining}
                onKeepAlive={keepAlive}
              >
                <Ads user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/logs"
          element={
            <ProtectedRoute token={token}>
              <Layout
                token={token}
                user={user}
                onLogout={handleLogout}
                idleRemaining={idleRemaining}
                onKeepAlive={keepAlive}
              >
                <Logs />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute token={token}>
              <Layout
                token={token}
                user={user}
                onLogout={handleLogout}
                idleRemaining={idleRemaining}
                onKeepAlive={keepAlive}
              >
                <Settings />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-page"
          element={
            <ProtectedRoute token={token}>
              <Layout
                token={token}
                user={user}
                onLogout={handleLogout}
                idleRemaining={idleRemaining}
                onKeepAlive={keepAlive}
              >
                <MyPage user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
