import React, { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ open, onOpen, onClose, triggerRef }) {
  const asideRef = useRef(null);
  const closeTimer = useRef(null);

  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    onOpen?.();
  };
  const scheduleClose = (ms = 200) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => onClose?.(), ms);
  };

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 바깥 클릭 닫기 (버튼 제외)
  useEffect(() => {
    const onDown = (e) => {
      if (!open) return;
      const inAside = asideRef.current?.contains(e.target);
      const inBtn = triggerRef?.current?.contains(e.target);
      if (!inAside && !inBtn) onClose?.();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, triggerRef]);

  return (
    <>
      <aside
        ref={asideRef}
        onMouseEnter={keepOpen}
        onMouseLeave={() => scheduleClose(200)}
        className={`fixed left-0 top-0 bottom-0 z-50 w-72 bg-white/95 backdrop-blur-sm shadow-xl border-r border-blue-100 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-label="사이드바"
      >
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="text-blue-900 font-semibold">빠른 메뉴</div>
          <button
            onClick={onClose}
            aria-label="사이드바 닫기"
            className="rounded-md p-1 hover:bg-blue-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="px-2 space-y-1">
          <SidebarLink to="/" label="홈" onNavigate={onClose} />
          <SidebarLink to="/dashboard" label="대시보드" onNavigate={onClose} />
          <SidebarLink to="/ads" label="광고 관리" onNavigate={onClose} />
          <SidebarLink to="/logs" label="로그 조회" onNavigate={onClose} />
          <SidebarLink to="/settings" label="설정" onNavigate={onClose} />
          <SidebarLink to="/my-page" label="마이페이지" onNavigate={onClose} />
        </nav>

        <div className="mt-auto p-4 text-xs text-blue-600/70">ADplus</div>
      </aside>

      {/* 모바일 오버레이 */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 md:hidden transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}

function SidebarLink({ to, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-blue-900 hover:bg-blue-50 active:bg-blue-100 transition ${
          isActive ? "bg-blue-100 font-semibold" : "font-medium"
        }`
      }
    >
      <span className="w-2 h-2 rounded-full bg-blue-400" />
      <span>{label}</span>
    </NavLink>
  );
}
