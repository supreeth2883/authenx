"use client";

import { PortalHeader, PortalShell, NavItem } from "@/components/layout";

const ADMIN_NAV: NavItem[] = [
  { label: "Issuers",   href: "/admin/issuers", color: "text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300" },
  { label: "Users",     href: "/admin/users",   color: "text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300" },
  { label: "Audit",     href: "/admin/audit",   color: "text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300" },
  { label: "QA",        href: "/admin/qa",      color: "text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300" },
];

const SHIELD_ICON = (
  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
  </svg>
);

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      gradient="bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900"
      header={
        <PortalHeader
          title="AuthenX"
          subtitle="Admin Dashboard"
          accentColor="bg-indigo-600"
          icon={SHIELD_ICON}
          roleBadge="Super Admin"
          roleBadgeColor="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950"
          navItems={ADMIN_NAV}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
