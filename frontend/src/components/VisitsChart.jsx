// src/components/VisitsChart.jsx
import React, { useMemo } from "react";
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
  const datasets = useMemo(() => {
    return (series || []).map((s, i) => {
      const label =
        s.name ?? s.adName ?? s.userAdNo ?? s.adId ?? s.id ?? `AD ${i + 1}`;

      // ✅ 항상 팔레트에서 색을 가져옴(백엔드 s.color 무시)
      const pal = PALETTE[i % PALETTE.length];

      return {
        id: String(s.userAdNo ?? s.adCode ?? s.adId ?? s.id ?? i), // dataset 식별 고정
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
        },
      },
    },
  };

  return (
    <div style={{ height: 360 }}>
      <Line data={data} options={options} datasetIdKey="id" />
    </div>
  );
}
