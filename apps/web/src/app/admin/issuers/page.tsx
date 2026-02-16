"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── Types ────────────────────────────────────────────────────── */

interface IssuerRow {
  id: string;
  issuerCode: string;
  name: string;
  connectorBaseUrl: string;
  publicKeyFingerprint: string;
  orgStatus: string;
  createdAt: string;
}

interface ConnectorCheck {
  health: { ok: boolean; status: number | null; latencyMs: number; message: string };
  publicKey: { ok: boolean; issuerCode: string | null; fingerprint: string | null; message: string };
}

interface PingResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  message: string;
}

/* ── Helpers ──────────────────────────────────────────────────── */

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
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

/* ── Page Component ──────────────────────────────────────────── */

export default function AdminIssuersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  /* data */
  const [issuers, setIssuers] = useState<IssuerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* register modal */
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ issuerCode: "", name: "", connectorBaseUrl: "" });
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  /* pre-registration connector check */
  const [preCheck, setPreCheck] = useState<ConnectorCheck | null>(null);
  const [preChecking, setPreChecking] = useState(false);

  /* per-row ping results */
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [pinging, setPinging] = useState<Record<string, boolean>>({});

  /* copy feedback */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* toast */
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Auth check ─────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/proxy/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((u) => {
        setCurrentRole(u.role);
        setAuthChecked(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  /* ── Fetch issuers ──────────────────────────────────────── */
  const fetchIssuers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/admin/issuers");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const data: IssuerRow[] = await res.json();
      setIssuers(data);
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Failed to load issuers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && currentRole === "SUPER_ADMIN") {
      fetchIssuers();
    }
  }, [authChecked, currentRole, fetchIssuers]);

  /* ── RBAC gate ──────────────────────────────────────────── */
  if (!authChecked) return <Spinner />;

  if (currentRole !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow p-8 text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Not Authorized</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Super Admin access required.</p>
          <button onClick={() => router.push("/admin")} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer">← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  /* ── Handlers ───────────────────────────────────────────── */
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handlePreCheck = async () => {
    const url = regForm.connectorBaseUrl.trim();
    if (!url) return;
    setPreChecking(true);
    setPreCheck(null);
    try {
      const res = await fetch("/api/proxy/admin/issuers/check-connector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorBaseUrl: url }),
      });
      const data: ConnectorCheck = await res.json();
      setPreCheck(data);
    } catch {
      setPreCheck(null);
    } finally {
      setPreChecking(false);
    }
  };

  const handleRegister = async () => {
    setRegistering(true);
    setRegError(null);
    setRegSuccess(null);
    try {
      const res = await fetch("/api/proxy/admin/issuers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuerCode: regForm.issuerCode.trim(),
          name: regForm.name.trim(),
          connectorBaseUrl: regForm.connectorBaseUrl.trim().replace(/\/+$/, ""),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setRegSuccess(data.message || "Issuer registered successfully!");
      showToast(`Issuer "${regForm.issuerCode}" registered`, "success");
      setRegForm({ issuerCode: "", name: "", connectorBaseUrl: "" });
      setPreCheck(null);
      setShowRegister(false);
      fetchIssuers();
    } catch (ex: unknown) {
      setRegError(ex instanceof Error ? ex.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handlePing = async (issuerCode: string) => {
    setPinging((p) => ({ ...p, [issuerCode]: true }));
    try {
      const res = await fetch(`/api/proxy/admin/issuers/${issuerCode}/ping`, {
        method: "POST",
      });
      const data: PingResult = await res.json();
      setPingResults((p) => ({ ...p, [issuerCode]: data }));
      showToast(
        data.ok ? `${issuerCode}: reachable (${data.latencyMs}ms)` : `${issuerCode}: ${data.message}`,
        data.ok ? "success" : "error",
      );
    } catch {
      setPingResults((p) => ({
        ...p,
        [issuerCode]: { ok: false, status: null, latencyMs: 0, message: "Request failed" },
      }));
    } finally {
      setPinging((p) => ({ ...p, [issuerCode]: false }));
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
          toast.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
        }`}>
          {toast.message}
        </div>
      )}

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
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Issuer Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Register and monitor credential issuers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">← Dashboard</a>
            <a href="/admin/users" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">Users</a>
            <a href="/admin/audit" className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors">Audit</a>
            <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registered Issuers</h2>
          <button
            onClick={() => { setShowRegister(true); setRegError(null); setRegSuccess(null); setPreCheck(null); }}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Register Issuer
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading issuers…
            </div>
          ) : issuers.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
              </svg>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">No issuers registered yet.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Click "Register Issuer" to connect a college connector.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Issuer Code</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Connector URL</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Key Fingerprint</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Registered</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issuers.map((issuer) => {
                    const ping = pingResults[issuer.issuerCode];
                    return (
                      <tr key={issuer.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{issuer.issuerCode}</td>
                        <td className="px-6 py-3 text-slate-900 dark:text-white font-medium">{issuer.name}</td>
                        <td className="px-6 py-3">
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate block max-w-[240px]" title={issuer.connectorBaseUrl}>
                            {issuer.connectorBaseUrl}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">{issuer.publicKeyFingerprint}</td>
                        <td className="px-6 py-3">
                          {ping ? (
                            ping.ok ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Online ({ping.latencyMs}ms)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Offline
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              {issuer.orgStatus === "ACTIVE" ? "Registered" : issuer.orgStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-400 dark:text-slate-500">{new Date(issuer.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Ping */}
                            <button
                              onClick={() => handlePing(issuer.issuerCode)}
                              disabled={pinging[issuer.issuerCode]}
                              title="Check connector health"
                              className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors disabled:opacity-40"
                            >
                              {pinging[issuer.issuerCode] ? (
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424-7.424m-1.414 1.414a2.25 2.25 0 0 0-3.182 0m3.182 0a2.25 2.25 0 0 1 0 3.182m0-3.182L9.702 13.624m4.596-4.596L9.702 13.624m4.596-4.596a5.25 5.25 0 0 1 0 7.424m-7.424 0a5.25 5.25 0 0 1 0-7.424" />
                                </svg>
                              )}
                            </button>
                            {/* Copy URL */}
                            <button
                              onClick={() => copyText(issuer.connectorBaseUrl, `url-${issuer.id}`)}
                              title="Copy connector URL"
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                            >
                              {copiedId === `url-${issuer.id}` ? (
                                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════ REGISTER MODAL ═══════════════════════ */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowRegister(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Register New Issuer</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Connect a college connector to the platform</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Issuer Code *</label>
                <input
                  type="text"
                  value={regForm.issuerCode}
                  onChange={(e) => setRegForm({ ...regForm, issuerCode: e.target.value.toUpperCase() })}
                  className={inputCls}
                  placeholder="e.g. CVR"
                />
                <p className="text-xs text-slate-400 mt-1">Must match the connector&apos;s ISSUER_CODE env variable</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Organization Name *</label>
                <input
                  type="text"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. CVR College of Engineering"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Connector Base URL *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={regForm.connectorBaseUrl}
                    onChange={(e) => { setRegForm({ ...regForm, connectorBaseUrl: e.target.value }); setPreCheck(null); }}
                    className={inputCls + " flex-1"}
                    placeholder="https://authenx-connector.onrender.com"
                  />
                  <button
                    onClick={handlePreCheck}
                    disabled={!regForm.connectorBaseUrl.trim() || preChecking}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5"
                  >
                    {preChecking ? (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424-7.424m-1.414 1.414a2.25 2.25 0 0 0-3.182 0m3.182 0a2.25 2.25 0 0 1 0 3.182" /></svg>
                    )}
                    Test
                  </button>
                </div>
              </div>

              {/* Pre-check results */}
              {preCheck && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${preCheck.health.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Health:</span>
                    <span className={preCheck.health.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {preCheck.health.message} {preCheck.health.ok && `(${preCheck.health.latencyMs}ms)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${preCheck.publicKey.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Public Key:</span>
                    <span className={preCheck.publicKey.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {preCheck.publicKey.ok
                        ? `${preCheck.publicKey.issuerCode} — ${preCheck.publicKey.fingerprint}`
                        : preCheck.publicKey.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Errors / Success */}
              {regError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">{regError}</div>
              )}
              {regSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm">{regSuccess}</div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowRegister(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRegister}
                disabled={!regForm.issuerCode.trim() || !regForm.name.trim() || !regForm.connectorBaseUrl.trim() || registering}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {registering ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Registering…
                  </>
                ) : "Register Issuer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
