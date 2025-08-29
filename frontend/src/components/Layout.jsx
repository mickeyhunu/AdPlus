// src/components/Layout.jsx
import React, { useEffect } from "react";
import Header from "./Header";

export default function Layout({ children, onLogout, token, idleRemaining, onKeepAlive, user = null }) {
  // ✅ 개발 모드에서만 user 로그
  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[Layout] user prop =", user);
    }
  }, [user]);

  return (
    <div className="flex flex-col h-screen">
      <Header token={token} user={user} onLogout={onLogout}
             idleRemaining={idleRemaining} onKeepAlive={onKeepAlive} />
      <div className="flex flex-1">
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
