"use client";

import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { IssuedPerDayChart, VerificationRateChart, TopOrgsChart } from "./charts";
import { motion } from "framer-motion";
import { AdminShell } from "@/components/shells";
import { StatCard, StatusDot, Card, PageSpinner, EmptyState } from "@/components/ui";
import { Button, Pagination, inputCls } from "@/components/ui";
import { QrModal } from "@/components/ui";
import { apiGet } from "@/lib/api";

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

interface HealthData {
  cloudApi: { ok: boolean };
  postgres: { ok: boolean; latencyMs?: number };
  checkedAt: string;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [credentials, setCredentials] = useState<CredentialPage | null>(null);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{ id: string; name: string } | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [issuerCount, setIssuerCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Stats>("/admin/stats").catch(() => null),
      apiGet<Analytics>("/admin/analytics").catch(() => null),
      apiGet<HealthData>("/admin/health").catch(() => null),
      apiGet<unknown[]>("/admin/issuers").catch(() => []),
    ]).then(([s, a, h, issuers]) => {
      if (s) setStats(s);
      if (a) setAnalytics(a);
      if (h) setHealth(h);
      if (Array.isArray(issuers)) setIssuerCount(issuers.length);
      setLoading(false);
    });
  }, []);

  const fetchCredentials = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (branch.trim()) params.set("branch", branch.trim());
    if (year.trim()) params.set("graduationYear", year.trim());
    params.set("page", String(page));
    params.set("limit", "10");

    try {
      const data = await apiGet<CredentialPage>(`/admin/credentials?${params.toString()}`);
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

  if (loading) return <PageSpinner label="Loading dashboard…" />;

  return (
    <AdminShell>
      {/* Stats Cards */}
      {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Credentials Issued", value: stats.totalCredentials, icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>, color: "blue" as const },
              { label: "Total Verifications", value: stats.totalVerifications, icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>, color: "purple" as const },
              { label: "Successful", value: stats.successCount, icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: "green" as const },
              { label: "Failed", value: stats.failedCount, icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>, color: "red" as const },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" }}>
                <StatCard {...card} />
              </motion.div>
            ))}
          </div>
        )}

        {/* System Status */}
        {health && (
        <Card padding="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">System Status</h3>
            <span className="text-[10px] text-slate-400">{new Date(health.checkedAt).toLocaleTimeString()}</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <StatusDot label="Cloud API" ok={health.cloudApi.ok} />
            <StatusDot label="PostgreSQL" ok={health.postgres.ok} detail={health.postgres.latencyMs ? `${health.postgres.latencyMs}ms` : undefined} />
            {issuerCount !== null && <StatusDot label={`Issuers (${issuerCount})`} ok={issuerCount > 0} />}
          </div>
        </Card>
      )}

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Credentials Issued Per Day
            </h3>
            <div className="h-64">
              <IssuedPerDayChart data={analytics.issuedPerDay} />
            </div>
          </Card>
          <Card>
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
          </Card>
        </div>
      )}

      {analytics && analytics.topOrganizations.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Top Verifying Organizations
          </h3>
          <div className="h-48">
            <TopOrgsChart data={analytics.topOrganizations} />
          </div>
        </Card>
      )}

      {/* Credential Explorer */}
      <Card padding="p-0" className="overflow-hidden">
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
              className={`flex-1 min-w-[200px] ${inputCls}`}
            />
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Branch"
              className={`w-40 ${inputCls}`}
            />
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Year"
              className={`w-24 ${inputCls}`}
            />
            <Button type="submit">Search</Button>
          </form>
        </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                {["Name", "Roll No", "Degree", "Branch", "Year", "CGPA", "Issued", "ID", "QR"].map((h) => (
                  <th key={h} className="text-left px-6 py-3 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                    {h}
                  </th>
                ))}
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
                    <td colSpan={9}>
                      <EmptyState title="No credentials found" description="Try adjusting your search filters." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {credentials && (
            <Pagination
              page={credentials.page}
              totalPages={credentials.totalPages}
              total={credentials.total}
              limit={credentials.limit}
              onPageChange={setPage}
            />
          )}
        </Card>
        {/* QR Modal */}
        {qrModal && (
          <QrModal
            open={!!qrModal}
            onClose={() => setQrModal(null)}
            credentialId={qrModal.id}
            credentialName={qrModal.name}
          />
        )}
    </AdminShell>
  );
}

// StatCard and StatusDot imported from @/components/ui
