// src/components/IdleLogout.jsx
import { useEffect, useRef, useState } from "react";

const DEFAULT_LIMIT_MS = 60 * 60 * 1000;   // 1시간
const DEFAULT_WARN_MS  = 60 * 1000;        // 1분 전 경고
const STORAGE_KEY = "lastActivityAt";

export default function IdleLogout({
  enabled = true,
  limitMs = DEFAULT_LIMIT_MS,
  warnBeforeMs = DEFAULT_WARN_MS,
  onTimeout, // 필수: () => void (로그아웃 핸들러)
}) {
  const [remaining, setRemaining] = useState(null);
  const warnTimer = useRef();
  const logoutTimer = useRef();
  const tickInterval = useRef();

  useEffect(() => {
    if (!enabled) return;

    // ── 스케줄링
    const schedule = (last) => {
      clearTimeout(warnTimer.current);
      clearTimeout(logoutTimer.current);
      clearInterval(tickInterval.current);

      const elapsed = Date.now() - last;
      const rem = Math.max(0, limitMs - elapsed);
      setRemaining(rem);

      if (rem <= 0) {
        onTimeout?.();
        return;
      }

      const warnDelay = Math.max(0, rem - warnBeforeMs);
      warnTimer.current = setTimeout(() => setRemaining(warnBeforeMs), warnDelay);
      logoutTimer.current = setTimeout(() => onTimeout?.(), rem);

      // 1초마다 남은 시간 갱신(경고 영역 보일 때)
      tickInterval.current = setInterval(() => {
        setRemaining((r) => (r != null ? Math.max(0, r - 1000) : null));
      }, 1000);
    };

    // ── 활동 기록 & 탭 간 동기화
    const touch = () => {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, String(now));
      schedule(now);
    };
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        schedule(Number(e.newValue));
      }
    };

    // 초기화
    const last = Number(localStorage.getItem(STORAGE_KEY)) || Date.now();
    localStorage.setItem(STORAGE_KEY, String(last));
    schedule(last);

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "focus"];
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) touch(); // 다시 볼 때 활동으로 간주
    });

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, touch));
      window.removeEventListener("storage", onStorage);
      clearTimeout(warnTimer.current);
      clearTimeout(logoutTimer.current);
      clearInterval(tickInterval.current);
    };
  }, [enabled, limitMs, warnBeforeMs, onTimeout]);

  // 경고 배너 (선택)
  if (!enabled || remaining == null || remaining > warnBeforeMs) return null;
  const sec = Math.ceil(remaining / 1000);

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-white shadow-lg border px-3 py-2 text-sm">
      <div>1시간 동안 활동이 없어 곧 로그아웃됩니다.</div>
      <div className="font-semibold mt-1">남은 시간: {sec}초</div>
      <button
        className="mt-2 text-blue-600 underline"
        onClick={() => {
          const now = Date.now();
          localStorage.setItem(STORAGE_KEY, String(now)); // 연장
        }}
      >
        계속 이용하기
      </button>
    </div>
  );
}
