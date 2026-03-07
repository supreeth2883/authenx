"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/shells";
import { PageSpinner, Button, inputCls, selectCls, Card, Pagination } from "@/components/ui";
import { apiGet, apiRaw, ApiError } from "@/lib/api";

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
      const data = await apiGet<AuditPage>(`/admin/audit-logs?${params.toString()}`);
      setLogs(data);
    } catch {
      // silent
    }
  }, [action, organization, credentialId, startDate, endDate, page]);

  const fetchChainStatus = useCallback(async () => {
    try {
      const data = await apiGet<ChainStatus>("/admin/audit-logs/verify-chain");
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

      const res = await apiRaw(`/admin/audit-logs/export?${params.toString()}`);
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

  if (loading) return <PageSpinner label="Loading audit logs…" />;

  return (
    <AdminShell>
      {/* Chain Integrity Status + Verify Button */}
      <div className="flex items-center justify-between">
        {chainStatus && (
          <div className={`flex-1 rounded-xl p-4 border ${chainStatus.valid ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'}`}>
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
        <Button variant="secondary" onClick={handleVerifyIntegrity} loading={verifying} size="sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verify Chain
        </Button>
      </div>

      {/* Filters */}
      <Card padding="p-4">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchLogs(); }} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
            <option value="">All Actions</option>
            <option value="CREDENTIAL_ISSUED">Credential Issued</option>
            <option value="CREDENTIAL_VERIFIED">Credential Verified</option>
          </select>
          <input type="text" placeholder="Organization" value={organization} onChange={(e) => setOrganization(e.target.value)} className={inputCls} />
          <input type="text" placeholder="Credential ID" value={credentialId} onChange={(e) => setCredentialId(e.target.value)} className={inputCls} />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="flex-1">Filter</Button>
            <Button variant="secondary" size="sm" onClick={handleExport} loading={exporting}>CSV</Button>
          </div>
        </form>
      </Card>

        {/* Results Count */}
        {logs && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {logs.data.length} of {logs.total} audit entries
            </p>
          </div>
        )}

      {/* Table */}
      <Card padding="p-0" className="overflow-hidden">
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
      </Card>

      {/* Pagination */}
      {logs && logs.totalPages > 1 && (
        <Pagination page={page} totalPages={logs.totalPages} total={logs.total} limit={logs.limit} onPageChange={setPage} />
      )}
    </AdminShell>
  );
}
