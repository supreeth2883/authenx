"use client";

import { PortalHeader, PortalShell } from "@/components/layout";
import type { NavItem } from "@/components/layout/portal-header";

const EMPLOYER_ICON = (
  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
  </svg>
);

interface EmployerShellProps {
  children: React.ReactNode;
  navItems?: NavItem[];
}

export function EmployerShell({ children, navItems }: EmployerShellProps) {
  return (
    <PortalShell
      gradient="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900"
      header={
        <PortalHeader
          title="Verification Portal"
          subtitle="Employer Access"
          accentColor="bg-blue-600"
          icon={EMPLOYER_ICON}
          roleBadge="Employer"
          roleBadgeColor="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950"
          navItems={navItems}
        />
      }
    >
      {children}
    </PortalShell>
  );
}
