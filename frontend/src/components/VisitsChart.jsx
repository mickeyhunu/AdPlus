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

  const options = {
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
        ticks: {
          autoSkip: true,
          maxTicksLimit: 20,
          minRotation: 0,
          maxRotation: 0,
          callback: function (value) {
            const raw = this.getLabelForValue
              ? this.getLabelForValue(value)
              : (Array.isArray(labels) ? labels[value] : String(value));
            return formatTickLabel(raw);
          },
          padding: 8,

          min: xRange?.min,
          max: xRange?.max,
        },
      },
    },
  };

  const handleWheel = useCallback((event) => {
    const chart = chartRef.current;
    if (!chart || !chart.chartArea) return;
    const total = Array.isArray(labels) ? labels.length : 0;
    if (total <= 1) return;

    const native = event.nativeEvent ?? event;
    const deltaY = native?.deltaY;
    if (!deltaY) return;

    event.preventDefault();

    const currentRange = xRange ?? { min: 0, max: total - 1 };
    let minIndex = Number.isFinite(currentRange.min) ? currentRange.min : 0;
    let maxIndex = Number.isFinite(currentRange.max) ? currentRange.max : total - 1;
    minIndex = Math.max(0, Math.floor(minIndex));
    maxIndex = Math.min(total - 1, Math.ceil(maxIndex));
    if (maxIndex <= minIndex) {
      maxIndex = Math.min(total - 1, minIndex + 1);
    }

    const span = maxIndex - minIndex;
    const zoomIn = deltaY < 0;
    if (zoomIn && span <= 1) return;
    if (!zoomIn && minIndex === 0 && maxIndex === total - 1) return;

    const { left, right } = chart.chartArea;
    const areaWidth = right - left;
    if (areaWidth <= 0) return;

    const offsetX = native.offsetX ?? 0;
    const relative = (offsetX - left) / areaWidth;
    const clampedRelative = Math.min(1, Math.max(0, relative));
    const pointerIndex = minIndex + clampedRelative * span;

    const zoomStep = Math.max(1, Math.round(span * 0.2));
    let newSpan = zoomIn ? span - zoomStep : span + zoomStep;
    if (zoomIn) newSpan = Math.max(1, newSpan);
    else newSpan = Math.min(total - 1, newSpan);

    if (newSpan === span) {
      if (zoomIn) {
        if (span <= 1) return;
        newSpan = span - 1;
      } else {
        if (span >= total - 1) return;
        newSpan = Math.min(total - 1, span + 1);
      }
    }

    const ratio = span > 0 ? (pointerIndex - minIndex) / span : 0.5;
    const clampedRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0.5));
    let newMin = pointerIndex - newSpan * clampedRatio;
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
      if (zoomIn) {
        if (newMin > 0) newMin -= 1;
        else if (newMax < total - 1) newMax += 1;
      } else {
        if (newMax < total - 1) newMax += 1;
        else if (newMin > 0) newMin -= 1;
      }
    }

    newMin = Math.max(0, newMin);
    newMax = Math.min(total - 1, newMax);
    if (newMax <= newMin) return;

    if (newMin === 0 && newMax === total - 1) {
      if (xRange === null) return;
      setXRange(null);
      return;
    }

    if (xRange && newMin === xRange.min && newMax === xRange.max) return;
    setXRange({ min: newMin, max: newMax });
  }, [labels, xRange]);

  return (
    <div style={{ height: 360 }} onWheel={handleWheel}>
      <Line ref={chartRef} data={data} options={options} datasetIdKey="id" />
    </div>
  );
}
