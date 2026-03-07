"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/shells";
import { PageSpinner, Spinner, Button, inputCls, Modal, Card, EmptyState, useToast, ToastContainer } from "@/components/ui";
import { apiGet, apiPost, ApiError } from "@/lib/api";

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

/* ── Page Component ──────────────────────────────────────────── */

export default function AdminIssuersPage() {
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
  const { toasts, addToast, removeToast } = useToast();

  /* ── Fetch issuers ──────────────────────────────────────── */
  const fetchIssuers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<IssuerRow[]>("/admin/issuers");
      setIssuers(data);
    } catch (ex: unknown) {
      setError(ex instanceof ApiError ? ex.message : "Failed to load issuers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssuers();
  }, [fetchIssuers]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handlePreCheck = async () => {
    const url = regForm.connectorBaseUrl.trim();
    if (!url) return;
    setPreChecking(true);
    setPreCheck(null);
    try {
      const data = await apiPost<ConnectorCheck>("/admin/issuers/check-connector", { connectorBaseUrl: url });
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
      const data = await apiPost<{ message?: string }>("/admin/issuers/register", {
        issuerCode: regForm.issuerCode.trim(),
        name: regForm.name.trim(),
        connectorBaseUrl: regForm.connectorBaseUrl.trim().replace(/\/+$/, ""),
      });
      setRegSuccess(data.message || "Issuer registered successfully!");
      addToast(`Issuer "${regForm.issuerCode}" registered`, "success");
      setRegForm({ issuerCode: "", name: "", connectorBaseUrl: "" });
      setPreCheck(null);
      setShowRegister(false);
      fetchIssuers();
    } catch (ex: unknown) {
      setRegError(ex instanceof ApiError ? ex.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handlePing = async (issuerCode: string) => {
    setPinging((p) => ({ ...p, [issuerCode]: true }));
    try {
      const data = await apiPost<PingResult>(`/admin/issuers/${issuerCode}/ping`);
      setPingResults((p) => ({ ...p, [issuerCode]: data }));
      addToast(
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

  if (loading && issuers.length === 0) return <PageSpinner />;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <AdminShell>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registered Issuers</h2>
        <Button onClick={() => { setShowRegister(true); setRegError(null); setRegSuccess(null); setPreCheck(null); }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Register Issuer
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">{error}</div>
      )}

      {/* Table */}
      <Card padding="p-0" className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Spinner label="Loading issuers…" />
          </div>
          ) : issuers.length === 0 ? (
          <EmptyState
            icon={<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" /></svg>}
            title="No issuers registered yet"
            description='Click "Register Issuer" to connect a college connector.'
          />
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
      </Card>

      {/* ═══════════════════════ REGISTER MODAL ═══════════════════════ */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register New Issuer" subtitle="Connect a college connector to the platform" maxWidth="max-w-lg">

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
                  <Button
                    variant="secondary"
                    onClick={handlePreCheck}
                    disabled={!regForm.connectorBaseUrl.trim()}
                    loading={preChecking}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424-7.424m-1.414 1.414a2.25 2.25 0 0 0-3.182 0m3.182 0a2.25 2.25 0 0 1 0 3.182" /></svg>
                    Test
                  </Button>
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
              <Button variant="secondary" onClick={() => setShowRegister(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleRegister}
                disabled={!regForm.issuerCode.trim() || !regForm.name.trim() || !regForm.connectorBaseUrl.trim()}
                loading={registering}
                className="flex-1"
              >
                Register Issuer
              </Button>
            </div>
      </Modal>
    </AdminShell>
  );
}
