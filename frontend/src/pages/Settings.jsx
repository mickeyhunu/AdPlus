import { useEffect, useRef, useState } from "react";
import { myAds } from "../api/ads";

const DIGIT_ONLY_RE = /^\d+$/;

function compareUserAdNo(valueA, valueB) {
  const strA = valueA == null ? "" : String(valueA).trim();
  const strB = valueB == null ? "" : String(valueB).trim();

  const hasA = strA !== "";
  const hasB = strB !== "";

  if (hasA && !hasB) return -1;
  if (!hasA && hasB) return 1;
  if (!hasA && !hasB) return 0;

  const segmentsA = strA.match(/\d+|\D+/g) ?? [];
  const segmentsB = strB.match(/\d+|\D+/g) ?? [];
  const length = Math.min(segmentsA.length, segmentsB.length);

  for (let index = 0; index < length; index += 1) {
    const partA = segmentsA[index];
    const partB = segmentsB[index];
    const isNumA = DIGIT_ONLY_RE.test(partA);
    const isNumB = DIGIT_ONLY_RE.test(partB);

    if (isNumA && isNumB) {
      const diff = Number(partA) - Number(partB);
      if (diff !== 0) return diff;
      continue;
    }

    if (isNumA) return -1;
    if (isNumB) return 1;

    const diff = partA.localeCompare(partB, "ko", { sensitivity: "base" });
    if (diff !== 0) return diff;
  }

  if (segmentsA.length !== segmentsB.length) {
    return segmentsA.length - segmentsB.length;
  }

  return strA.localeCompare(strB, "ko", { sensitivity: "base" });
}

function resolveOrigin() {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.origin || "";
}

function extractAdsList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.ads)) return data.ads;
  return [];
}

export default function Settings() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const clearTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    myAds()
      .then(({ data }) => {
        if (cancelled) return;
        const list = extractAdsList(data);
        const sorted = [...list].sort((a, b) => {
          const userAdNoDiff = compareUserAdNo(a?.userAdNo, b?.userAdNo);
          if (userAdNoDiff !== 0) {
            return userAdNoDiff;
          }

          const seqA = Number(a?.adSeq);
          const seqB = Number(b?.adSeq);
          if (!Number.isNaN(seqA) && !Number.isNaN(seqB) && seqA !== seqB) {
            return seqA - seqB;
          }

          const codeA = a?.adCode == null ? "" : String(a.adCode);
          const codeB = b?.adCode == null ? "" : String(b.adCode);
          if (codeA || codeB) {
            return codeA.localeCompare(codeB, "ko", { sensitivity: "base" });
          }

          return 0;
        });
        setAds(sorted);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err?.response?.data?.message || err?.message || "광고 정보를 불러오지 못했습니다.";
        setError(message);
        setAds([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const origin = resolveOrigin();
  const defaultHost = origin || "https://your-domain";

  const handleCopy = async (text, key) => {
    if (!text) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard API unavailable");
      }

      setCopiedKey(key);
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
      clearTimerRef.current = setTimeout(() => {
        setCopiedKey(null);
      }, 1800);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert("복사에 실패했습니다. 직접 복사해 주세요.");
      console.error(err); // 개발용
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">설정 &amp; 연동 안내</h1>
        <p className="mt-2 text-sm text-gray-600">
          광고 페이지에 아래의 추적 픽셀 코드를 삽입하면 노출(조회수)을 자동으로 집계할 수 있습니다.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">기본 엔드포인트</p>
          <code className="mt-1 block break-all font-mono text-xs text-gray-800">
            {`${defaultHost}/api/track?adCode=도메인_회원번호_광고번호`}
          </code>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">
            <li>예) 오피가이드 2번 회원의 1번 광고 → <code>og_2_1</code></li>
            <li>아래에서 각 광고에 맞춘 HTML 코드를 바로 복사할 수 있습니다.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">광고별 추적 코드</h2>
          <span className="text-sm text-gray-500">현재 등록된 광고 {ads.length}건</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-sm text-gray-500">
            광고 정보를 불러오는 중입니다...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && ads.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            아직 등록된 광고가 없습니다. &ldquo;광고 관리&rdquo;에서 광고를 먼저 생성해 주세요.
          </div>
        )}

        {!loading && !error && ads.length > 0 && (
          <div className="flex flex-col gap-4">
            {ads.map((ad, index) => {
              const adCode = String(ad?.adCode || "").trim();
              const userAdNo = String(ad?.userAdNo || "").trim();
              const adName = String(ad?.adName || "").trim();
              const adDomain = String(ad?.adDomain || "").trim();
              const key = ad?.adSeq ?? (userAdNo || index);
              const host = origin || defaultHost;
              const pixelUrl = adCode ? `${host}/api/track?adCode=${adCode}` : "";
              const htmlSnippet = adCode
                ? `<img src="${pixelUrl}" alt="" style="width:1px;height:1px;border:0;display:none;" />`
                : "";
              const canCopy = Boolean(adCode);

              return (
                <article key={key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-5 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {adName || (userAdNo ? `광고 ${userAdNo}` : "이름 없는 광고")}
                        </h3>
                        {adDomain && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {adDomain}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        광고 번호: <span className="font-mono text-gray-800">{userAdNo || "-"}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        광고 코드: <span className="font-mono text-gray-800">{adCode || "생성되지 않음"}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(htmlSnippet, adCode || key)}
                      disabled={!canCopy}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        canCopy
                          ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                          : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      }`}
                    >
                      {copiedKey === (adCode || key)
                        ? "복사 완료!"
                        : canCopy
                          ? "복사하기"
                          : "코드 없음"}
                    </button>
                  </header>

                  <div className="space-y-4 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">삽입할 HTML 코드</p>
                      {canCopy ? (
                        <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-900 px-4 py-3 text-sm text-gray-100">
                          <code>{htmlSnippet}</code>
                        </pre>
                      ) : (
                        <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                          광고 코드가 아직 생성되지 않았습니다. 광고 관리에서 저장 후 다시 확인해 주세요.
                        </div>
                      )}
                    </div>

                    {canCopy && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">추적 URL</span>
                        <code className="ml-2 break-all font-mono text-gray-800">{pixelUrl}</code>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}