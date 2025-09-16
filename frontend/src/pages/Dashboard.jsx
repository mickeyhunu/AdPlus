// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchStats, myAds } from "../api/ads";
import VisitsChart from "../components/VisitsChart";

// ★ 요청한 버킷만 남김
const BUCKETS = [
  { key: "1m",  label: "1분"  },
  { key: "5m",  label: "5분"  },
  { key: "10m", label: "10분" },
  { key: "30m", label: "30분" },
  { key: "1h",  label: "1시간" },
];

// 안정적인 색상 해시
function colorFor(key) {
  let h = 0;
  for (let i = 0; i < String(key).length; i++) {
    h = (h * 31 + String(key).charCodeAt(i)) % 360;
  }
  return `hsl(${h} 70% 45%)`;
}

export default function Dashboard() {
  const [days, setDays] = useState(1);         // 실시간성 위해 기본 1일 권장
  const [bucket, setBucket] = useState("1m");  // 기본 1분
  const [ads, setAds] = useState([]);
  const [selectedAd, setSelectedAd] = useState("ALL");
  const [stats, setStats] = useState({ labels: [], series: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    myAds()
      .then(({ data }) => {
        if (!mounted) return;
        const list = Array.isArray(data) ? data : data.ads || [];
        setAds(list);
        setSelectedAd("ALL");
      })
      .catch(() => setAds([]));
    return () => { mounted = false; };
  }, []);

  // 분버킷에서 days 과도한 값 방지 (선택)
  const effectiveDays = useMemo(() => {
    if (bucket === "1m") return Math.min(days, 1);
    if (bucket === "5m") return Math.min(days, 3);
    if (bucket === "10m") return Math.min(days, 7);
    return days;
  }, [days, bucket]);

  useEffect(() => {
    setLoading(true);
    fetchStats({ days: effectiveDays, bucket, ad: selectedAd })
      .then(({ data }) => setStats(data))
      .catch(() => setStats({ labels: [], series: [] }))
      .finally(() => setLoading(false));
  }, [effectiveDays, bucket, selectedAd]);

  // "전체"는 통합이 아니라 광고별 비교: 그대로 series 전달
  const seriesForChart = useMemo(() => {
    const source = selectedAd === "ALL"
      ? (stats.series || [])
      : (stats.series || []).filter(s => String(s.userAdNo) === String(selectedAd));

    // 차트용 필드 표준화: name/color 포함
    return source.map((s) => {
      const colorKey = s.userAdNo
        ?? (s.adSeq !== undefined && s.adSeq !== null ? `SEQ_${s.adSeq}` : s.adCode ?? s.id ?? "");
      const nameLabel = s.name
        || s.adName
        || (s.adSeq !== undefined && s.adSeq !== null ? String(s.adSeq) : s.userAdNo);
      return {
        name: nameLabel,
        color: colorFor(colorKey),
        data: s.data || [],
      };
    });
  }, [stats, selectedAd]);

  // 토글 항목
  const toggleItems = useMemo(() => {
    const items = [{ value: "ALL", label: "전체(비교)" }];
    if (ads.length > 0) {
      items.push(...ads.map((a) => {
        const seqLabel = a?.adSeq !== undefined && a?.adSeq !== null
          ? String(a.adSeq)
          : (a?.userAdNo ?? "");
        const nameLabel = typeof a?.adName === "string" ? a.adName.trim() : "";
        const suffix = seqLabel || a.userAdNo || "";
        const label = nameLabel
          ? (suffix ? `${nameLabel} (${suffix})` : nameLabel)
          : suffix;
        return {
          value: a.userAdNo,
          label,
        };
      }));
    } else if (Array.isArray(stats.series)) {
      const seen = new Set();
      for (const s of stats.series) {
        const v = s.userAdNo || s.adNo || s.id;
        if (!v || seen.has(v)) continue;
        seen.add(v);
        const seqLabel = s?.adSeq !== undefined && s?.adSeq !== null ? String(s.adSeq) : String(v);
        items.push({ value: String(v), label: s.name || s.adName || seqLabel });
      }
    }
    return items;
  }, [ads, stats.series]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">내 광고 조회 추이</h2>
          {/* 선택 광고명 뱃지(ALL이면 비교 모드) */}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-slate-700">
            기간:
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="ml-2 rounded border px-2 py-1"
            >
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            단위:
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="ml-2 rounded border px-2 py-1"
            >
              {BUCKETS.map((b) => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* 광고 선택 드롭다운 */}
      <div className="mt-4">
        <select
          value={selectedAd}
          onChange={(e) => setSelectedAd(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm shadow-sm"
        >
          {toggleItems.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* 광고 토글바 */}
      {/* <div className="mt-4 overflow-x-auto">
        <div className="inline-flex gap-2 rounded-xl border bg-white p-1 shadow-sm">
          {toggleItems.map((item) => (
            <button
              key={item.value}
              onClick={() => setSelectedAd(item.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition
                ${selectedAd === item.value
                  ? "bg-blue-600 text-white"
                  : "bg-transparent hover:bg-blue-50 text-blue-700"
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div> */}

      {/* 차트 */}
      <div className="mt-6">
        {loading ? (
          <p className="text-slate-500">불러오는 중...</p>
        ) : (
          <VisitsChart
            labels={stats.labels || []}
            series={seriesForChart} // [{ name, color, data }]
          />
        )}
      </div>
    </div>
  );
}
