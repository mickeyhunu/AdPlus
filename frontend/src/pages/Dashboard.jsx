// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchStats, myAds } from "../api/ads";
import VisitsChart from "../components/VisitsChart";

// 요청한 버킷만 노출
const BUCKETS = [
  { key: "1m",  label: "1분"  },
  { key: "5m",  label: "5분"  },
  { key: "10m", label: "10분" },
  { key: "30m", label: "30분" },
  { key: "1h",  label: "1시간" },
];

// 모든 버킷 공통 폴링 주기
const POLLING_MS = 10 * 60 * 1000;

// 안정적인 색상 해시
function colorFor(key) {
  let h = 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 45%)`;
}

function toNumericSeq(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function extractSeqNumber(entry) {
  if (!entry || typeof entry !== "object") return null;
  const candidates = [entry.adSeq, entry.seq, entry.userAdNo, entry.adNo, entry.adId, entry.id, entry.adCode, entry.value];
  for (const raw of candidates) {
    const num = toNumericSeq(raw);
    if (num !== null) return num;
  }
  return null;
}
function extractSeqLabel(entry) {
  if (!entry || typeof entry !== "object") return "";
  const candidates = [entry.adSeq, entry.seq, entry.userAdNo, entry.adNo, entry.adId, entry.id, entry.adCode, entry.value];
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue;
    const str = String(raw).trim();
    if (str) return str;
  }
  return "";
}
function extractNameLabel(entry) {
  if (!entry || typeof entry !== "object") return "";
  const candidates = [entry.adName, entry.name, entry.label];
  for (const raw of candidates) if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "";
}
function formatAdLabel(entry) {
  const name = extractNameLabel(entry);
  const seq  = extractSeqLabel(entry);
  if (name && seq && name !== seq) return `${name} (${seq})`;
  return name || seq || "";
}
function compareByAdSeq(a, b) {
  const seqA = extractSeqNumber(a);
  const seqB = extractSeqNumber(b);
  if (seqA !== null && seqB !== null && seqA !== seqB) return seqA - seqB;
  if (seqA !== null && seqB === null) return -1;
  if (seqA === null && seqB !== null) return 1;
  const labelA = formatAdLabel(a);
  const labelB = formatAdLabel(b);
  if (labelA && labelB) {
    const cmp = labelA.localeCompare(labelB, "ko", { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return cmp;
  }
  if (labelA) return -1;
  if (labelB) return 1;
  return 0;
}
function sortByAdSeqList(list = []) {
  return [...list].sort(compareByAdSeq);
}

export default function Dashboard() {
  const [days, setDays] = useState(1);        // 기본 1일
  const [bucket, setBucket] = useState("1m"); // 기본 1분
  const [ads, setAds] = useState([]);
  const [selectedAd, setSelectedAd] = useState("ALL");
  const [stats, setStats] = useState({ labels: [], series: [] });
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const activeRequestId = useRef(0);

  // 내 광고 불러오기
  useEffect(() => {
    let mounted = true;
    myAds()
      .then(({ data }) => {
        if (!mounted) return;
        const list = Array.isArray(data) ? data : data.ads || [];
        setAds(sortByAdSeqList(list));
        setSelectedAd("ALL");
      })
      .catch(() => setAds([]));
    return () => { mounted = false; };
  }, []);

  // 버킷에 따른 days 상한
  const effectiveDays = useMemo(() => {
    if (bucket === "1m")  return Math.min(days, 1);
    if (bucket === "5m")  return Math.min(days, 3);
    if (bucket === "10m") return Math.min(days, 7);
    return days;
  }, [days, bucket]);

  // 컨트롤 변경 시 초기화(로딩표시 + 첫 페치 강제)
  useEffect(() => {
    setLoading(true);
    setRefreshTick(0);
  }, [effectiveDays, bucket, selectedAd]);

  // 데이터 페치
  useEffect(() => {
    const requestId = ++activeRequestId.current;
    let cancelled = false;
    const firstLoad = refreshTick === 0;

    if (firstLoad) setLoading(true);

    fetchStats({ days: effectiveDays, bucket, ad: selectedAd })
      .then(({ data }) => {
        if (cancelled || activeRequestId.current !== requestId) return;
        setStats(data);
      })
      .catch(() => {
        if (cancelled || activeRequestId.current !== requestId) return;
        if (firstLoad) setStats({ labels: [], series: [] });
      })
      .finally(() => {
        if (cancelled || activeRequestId.current !== requestId) return;
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [effectiveDays, bucket, selectedAd, refreshTick]);

  // 폴링
  useEffect(() => {
    const timer = setInterval(() => setRefreshTick(prev => prev + 1), POLLING_MS);
    return () => clearInterval(timer);
  }, [effectiveDays, bucket, selectedAd]); // 컨트롤 바뀌면 타이머 재설정

  // 차트 시리즈 변환
  const seriesForChart = useMemo(() => {
    const source = selectedAd === "ALL"
      ? (stats.series || [])
      : (stats.series || []).filter(s => String(s.userAdNo) === String(selectedAd));
    return source.map((s) => {
      const colorKey = s.userAdNo ?? (s.adSeq != null ? `SEQ_${s.adSeq}` : s.adCode ?? s.id ?? "");
      const nameLabel = formatAdLabel(s)
        || s.name
        || s.adName
        || (s.adSeq != null ? String(s.adSeq) : s.userAdNo);
      return { name: nameLabel, color: colorFor(colorKey), data: s.data || [] };
    });
  }, [stats, selectedAd]);

  // 누적값
  const totalsByLabel = useMemo(() => {
    const labelList = Array.isArray(stats.labels) ? stats.labels : [];
    if (!labelList.length) return [];
    return labelList.map((label, i) => {
      let total = 0;
      for (const s of seriesForChart) {
        const v = Array.isArray(s.data) ? s.data[i] : undefined;
        if (Number.isFinite(v)) total += v;
      }
      return { label: String(label), total };
    });
  }, [stats.labels, seriesForChart]);

  const overallTotal = useMemo(
    () => totalsByLabel.reduce((acc, cur) => acc + cur.total, 0),
    [totalsByLabel]
  );

  // 광고 선택 목록
  const toggleItems = useMemo(() => {
    const items = [{ value: "ALL", label: "전체(비교)" }];
    if (ads.length > 0) {
      for (const ad of sortByAdSeqList(ads)) {
        const raw = ad?.userAdNo ?? ad?.adSeq ?? ad?.adNo ?? ad?.id ?? ad?.adCode;
        if (raw === undefined || raw === null || raw === "") continue;
        items.push({ value: String(raw), label: formatAdLabel(ad) || String(raw) });
      }
    } else if (Array.isArray(stats.series)) {
      const seen = new Set();
      const uniques = [];
      for (const s of stats.series) {
        const key = s?.userAdNo ?? s?.adNo ?? s?.id ?? s?.adSeq;
        if (key == null || key === "") continue;
        const k = String(key);
        if (seen.has(k)) continue;
        seen.add(k);
        uniques.push(s);
      }
      for (const entry of sortByAdSeqList(uniques)) {
        const raw = entry?.userAdNo ?? entry?.adNo ?? entry?.id ?? entry?.adSeq;
        if (raw == null || raw === "") continue;
        items.push({ value: String(raw), label: formatAdLabel(entry) || String(raw) });
      }
    }
    return items;
  }, [ads, stats.series]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold">내 광고 조회 추이</h2>

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
              {BUCKETS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* 광고 선택 */}
      <div className="mt-4">
        <select
          value={selectedAd}
          onChange={(e) => setSelectedAd(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm shadow-sm"
        >
          {toggleItems.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {/* 차트 */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        {totalsByLabel.length > 0 && (
          <p className="mt-2 text-xl font-semibold text-slate-600">
            총 조회수 : {overallTotal.toLocaleString()}
          </p>
        )}

        <div className="mt-4">
          {loading ? (
            <p className="text-slate-500">불러오는 중...</p>
          ) : (
            <VisitsChart labels={stats.labels || []} series={seriesForChart} />
          )}
        </div>
      </div>
    </div>
  );
}
