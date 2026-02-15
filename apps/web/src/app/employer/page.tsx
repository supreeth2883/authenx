"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface VerificationResult {
  credentialId: string;
  issuerCode: string;
  name: string;
  rollNumber: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
  issuedAt: string;
  verification: {
    hashValid: boolean;
    signatureValid: boolean;
    verified: boolean;
    verifiedAt: string;
    orgName: string;
  };
}

interface LogEntry {
  id: string;
  credentialId: string;
  orgName: string;
  result: boolean;
  hashValid: boolean;
  signatureValid: boolean;
  createdAt: string;
}

export default function EmployerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      </div>
    }>
      <EmployerPageInner />
    </Suspense>
  );
}

function EmployerPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoVerified = useRef(false);
  const [orgName, setOrgName] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Auto-fill credentialId from query param (e.g. QR code link)
  useEffect(() => {
    const qpId = searchParams.get("credentialId");
    if (qpId && !autoVerified.current) {
      setCredentialId(qpId);
    }
  }, [searchParams]);

  const handleLogout = async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    localStorage.removeItem("authenx_role");
    localStorage.removeItem("authenx_user");
    router.push("/login");
  };

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/logs?limit=10`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch {
      // silent fail on log fetch
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-verify when credentialId is set from query param
  useEffect(() => {
    const qpId = searchParams.get("credentialId");
    if (qpId && credentialId === qpId && !autoVerified.current && !loading && !result) {
      autoVerified.current = true;
      // Simulate form submit
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleVerify(fakeEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialId, searchParams]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      if (orgName.trim()) params.set("orgName", orgName.trim());

      const res = await fetch(
        `${API}/credentials/${credentialId.trim()}/verify?${params.toString()}`,
        { credentials: "include" }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Credential not found (HTTP ${res.status})`
        );
      }

      const data: VerificationResult = await res.json();
      setResult(data);

      // Refresh logs after verification
      await fetchLogs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                AuthenX
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Credential Verification Platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Admin Dashboard →
            </a>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full">
              Employer Portal
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Verify Form + Result */}
          <div className="lg:col-span-3 space-y-6">
            {/* Verify Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                Verify a Credential
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Enter the credential ID to cryptographically verify its
                authenticity.
              </p>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Credential ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    placeholder="e.g. cmlmkz8o5000ly1mz..."
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !credentialId.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Verifying…
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                        />
                      </svg>
                      Verify Credential
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-5 flex items-start gap-3">
                <svg
                  className="w-6 h-6 text-red-500 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300">
                    Verification Failed
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Result Card */}
            {result && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Status Banner */}
                <div
                  className={`px-6 py-5 ${
                    result.verification.verified
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800"
                      : "bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.verification.verified ? (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                        <svg
                          className="w-7 h-7 text-emerald-600 dark:text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                        <svg
                          className="w-7 h-7 text-red-600 dark:text-red-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    )}
                    <div>
                      <h3
                        className={`text-2xl font-bold ${
                          result.verification.verified
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {result.verification.verified
                          ? "VERIFIED"
                          : "NOT VERIFIED"}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Verified at{" "}
                        {new Date(
                          result.verification.verifiedAt
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Crypto checks */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-6">
                    <Check
                      label="SHA-256 Hash"
                      ok={result.verification.hashValid}
                    />
                    <Check
                      label="Ed25519 Signature"
                      ok={result.verification.signatureValid}
                    />
                    <div className="ml-auto">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Issuer
                      </span>
                      <p className="font-semibold text-blue-600 dark:text-blue-400">
                        {result.issuerCode}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Credential Details */}
                <div className="px-6 py-5">
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Credential Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Name" value={result.name} />
                    <Field label="Roll Number" value={result.rollNumber} mono />
                    <Field label="Degree" value={result.degree} />
                    <Field label="Branch" value={result.branch} />
                    <Field
                      label="Graduation Year"
                      value={String(result.graduationYear)}
                    />
                    <Field label="CGPA" value={String(result.cgpa)} />
                    <Field
                      label="Issued At"
                      value={new Date(result.issuedAt).toLocaleDateString()}
                    />
                    <Field
                      label="Credential ID"
                      value={result.credentialId}
                      mono
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Recent Logs */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                Recent Verifications
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Last 10 verification checks
              </p>

              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <svg
                    className="animate-spin h-6 w-6 text-blue-500"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
                  No verifications yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          log.result ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {log.orgName}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">
                          {log.credentialId}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-semibold ${
                            log.result
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {log.result ? "PASS" : "FAIL"}
                        </span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <svg
          className="w-5 h-5 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m4.5 12.75 6 6 9-13.5"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      )}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <p
        className={`text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
