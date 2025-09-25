import { useCallback, useEffect, useMemo, useState } from "react";
import { getMe, updateExcludedIps, updatePassword } from "../api/auth";

const MAX_IP_SLOTS = 3;

function normalizeIpInputs(list) {
  const initial = Array.isArray(list) ? list.slice(0, MAX_IP_SLOTS) : [];
  const filled = [...initial];
  while (filled.length < MAX_IP_SLOTS) {
    filled.push("");
  }
  return filled;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  try {
    return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch (err) {
    return date.toLocaleString();
  }
}

function extractErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    fallback ||
    "요청을 처리하지 못했습니다."
  );
}

export default function MyPage({ user }) {
  const [profile, setProfile] = useState(() =>
    user && typeof user === "object" ? user : null
  );
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const [ipInputs, setIpInputs] = useState(() =>
    normalizeIpInputs(user?.excludedIps || [])
  );
  const [ipSaving, setIpSaving] = useState(false);
  const [ipMessage, setIpMessage] = useState(null);

  const broadcastUser = useCallback((data) => {
    if (typeof window === "undefined" || !data || typeof data !== "object") {
      return;
    }

    try {
      window.localStorage.setItem("user", JSON.stringify(data));
    } catch (storageError) {
      if (import.meta.env.DEV) {
        console.warn("[MyPage] Failed to persist user", storageError);
      }
    }

    try {
      if (typeof window.CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent("adplus:user-updated", { detail: data }));
      } else if (
        typeof document !== "undefined" &&
        typeof document.createEvent === "function"
      ) {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("adplus:user-updated", true, true, data);
        window.dispatchEvent(evt);
      }
    } catch (eventError) {
      if (import.meta.env.DEV) {
        console.warn("[MyPage] Failed to dispatch user update", eventError);
      }
    }
  }, []);

  useEffect(() => {
    if (user && typeof user === "object") {
      setProfile(user);
      setIpInputs(normalizeIpInputs(user.excludedIps || []));
    }
  }, [user]);

  useEffect(() => {
    if (profile) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    getMe()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile(data);
        setIpInputs(normalizeIpInputs(data?.excludedIps || []));
        broadcastUser(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(extractErrorMessage(err, "내 정보를 불러오지 못했습니다."));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [broadcastUser, profile]);

  const serviceStatus = useMemo(() => {
    if (!profile) return null;
    return profile.serviceAvailable
      ? { label: "이용 가능", tone: "text-green-600", pill: "bg-green-100 text-green-700" }
      : { label: "이용 불가", tone: "text-red-600", pill: "bg-red-100 text-red-700" };
  }, [profile]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    getMe()
      .then(({ data }) => {
        setProfile(data);
        setIpInputs(normalizeIpInputs(data?.excludedIps || []));
        broadcastUser(data);
      })
      .catch((err) => {
        setError(extractErrorMessage(err, "최신 정보를 불러오지 못했습니다."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [broadcastUser]);

  const handlePasswordSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (passwordSaving) return;

      const currentValue = currentPassword.trim();
      const nextValue = newPassword.trim();

      if (!currentValue || !nextValue) {
        setPasswordMessage({ type: "error", text: "현재 비밀번호와 새 비밀번호를 모두 입력해 주세요." });
        return;
      }

      if (nextValue.length < 4) {
        setPasswordMessage({ type: "error", text: "새 비밀번호는 최소 4자 이상이어야 합니다." });
        return;
      }

      if (currentValue === nextValue) {
        setPasswordMessage({ type: "error", text: "새 비밀번호가 기존 비밀번호와 동일합니다." });
        return;
      }

      setPasswordSaving(true);
      setPasswordMessage(null);
      updatePassword(currentValue, nextValue)
        .then(() => {
          setPasswordMessage({ type: "success", text: "비밀번호가 안전하게 변경되었습니다." });
          setCurrentPassword("");
          setNewPassword("");
        })
        .catch((err) => {
          setPasswordMessage({
            type: "error",
            text: extractErrorMessage(err, "비밀번호를 변경하지 못했습니다."),
          });
        })
        .finally(() => {
          setPasswordSaving(false);
        });
    },
    [currentPassword, newPassword, passwordSaving]
  );

  const handleIpChange = useCallback((index, value) => {
    setIpInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleIpReset = useCallback(() => {
    if (profile) {
      setIpInputs(normalizeIpInputs(profile.excludedIps || []));
    } else {
      setIpInputs(normalizeIpInputs([]));
    }
    setIpMessage(null);
  }, [profile]);

  const handleIpSubmit = useCallback(
    (event) => {
      event.preventDefault();
      if (ipSaving) return;
      if (!profile) {
        setIpMessage({ type: "error", text: "내 정보를 불러온 뒤에 다시 시도해 주세요." });
        return;
      }

      const trimmed = ipInputs
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      const unique = [];
      const seen = new Set();
      for (const value of trimmed) {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(value);
        }
      }

      if (unique.length > MAX_IP_SLOTS) {
        setIpMessage({ type: "error", text: "IP는 최대 3개까지 입력할 수 있습니다." });
        return;
      }

      setIpSaving(true);
      setIpMessage(null);
      updateExcludedIps(unique)
        .then(({ data }) => {
          const updatedIps = normalizeIpInputs(data?.excludedIps || []);
          setIpInputs(updatedIps);
          setIpMessage({ type: "success", text: "IP 목록이 저장되었습니다." });
          const nextProfile = { ...profile, excludedIps: data?.excludedIps || [] };
          setProfile(nextProfile);
          broadcastUser(nextProfile);
        })
        .catch((err) => {
          setIpMessage({
            type: "error",
            text: extractErrorMessage(err, "IP 정보를 저장하지 못했습니다."),
          });
        })
        .finally(() => {
          setIpSaving(false);
        });
    },
    [broadcastUser, ipInputs, ipSaving, profile]
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>
            <p className="mt-1 text-sm text-gray-600">
              계정 정보를 확인하고 비밀번호, 조회수 제외 IP를 관리하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            새로고침
          </button>
        </div>

        {loading && !profile && (
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            내 정보를 불러오는 중입니다...
          </div>
        )}

        {!loading && error && !profile && (
          <div className="mt-6 space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-white transition hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {profile && (
          <div className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                {error}
              </div>
            )}

            {loading && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                최신 정보를 불러오는 중입니다...
              </div>
            )}

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">아이디</dt>
                <dd className="text-sm text-gray-900">{profile.username}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">닉네임</dt>
                <dd className="text-sm text-gray-900">{profile.nickName || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">가입일</dt>
                <dd className="text-sm text-gray-900">{formatDate(profile.createdAt)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs font-medium uppercase text-gray-500">서비스 상태</dt>
                <dd className="mt-1">
                  {serviceStatus ? (
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${serviceStatus.pill}`}>
                      {serviceStatus.label}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-900">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">이용 시작</dt>
                <dd className="text-sm text-gray-900">{formatDate(profile.serviceStartAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">이용 종료</dt>
                <dd className="text-sm text-gray-900">{formatDate(profile.serviceEndAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">등록된 광고 한도</dt>
                <dd className="text-sm text-gray-900">
                  {profile.maxAdCount != null ? `${profile.maxAdCount}개` : "무제한"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">제외 IP 개수</dt>
                <dd className="text-sm text-gray-900">{profile.excludedIps?.length || 0} / 3</dd>
              </div>
            </dl>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">비밀번호 변경</h2>
        <p className="mt-1 text-sm text-gray-600">
          현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다. 최소 4자 이상을 입력해 주세요.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
          <div>
            <label className="text-xs font-medium uppercase text-gray-500" htmlFor="current-password">
              현재 비밀번호
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-gray-500" htmlFor="new-password">
              새 비밀번호
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          {passwordMessage && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                passwordMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {passwordSaving ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">조회수 제외 IP 관리</h2>
        <p className="mt-1 text-sm text-gray-600">
          입력한 IP 주소는 광고 조회수 집계에서 제외됩니다. IPv4 또는 IPv6 주소를 정확히 입력해 주세요.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleIpSubmit}>
          <div className="space-y-3">
            {ipInputs.map((value, index) => (
              <div key={index}>
                <label className="text-xs font-medium uppercase text-gray-500" htmlFor={`ip-${index}`}>
                  IP #{index + 1}
                </label>
                <input
                  id={`ip-${index}`}
                  type="text"
                  autoComplete="off"
                  placeholder={index === 0 ? "예: 123.123.123.123" : ""}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={value}
                  onChange={(event) => handleIpChange(index, event.target.value)}
                />
              </div>
            ))}
          </div>

          {ipMessage && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                ipMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {ipMessage.text}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleIpReset}
              className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              초기화
            </button>
            <button
              type="submit"
              disabled={ipSaving || !profile}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {ipSaving ? "저장 중..." : "IP 저장"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}