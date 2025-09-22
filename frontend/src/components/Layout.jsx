// src/components/Layout.jsx
import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";

export default function Layout({ children, onLogout, token, idleRemaining, onKeepAlive, user = null }) {
  const location = useLocation();
  
  // ✅ 개발 모드에서만 user 로그
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[Layout] user prop =", user);
    }
  }, [user]);

  useEffect(() => {
    if (!token) return;
    onKeepAlive?.();
  }, [token, onKeepAlive, location.pathname, location.search, location.hash]);

  return (
    <div className="flex flex-col h-screen">
      <Header token={token} user={user} onLogout={onLogout}
             idleRemaining={idleRemaining} onKeepAlive={onKeepAlive} />
      <div className="flex flex-1">
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
      {/* 카카오톡 버튼 */}
      <a
        href="https://open.kakao.com/o/smSyreTh"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 flex items-center gap-3 rounded-full bg-[#381E1F] px-5 py-3 text-white shadow-lg transition hover:bg-[#2b1516]"
      >
        <img src="/kakaotalk-icon.svg" alt="카카오톡 문의" className="h-9 w-9" />
        <span className="text-sm font-medium">카카오톡 문의하기</span>
      </a>
    </div>
  );
}
