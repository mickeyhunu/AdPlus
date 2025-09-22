// src/components/VisitsChart.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

// 🔴🟡🟢🔵 + 추가 대비 색
const PALETTE = [
  { border: "#ef4444", bg: "rgba(239, 68, 68, 0.18)" },   // red
  { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.18)" },   // amber
  { border: "#10b981", bg: "rgba(16, 185, 129, 0.18)" },   // emerald
  { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.18)" },   // blue
  { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.18)" },   // violet
  { border: "#ec4899", bg: "rgba(236, 72, 153, 0.18)" },   // pink
  { border: "#14b8a6", bg: "rgba(20, 184, 166, 0.18)" },   // teal
  { border: "#22c55e", bg: "rgba(34, 197, 94, 0.18)" },    // green
  { border: "#0284c7", bg: "rgba(2, 132, 199, 0.18)" },    // sky
  { border: "#000000", bg: "rgba(0, 0, 0, 0.12)" },        // black
];

const getButtonClass = (enabled) =>
  `rounded border px-2 py-1 font-medium transition ${
    enabled ? "bg-white hover:bg-slate-100" : "cursor-not-allowed bg-slate-100 text-slate-400"
}`;

function formatTickLabel(label) {
  const s = String(label);
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (m1) return [`${Number(m1[2])}월 ${Number(m1[3])}일`, `${m1[4]}:${m1[5]}`];
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return `${Number(m2[2])}월 ${Number(m2[3])}일`;
  return s;
}

