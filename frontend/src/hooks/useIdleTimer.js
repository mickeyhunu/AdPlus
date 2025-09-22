// src/hooks/useIdleTimer.js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * @param {Object} opts
 * @param {boolean} opts.enabled   - 타이머 활성화 여부
 * @param {number}  opts.limitMs   - 유휴 제한 (ms)
 * @param {number}  [opts.warnBeforeMs] - (옵션) 만료 전 경고 ms
 * @param {Function}[opts.onTimeout]    - 만료 콜백 (한 번만 호출)
 */
export default function useIdleTimer({
  enabled = true,
  limitMs = 60 * 60 * 1000,
  warnBeforeMs, // 필요 시 사용
  onTimeout,
} = {}) {
  const [remaining, setRemaining] = useState(limitMs);

  const deadlineRef = useRef(null);
  const timedOutRef = useRef(false);
  const intervalRef = useRef(null);

  const now = () => Date.now();

  // 외부에서 수동 연장
  const reset = useCallback(() => {
    const dl = now() + limitMs;
    deadlineRef.current = dl;
    timedOutRef.current = false;
    // 즉시 화면에 반영
    setRemaining(dl - now());
  }, [limitMs]);

  const handleTimeout = useCallback(() => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    onTimeout?.();
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) {
      deadlineRef.current = null;
      timedOutRef.current = false;
      setRemaining(limitMs);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 최초 시작/재시작 시점에 데드라인 설정
    reset();

    // 1초마다 남은 시간 갱신 & 만료 체크
    intervalRef.current = setInterval(() => {
      const dl = deadlineRef.current ?? now() + limitMs;
      const rem = Math.max(0, dl - now());

      // 같은 값이면 setState 생략(불필요 렌더 줄이기)
      setRemaining((prev) => (prev !== rem ? rem : prev));

      if (rem === 0) handleTimeout();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // enabled/limitMs 바뀔 때만 재설치. reset/handleTimeout은 useCallback으로 안정화됨.
  }, [enabled, limitMs, reset, handleTimeout]);

  return { remaining, reset };
}
