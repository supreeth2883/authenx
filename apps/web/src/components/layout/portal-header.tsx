"use client";

import { useRouter } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  color: string;
}

interface PortalHeaderProps {
  /** Portal title */
  title: string;
  /** Subtitle (e.g., email, issuer code) */
  subtitle?: string;
  /** Accent color for the logo icon */
  accentColor: string;
  /** Icon SVG element */
  icon: React.ReactNode;
  /** Role badge text */
  roleBadge: string;
  /** Role badge color classes */
  roleBadgeColor: string;
  /** Navigation links */
  navItems?: NavItem[];
  /** Additional header actions */
  actions?: React.ReactNode;
}

export function PortalHeader({
  title,
  subtitle,
  accentColor,
  icon,
  roleBadge,
  roleBadgeColor,
  navItems = [],
  actions,
}: PortalHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("authenx_role");
    localStorage.removeItem("authenx_user");
    router.push("/login");
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${accentColor} flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-medium ${item.color} transition-colors hidden sm:inline`}
            >
              {item.label} →
            </a>
          ))}
          {actions}
          <span className={`text-sm font-medium ${roleBadgeColor} px-3 py-1 rounded-full`}>
            {roleBadge}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

/* ───────────── Portal Shell ───────────── */

interface PortalShellProps {
  children: React.ReactNode;
  /** Background gradient classes */
  gradient?: string;
  header: React.ReactNode;
}

export function PortalShell({
  children,
  gradient = "bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900",
  header,
}: PortalShellProps) {
  return (
    <div className={`min-h-screen ${gradient}`}>
      {header}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
