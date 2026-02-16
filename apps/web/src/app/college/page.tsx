"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DashboardStats {
  totalCredentials: number;
  activeCredentials: number;
  revokedCredentials: number;
}

export default function CollegeDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [issuerCode, setIssuerCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/proxy/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((u) => {
        setCurrentRole(u.role);
        setIssuerCode(u.issuerCode || null);
        setEmail(u.email || null);
        setAuthChecked(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (!authChecked || currentRole !== "COLLEGE_ADMIN") return;
    (async () => {
      try {
        // Fetch first page with limit=1 just to get the total count
        const [allRes, revokedRes] = await Promise.all([
          fetch("/api/proxy/college/credentials?limit=1&page=1"),
          fetch("/api/proxy/college/credentials?limit=1&page=1&status=REVOKED"),
        ]);
        let total = 0;
        let revoked = 0;
        if (allRes.ok) {
          const d = await allRes.json();
          total = d.total ?? 0;
        }
        if (revokedRes.ok) {
          const d = await revokedRes.json();
          revoked = d.total ?? 0;
        }
        setStats({
          totalCredentials: total,
          activeCredentials: total - revoked,
          revokedCredentials: revoked,
        });
      } catch {
        // Stats failed silently
        setStats({ totalCredentials: 0, activeCredentials: 0, revokedCredentials: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, [authChecked, currentRole]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  if (currentRole !== "COLLEGE_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow p-8 text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Not Authorized</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">College Admin access required.</p>
          <button onClick={() => router.push("/login")} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer">← Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 0 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">College Portal</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {issuerCode ? `${issuerCode} — ${email}` : email || "College Admin"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
              College Admin
            </span>
            <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Credentials"
            value={loading ? "—" : String(stats?.totalCredentials ?? 0)}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            }
            color="blue"
          />
          <StatCard
            label="Active"
            value={loading ? "—" : String(stats?.activeCredentials ?? 0)}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            }
            color="emerald"
          />
          <StatCard
            label="Revoked"
            value={loading ? "—" : String(stats?.revokedCredentials ?? 0)}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            }
            color="red"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="/college/issue" className="group block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900 transition-colors">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">Issue Credentials</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Publish results and issue new credentials via CSV or manual entry</p>
              </div>
              <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </a>

          <a href="/college/issue?tab=issued" className="group block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition-colors">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">View Issued Credentials</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Browse, search, and manage all issued credentials</p>
              </div>
              <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </a>
        </div>

        {/* Info Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Quick Reference</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">CSV Format</p>
              <p className="text-slate-500 dark:text-slate-400 font-mono text-xs mt-1">rollNumber, name, degree, branch, graduationYear, cgpa</p>
            </div>
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">Workflow</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload CSV → Publish results → Credentials auto-issued → Share QR codes</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: "blue" | "emerald" | "red" }) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