export default function VisitsChart({ labels = [], series = [] }) {
  const chartRef = useRef(null);
  const [xRange, setXRange] = useState(null);

  useEffect(() => {
    setXRange(null);
  }, [labels]);

  const datasets = useMemo(() => {
    return (series || []).map((s, i) => {
      const label =
        s.name
        ?? s.adName
        ?? (s.adSeq !== undefined && s.adSeq !== null ? String(s.adSeq) : undefined)
        ?? s.userAdNo
        ?? s.adId
        ?? s.id
        ?? `AD ${i + 1}`;
      
      // ✅ 가능하면 지정된 색상 사용, 없으면 팔레트에서 가져옴
      const pal = PALETTE[i % PALETTE.length];
      const borderColor = s.color || pal.border;
      let backgroundColor = pal.bg;
      if (s.color && typeof s.color === "string") {
        if (s.color.startsWith("hsl")) {
          backgroundColor = s.color.replace(")", " / 0.18)");
        } else if (s.color.startsWith("#") && s.color.length === 7) {
          backgroundColor = `${s.color}2d`;
        } else {
          backgroundColor = s.color;
        }
      }

      return {
        id: String(
          s.userAdNo
          ?? (s.adSeq !== undefined && s.adSeq !== null ? String(s.adSeq) : undefined)
          ?? s.adCode
          ?? s.adId
          ?? s.id
          ?? i
        ), // dataset 식별 고정
        label,
        data: Array.isArray(s.data) ? s.data : [],
        borderColor: pal.border,
        backgroundColor: pal.bg,
        pointBackgroundColor: pal.border,
        pointBorderColor: pal.border,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        pointHitRadius: 6,
        spanGaps: true,
      };
    });
  }, [series]);

  const data = { labels, datasets };

  // y축 여유
  const yMax = useMemo(() => {
    let m = 0;
    for (const s of series || []) {
      for (const v of (Array.isArray(s.data) ? s.data : [])) {
        if (typeof v === "number" && v > m) m = v;
      }
    }
    return m;
  }, [series]);

  const suggestedMax = useMemo(() => (yMax <= 10 ? 20 : Math.ceil(yMax * 1.2)), [yMax]);

  const visibleCount = useMemo(() => {
    if (!Array.isArray(labels)) return 0;
    if (!xRange) return labels.length;
    const min = Number.isFinite(xRange.min) ? xRange.min : 0;
    const max = Number.isFinite(xRange.max) ? xRange.max : labels.length - 1;
    return Math.max(0, Math.min(labels.length - 1, max) - Math.max(0, min) + 1);
  }, [labels, xRange]);

  const options = useMemo(() => {
    const total = Array.isArray(labels) ? labels.length : 0;
    const maxTicks = Math.max(3, Math.min(20, visibleCount || total));
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { usePointStyle: true },
        },
        tooltip: { mode: "index", intersect: false },
      },

      scales: {
        y: {
          beginAtZero: true,
          suggestedMax,
          ticks: {
            precision: 0,
            callback: (v) => (Number.isInteger(v) ? v : ""),
          },
        },
        x: {
          min: xRange?.min ?? undefined,
          max: xRange?.max ?? undefined,
          ticks: {
            autoSkip: (visibleCount || total) > maxTicks,
            maxTicksLimit: maxTicks,
            minRotation: 0,
            maxRotation: 0,
            callback(value) {
              const raw = this.getLabelForValue
                ? this.getLabelForValue(value)
                : (Array.isArray(labels) ? labels[value] : String(value));
              return formatTickLabel(raw);
            },
            padding: 8,
          },
        },
      },
    };
  }, [labels, suggestedMax, visibleCount, xRange]);

  const applyZoom = useCallback(
    (direction, anchorRatio = 0.5) => {
      const total = Array.isArray(labels) ? labels.length : 0;
      if (total <= 1) return;

      const current = xRange ?? { min: 0, max: total - 1 };
      let minIndex = Number.isFinite(current.min) ? current.min : 0;
      let maxIndex = Number.isFinite(current.max) ? current.max : total - 1;
      minIndex = Math.max(0, Math.floor(minIndex));
      maxIndex = Math.min(total - 1, Math.ceil(maxIndex));
      if (maxIndex <= minIndex) {
        maxIndex = Math.min(total - 1, minIndex + 1);
      }

      const span = Math.max(1, maxIndex - minIndex);
      const zoomStep = Math.max(1, Math.round(span * 0.2));
      const zoomIn = direction === "in";
      let newSpan = zoomIn ? span - zoomStep : span + zoomStep;
      newSpan = zoomIn ? Math.max(1, newSpan) : Math.min(total - 1, newSpan);

      if (!zoomIn && (newSpan >= total - 1 || (minIndex === 0 && maxIndex === total - 1))) {
        if (xRange !== null) setXRange(null);
        return;
      }
      if (zoomIn && span <= 1) return;

      const ratio = Number.isFinite(anchorRatio) ? Math.min(1, Math.max(0, anchorRatio)) : 0.5;
      const pointerIndex = minIndex + span * ratio;
      let newMin = pointerIndex - newSpan * ratio;
      let newMax = newMin + newSpan;

      if (newMin < 0) {
        newMax -= newMin;
        newMin = 0;
      }
      if (newMax > total - 1) {
        const overflow = newMax - (total - 1);
        newMin -= overflow;
        newMax = total - 1;
      }

      newMin = Math.max(0, Math.round(newMin));
      newMax = Math.min(total - 1, Math.round(newMax));
      if (newMax <= newMin) {
        if (zoomIn && newMin > 0) newMin -= 1;
        else if (!zoomIn && newMax < total - 1) newMax += 1;
      }

      newMin = Math.max(0, newMin);
      newMax = Math.min(total - 1, newMax);
      if (newMax <= newMin) return;

      if (newMin === 0 && newMax === total - 1) {
        if (xRange !== null) setXRange(null);
        return;
      }

      if (xRange && newMin === xRange.min && newMax === xRange.max) return;
      setXRange({ min: newMin, max: newMax });
    },
    [labels, xRange]
  );


  const applyPan = useCallback(
    (direction, magnitude = 1) => {
      const total = Array.isArray(labels) ? labels.length : 0;
      if (total <= 1) return;
      if (!xRange) return;

      let minIndex = Number.isFinite(xRange.min) ? Math.floor(xRange.min) : 0;
      let maxIndex = Number.isFinite(xRange.max) ? Math.ceil(xRange.max) : total - 1;

      minIndex = Math.max(0, minIndex);
      maxIndex = Math.min(total - 1, maxIndex);

      if (maxIndex <= minIndex) {
        maxIndex = Math.min(total - 1, minIndex + 1);
      }

      const rangeSize = Math.min(total, Math.max(1, maxIndex - minIndex + 1));
      if (rangeSize >= total && minIndex === 0 && maxIndex === total - 1) return;

      const baseStep = Math.max(1, Math.round(rangeSize * 0.25));
      const shift = Math.max(1, Math.round(baseStep * magnitude));
      const directionSign = direction === "right" ? 1 : -1;

      let newMin = minIndex + directionSign * shift;
      let newMax = newMin + rangeSize - 1;

      if (newMin < 0) {
        newMin = 0;
        newMax = rangeSize - 1;
      }
      if (newMax > total - 1) {
        newMax = total - 1;
        newMin = Math.max(0, newMax - (rangeSize - 1));
      }

      newMin = Math.max(0, Math.round(newMin));
      newMax = Math.min(total - 1, Math.round(newMax));
      if (newMin === minIndex && newMax === maxIndex) return;

      if (newMin <= 0 && newMax >= total - 1) {
        setXRange(null);
        return;
      }

      setXRange({ min: newMin, max: newMax });
    },
    [labels, xRange]
  );

  const handleWheel = useCallback(
    (event) => {
      const chart = chartRef.current;
      if (!chart || !chart.chartArea) return;
      const total = Array.isArray(labels) ? labels.length : 0;
      if (total <= 1) return;

      const native = event.nativeEvent ?? event;
      const deltaX = native?.deltaX ?? 0;
      const deltaY = native?.deltaY;

      const preferHorizontal = native.shiftKey || Math.abs(deltaX) > Math.abs(deltaY ?? 0);
      if (preferHorizontal && deltaX) {
        if (!xRange) return;
        event.preventDefault();
        const magnitude = Math.min(3, Math.max(0.2, Math.abs(deltaX) / 120));
        applyPan(deltaX > 0 ? "right" : "left", magnitude);
        return;
      }

      if (!deltaY) return;

      event.preventDefault();

      const { left, right } = chart.chartArea;
      const areaWidth = right - left;
      if (areaWidth <= 0) return;

      let offsetX = native.offsetX;
      if (!Number.isFinite(offsetX)) {
        const rect = chart.canvas?.getBoundingClientRect();
        if (!rect) return;
        offsetX = native.clientX - rect.left;
      }

      const relative = (offsetX - left) / areaWidth;
      const clampedRelative = Math.min(1, Math.max(0, relative));
      applyZoom(deltaY < 0 ? "in" : "out", clampedRelative);
    },
    [labels, applyZoom, applyPan, xRange]
  );

  const handlePanLeft = useCallback(() => applyPan("left"), [applyPan]);
  const handlePanRight = useCallback(() => applyPan("right"), [applyPan]);
  const handleZoomIn = useCallback(() => applyZoom("in"), [applyZoom]);
  const handleZoomOut = useCallback(() => applyZoom("out"), [applyZoom]);
  const handleResetZoom = useCallback(() => setXRange(null), []);

  const totalCount = Array.isArray(labels) ? labels.length : 0;
  const canPanLeft = Boolean(xRange && Number.isFinite(xRange.min) && xRange.min > 0);
  const canPanRight = Boolean(xRange && Number.isFinite(xRange.max) && xRange.max < totalCount - 1);
  const canZoomIn = totalCount > 1 && (xRange ? xRange.max - xRange.min > 1 : totalCount > 2);
  const canZoomOut = totalCount > 1 && xRange !== null;
  const canReset = xRange !== null;



  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
        <span className="hidden whitespace-nowrap sm:inline">
          마우스 휠로 확대/축소, Shift+휠 또는 트랙패드로 좌우 이동이 가능해요.
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePanLeft}
            disabled={!canPanLeft}
            className={getButtonClass(canPanLeft)}
          >
            ◀︎ 왼쪽
          </button>
          <button
            type="button"
            onClick={handlePanRight}
            disabled={!canPanRight}
            className={getButtonClass(canPanRight)}
          >
            오른쪽 ▶︎
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            className={getButtonClass(canZoomIn)}
          >
            확대
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            className={getButtonClass(canZoomOut)}
          >
            축소
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            disabled={!canReset}
            className={getButtonClass(canReset)}
          >
            전체보기
          </button>
        </div>
      </div>
      <div style={{ height: 360 }} onWheel={handleWheel}>
        <Line ref={chartRef} data={data} options={options} datasetIdKey="id" />
      </div>
    </div>
  );
}
