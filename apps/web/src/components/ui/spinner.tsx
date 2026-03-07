"use client";

import { motion } from "framer-motion";

interface SpinnerProps {
  /** Size in pixels (default: 24) */
  size?: number;
  /** Optional label to display next to the spinner */
  label?: string;
  /** CSS class name */
  className?: string;
}

export function Spinner({ size = 24, label, className = "" }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        className="animate-spin text-current"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}

/** Full-screen centered spinner, used for page loading states */
export function PageSpinner({ label = "Loading…", gradient }: { label?: string; gradient?: string }) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${gradient ?? "bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900"}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 text-slate-500"
      >
        <Spinner size={24} label={label} />
      </motion.div>
    </div>
  );
}
