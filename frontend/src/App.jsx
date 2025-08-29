// src/App.jsx
import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import { setToken, getMe } from "./api";
import useIdleTimer from "./hooks/useIdleTimer";

const Ads = () => <div className="p-6">광고 관리 페이지</div>;
const Logs = () => <div className="p-6">로그 조회 페이지</div>;
const Settings = () => <div className="p-6">설정 페이지</div>;

export default function App() {
  const [token, setTok] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);

  useEffect(() => {
    setToken(token);
    if (!token) { setUser(null); return; }
    getMe().then(({ data }) => setUser(data)).catch(() => setUser(null));
  }, [token]);

  // 만료 시 처리 콜백을 안정화
  const handleTimeout = useCallback(() => {
    localStorage.removeItem("token");
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
    localStorage.removeItem("token");
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
                    localStorage.setItem("token", t);
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
                <Dashboard />
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
                <Ads />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
