"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

export function IssuedPerDayChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No issuance data yet
      </div>
    );
  }

  return (
    <Bar
      data={{
        labels: data.map((d) =>
          new Date(d.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        ),
        datasets: [
          {
            label: "Credentials Issued",
            data: data.map((d) => d.count),
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgb(59, 130, 246)",
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: "#94a3b8" },
            grid: { color: "rgba(148, 163, 184, 0.1)" },
          },
          x: {
            ticks: { color: "#94a3b8" },
            grid: { display: false },
          },
        },
      }}
    />
  );
}

export function VerificationRateChart({
  rate,
  success,
  failed,
}: {
  rate: number;
  success: number;
  failed: number;
}) {
  if (success + failed === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No verification data yet
      </div>
    );
  }

  return (
    <div className="relative">
      <Doughnut
        data={{
          labels: ["Passed", "Failed"],
          datasets: [
            {
              data: [success, failed],
              backgroundColor: [
                "rgba(34, 197, 94, 0.8)",
                "rgba(239, 68, 68, 0.8)",
              ],
              borderColor: ["rgb(34, 197, 94)", "rgb(239, 68, 68)"],
              borderWidth: 2,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: "#94a3b8", padding: 16 },
            },
          },
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 32 }}>
        <span className="text-3xl font-bold text-slate-900 dark:text-white">
          {rate}%
        </span>
      </div>
    </div>
  );
}

export function TopOrgsChart({
  data,
}: {
  data: { orgName: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No organization data yet
      </div>
    );
  }

  return (
    <Bar
      data={{
        labels: data.map((d) =>
          d.orgName.length > 18 ? d.orgName.slice(0, 18) + "…" : d.orgName
        ),
        datasets: [
          {
            label: "Verifications",
            data: data.map((d) => d.count),
            backgroundColor: "rgba(139, 92, 246, 0.7)",
            borderColor: "rgb(139, 92, 246)",
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: "#94a3b8" },
            grid: { color: "rgba(148, 163, 184, 0.1)" },
          },
          y: {
            ticks: { color: "#94a3b8" },
            grid: { display: false },
          },
        },
      }}
    />
  );
}
