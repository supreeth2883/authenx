"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { IssuedPerDayChart, VerificationRateChart, TopOrgsChart } from "./charts";

interface Stats {
  totalCredentials: number;
  totalVerifications: number;
  successCount: number;
  failedCount: number;
}

interface Credential {
  id: string;
  issuerCode: string;
  name: string;
  rollNumber: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
  createdAt: string;
}

interface CredentialPage {
  data: Credential[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Analytics {
  issuedPerDay: { date: string; count: number }[];
  verificationRate: number;
  topOrganizations: { orgName: string; count: number }[];
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [credentials, setCredentials] = useState<CredentialPage | null>(null);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{ id: string; name: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("authenx_role");
    localStorage.removeItem("authenx_user");
    router.push("/login");
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/proxy/admin/stats").then((r) => r.json()),
      fetch("/api/proxy/admin/analytics").then((r) => r.json()),
      fetch("/api/proxy/auth/me").then((r) => r.ok ? r.json() : null),
    ]).then(([s, a, me]) => {
      setStats(s);
      setAnalytics(a);
      if (me?.role) setUserRole(me.role);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchCredentials = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (branch.trim()) params.set("branch", branch.trim());
    if (year.trim()) params.set("graduationYear", year.trim());
    params.set("page", String(page));
    params.set("limit", "10");

    try {
      const res = await fetch(`/api/proxy/admin/credentials?${params.toString()}`);
      const data: CredentialPage = await res.json();
      setCredentials(data);
    } catch {
      // silent
    }
  }, [search, branch, year, page]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCredentials();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">AuthenX</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/users" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors">
              Manage Users →
            </a>
            <a href="/admin/audit" className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors">
              Audit Trail →
            </a>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full">
              Super Admin
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Credentials Issued"
              value={stats.totalCredentials}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              }
              color="blue"
            />
            <StatCard
              label="Total Verifications"
              value={stats.totalVerifications}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              }
              color="purple"
            />
            <StatCard
              label="Successful"
              value={stats.successCount}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
              color="green"
            />
            <StatCard
              label="Failed"
              value={stats.failedCount}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
              color="red"
            />
          </div>
        )}

        {/* Charts Row */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                Credentials Issued Per Day
              </h3>
              <div className="h-64">
                <IssuedPerDayChart data={analytics.issuedPerDay} />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
                Verification Success Rate
              </h3>
              <div className="h-64">
                <VerificationRateChart
                  rate={analytics.verificationRate}
                  success={stats?.successCount ?? 0}
                  failed={stats?.failedCount ?? 0}
                />
              </div>
            </div>
          </div>
        )}

        {/* Top Orgs chart */}
        {analytics && analytics.topOrganizations.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Top Verifying Organizations
            </h3>
            <div className="h-48">
              <TopOrgsChart data={analytics.topOrganizations} />
            </div>
          </div>
        )}

        {/* Credential Explorer */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Credential Explorer
            </h3>
            <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or roll number..."
                className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Branch"
                className="w-40 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Year"
                className="w-24 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Name</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Roll No</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Degree</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Branch</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Year</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">CGPA</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Issued</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">ID</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {credentials?.data.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-600 dark:text-slate-400">{c.rollNumber}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{c.degree}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{c.branch}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{c.graduationYear}</td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400">{c.cgpa}</td>
                    <td className="px-6 py-3.5 text-slate-500 dark:text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-1 rounded-lg">
                        {c.id.slice(0, 12)}…
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => setQrModal({ id: c.id, name: c.name })}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors cursor-pointer"
                        title="Show QR code"
                      >
                        <QRCodeSVG
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/employer?credentialId=${c.id}`}
                          size={32}
                          level="L"
                          className="rounded"
                        />
                      </button>
                    </td>
                  </tr>
                ))}
                {credentials?.data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      No credentials found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {credentials && credentials.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {(credentials.page - 1) * credentials.limit + 1}–
                {Math.min(credentials.page * credentials.limit, credentials.total)} of{" "}
                {credentials.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400">
                  {credentials.page} / {credentials.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(credentials.totalPages, p + 1))}
                  disabled={page >= credentials.totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
        {/* QR Modal */}
        {qrModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setQrModal(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 text-center">
                Verify Credential
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                {qrModal.name}
              </p>
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white rounded-2xl">
                  <QRCodeSVG
                    value={`${window.location.origin}/employer?credentialId=${qrModal.id}`}
                    size={200}
                    level="M"
                    includeMargin
                  />
                </div>
              </div>
              <p className="text-xs text-center font-mono text-slate-400 dark:text-slate-500 break-all mb-4">
                {qrModal.id}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/employer?credentialId=${qrModal.id}`
                    );
                  }}
                  className="flex-1 py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => setQrModal(null)}
                  className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "purple" | "green" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400",
    green: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}
