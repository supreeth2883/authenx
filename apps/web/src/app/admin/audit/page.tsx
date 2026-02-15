"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AuditLog {
  id: string;
  sequence: number;
  action: "CREDENTIAL_ISSUED" | "CREDENTIAL_VERIFIED";
  credentialId: string;
  organization: string;
  actor: string | null;
  result: boolean;
  detail: string | null;
  ipAddress: string | null;
  previousHash: string;
  currentHash: string;
  createdAt: string;
}

interface AuditPage {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ChainStatus {
  valid: boolean;
  totalEntries: number;
  brokenAt?: number;
}

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditPage | null>(null);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [action, setAction] = useState("");
  const [organization, setOrganization] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState(false);

  const handleLogout = async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    localStorage.removeItem("authenx_role");
    localStorage.removeItem("authenx_user");
    router.push("/login");
  };

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (organization.trim()) params.set("organization", organization.trim());
    if (credentialId.trim()) params.set("credentialId", credentialId.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("page", String(page));
    params.set("limit", "25");

    try {
      const res = await fetch(`${API}/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
      });
      const data: AuditPage = await res.json();
      setLogs(data);
    } catch {
      // silent
    }
  }, [action, organization, credentialId, startDate, endDate, page]);

  const fetchChainStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/audit-logs/verify-chain`, {
        credentials: "include",
      });
      const data: ChainStatus = await res.json();
      setChainStatus(data);
    } catch {
      // silent
    }
  }, []);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800)); // Brief animation
      await fetchChainStatus();
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchLogs(), fetchChainStatus()]).finally(() =>
      setLoading(false)
    );
  }, [fetchLogs, fetchChainStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (organization.trim()) params.set("organization", organization.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`${API}/admin/audit-logs/export?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();

      // Download CSV
      const blob = new Blob([data.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading audit logs…
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">AuthenX</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Audit Trail</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              ← Dashboard
            </a>
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-3 py-1 rounded-full">
              Audit
            </span>
            <button
              onClick={handleVerifyIntegrity}
              disabled={verifying}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {verifying ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Verifying…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verify
                </>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Chain Integrity Status */}
        {chainStatus && (
          <div className={`rounded-xl p-4 border ${chainStatus.valid ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center gap-3">
              {chainStatus.valid ? (
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              )}
              <div>
                <p className={`font-semibold ${chainStatus.valid ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'}`}>
                  {chainStatus.valid ? 'Audit Chain Verified' : 'Chain Integrity Compromised'}
                </p>
                <p className={`text-sm ${chainStatus.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {chainStatus.totalEntries} entries in chain
                  {!chainStatus.valid && chainStatus.brokenAt && ` • Broken at sequence #${chainStatus.brokenAt}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
            >
              <option value="">All Actions</option>
              <option value="CREDENTIAL_ISSUED">Credential Issued</option>
              <option value="CREDENTIAL_VERIFIED">Credential Verified</option>
            </select>
            <input
              type="text"
              placeholder="Organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
            <input
              type="text"
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Filter
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {exporting ? '…' : 'CSV'}
              </button>
            </div>
          </form>
        </div>

        {/* Results Count */}
        {logs && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {logs.data.length} of {logs.total} audit entries
            </p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">#</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Credential</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Organization</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Result</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs?.data.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {log.sequence}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.action === 'CREDENTIAL_ISSUED'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {log.action === 'CREDENTIAL_ISSUED' ? '📄 Issued' : '🔍 Verified'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {log.credentialId.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {log.organization}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {log.actor || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {log.result ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">
                      {log.currentHash.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
                {logs?.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      No audit logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {logs && logs.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {logs.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(logs.totalPages, p + 1))}
              disabled={page >= logs.totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
