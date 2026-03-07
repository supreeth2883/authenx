"use client";

import React from "react";

type ColorKey = "blue" | "purple" | "green" | "emerald" | "red" | "amber" | "indigo" | "cyan" | "slate";

const COLOR_MAP: Record<ColorKey, string> = {
  blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
  purple: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
  green: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  cyan: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400",
  slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

/* ───────────── Stat Card ───────────── */

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: ColorKey;
  className?: string;
}

export function StatCard({ label, value, icon, color, className = "" }: StatCardProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4 ${className}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${COLOR_MAP[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

/* ───────────── Status Dot ───────────── */

interface StatusDotProps {
  label: string;
  ok: boolean;
  detail?: string;
}

export function StatusDot({ label, ok, detail }: StatusDotProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          ok
            ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
            : "bg-red-400 shadow-sm shadow-red-400/50"
        }`}
      />
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      {detail && <span className="text-xs text-slate-400">({detail})</span>}
    </div>
  );
}

/* ───────────── Badge ───────────── */

interface BadgeProps {
  children: React.ReactNode;
  color?: ColorKey;
  className?: string;
}

export function Badge({ children, color = "slate", className = "" }: BadgeProps) {
  const colorCls = COLOR_MAP[color];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorCls} ${className}`}>
      {children}
    </span>
  );
}

/* ───────────── Role Badge ───────────── */

const ROLE_COLORS: Record<string, ColorKey> = {
  SUPER_ADMIN: "indigo",
  COLLEGE_ADMIN: "emerald",
  EMPLOYER: "amber",
};

export function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? "slate";
  return <Badge color={color}>{role.replace("_", " ")}</Badge>;
}

/* ───────────── Card (generic container) ───────────── */

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export function Card({ children, className = "", padding = "p-6" }: CardProps) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 ${padding} ${className}`}>
      {children}
    </div>
  );
}

/* ───────────── Empty State ───────────── */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {icon && <div className="mb-4 text-slate-300 dark:text-slate-600">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
