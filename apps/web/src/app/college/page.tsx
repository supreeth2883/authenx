"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CollegeShell } from "@/components/shells";
import { StatCard, Card, PageSpinner } from "@/components/ui";
import { apiGet } from "@/lib/api";

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
    apiGet<{ role: string; issuerCode?: string; email?: string }>("/auth/me")
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
        const [allData, revokedData] = await Promise.all([
          apiGet<{ total?: number }>("/college/credentials?limit=1&page=1"),
          apiGet<{ total?: number }>("/college/credentials?limit=1&page=1&status=REVOKED"),
        ]);
        const total = allData.total ?? 0;
        const revoked = revokedData.total ?? 0;
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

  if (!authChecked) {
    return <PageSpinner label="Loading…" gradient="bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900" />;
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
    <CollegeShell issuerCode={issuerCode} email={email}>
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
      <Card>
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
      </Card>
    </CollegeShell>
  );
}
