// src/components/Header.jsx
import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./Sidebar";

// 항상 HH:MM:SS 고정 포맷으로 (폭 안정)
function fmtMs(ms) {
  if (ms == null) return "";
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function Header({ onLogout, token, user, idleRemaining, onKeepAlive }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  const displayName = user?.nickName || user?.username || "사용자";

  return (
    <header className="w-full bg-blue-200 text-blue-900 shadow-md relative z-40">
      <div className="mx-auto flex h-20 items-center px-4 sm:h-24 md:h-28 md:px-6">
        {/* 왼쪽: 메뉴 버튼 */}
        <div className="flex-1 flex items-center">
          <button
            ref={btnRef}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="app-sidebar"
            aria-label="사이드바 열기"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 font-medium text-blue-800 hover:bg-blue-50 active:bg-blue-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-200"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            메뉴
          </button>
        </div>

        {/* 중앙: 로고 */}
        <div className="flex-1 flex justify-center">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/logo.png"
              alt="ADplus Logo"
              className="h-16 sm:h-20 md:h-24 w-auto object-contain max-w-none"
            />
          </Link>
        </div>

        {/* 오른쪽: 접속자/타이머/로그아웃 */}
        <div className="flex-1 flex justify-end items-center gap-3">
          {token ? (
            <>
              {/* 닉네임 뱃지 + 남은 시간 (테두리 고정폭) */}
              <div
                className="
                  hidden sm:flex items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5
                  border border-blue-300
                  min-w-[260px]  /* ✅ 박스 최소 폭 고정 (원하면 w-[260px]로 완전 고정) */
                  justify-between  /* 내부 간격 균등 */
                "
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-sm font-semibold"
                    title={displayName}
                  >
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <strong className="text-sm text-blue-900">{displayName}</strong>
                </div>

                {idleRemaining != null && (
                  <div className="flex items-center gap-2 text-sm text-blue-800/80">
                    {/* 숫자 폭 고정: 모노스페이스 + 고정폭 */}
                    <span className="font-mono tabular-nums w-[84px] text-right">
                      ⏱ {fmtMs(idleRemaining)}
                    </span>
                    <button
                      type="button"
                      onClick={onKeepAlive}
                      className="underline text-blue-700 hover:text-blue-900 shrink-0"
                      title="시간 연장"
                    >
                      연장
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={onLogout}
                className="bg-white text-blue-700 font-semibold px-4 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-200"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-white text-blue-700 font-semibold px-4 py-2 rounded-lg border border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-200"
            >
              로그인
            </Link>
          )}
        </div>
      </div>

      {/* 사이드바 */}
      <Sidebar
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        triggerRef={btnRef}
      />
    </header>
  );
}
