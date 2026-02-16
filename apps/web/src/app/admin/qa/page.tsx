"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Step {
  id: number;
  label: string;
  description: string;
  status: "idle" | "running" | "pass" | "fail" | "skip";
  detail?: string;
  durationMs?: number;
}

const INITIAL_STEPS: Step[] = [
  // — Infrastructure —
  { id: 1, label: "Auth Session", description: "Verify JWT session is active", status: "idle" },
  { id: 2, label: "Cloud API Health", description: "Check API + database health", status: "idle" },
  { id: 3, label: "PostgreSQL", description: "Database responding with low latency", status: "idle" },
  { id: 4, label: "Registered Issuers", description: "Fetch issuer list from platform", status: "idle" },
  { id: 5, label: "Connector Ping", description: "Ping connector for issuer health", status: "idle" },
  // — Mock ERP —
  { id: 6, label: "ERP Records", description: "List mock ERP student records for first issuer", status: "idle" },
  { id: 7, label: "ERP Seed", description: "Seed deterministic QA test student into mock ERP", status: "idle" },
  { id: 8, label: "ERP Lookup", description: "Lookup seeded QA student by roll number", status: "idle" },
  // — Platform Data —
  { id: 9, label: "Platform Stats", description: "Verify stats endpoint returns data", status: "idle" },
  { id: 10, label: "Credential Explorer", description: "Check credentials exist in database", status: "idle" },
  { id: 11, label: "Public Verify", description: "Verify credential via public endpoint (no auth)", status: "idle" },
  { id: 12, label: "Credential Integrity", description: "Deep-verify hash + signature on a credential", status: "idle" },
  // — Audit & Analytics —
  { id: 13, label: "Audit Chain", description: "Verify audit log hash-chain integrity", status: "idle" },
  { id: 14, label: "Analytics", description: "Check issuedPerDay + verification rate", status: "idle" },
  { id: 15, label: "Audit Export", description: "Test CSV audit log export", status: "idle" },
];

export default function QAPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const updateStep = useCallback((id: number, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("authenx_role");
    localStorage.removeItem("authenx_user");
    router.push("/login");
  };

  const runAll = useCallback(async () => {
    setRunning(true);
    setSteps(INITIAL_STEPS);
    setStartedAt(Date.now());
    setFinishedAt(null);

    let firstCredentialId: string | null = null;
    let firstIssuerCode: string | null = null;

    // Helper: timed fetch through proxy
    const timedFetch = async (path: string, opts?: RequestInit) => {
      const t0 = performance.now();
      const res = await fetch(`/api/proxy/${path}`, opts);
      const ms = Math.round(performance.now() - t0);
      return { res, ms };
    };

    // 1. Auth Session
    updateStep(1, { status: "running" });
    try {
      const { res, ms } = await timedFetch("auth/me");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const me = await res.json();
      updateStep(1, { status: "pass", detail: `${me.email} (${me.role})`, durationMs: ms });
    } catch (e: unknown) {
      updateStep(1, { status: "fail", detail: (e as Error).message });
    }

    // 2. Cloud API Health
    updateStep(2, { status: "running" });
    let healthData: { cloudApi: { ok: boolean }; postgres: { ok: boolean; latencyMs?: number }; checkedAt: string } | null = null;
    try {
      const { res, ms } = await timedFetch("admin/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      healthData = await res.json();
      updateStep(2, {
        status: healthData!.cloudApi.ok ? "pass" : "fail",
        detail: `API OK`,
        durationMs: ms,
      });
    } catch (e: unknown) {
      updateStep(2, { status: "fail", detail: (e as Error).message });
    }

    // 3. PostgreSQL
    updateStep(3, { status: "running" });
    if (healthData?.postgres) {
      updateStep(3, {
        status: healthData.postgres.ok ? "pass" : "fail",
        detail: healthData.postgres.latencyMs ? `${healthData.postgres.latencyMs}ms latency` : "OK",
        durationMs: healthData.postgres.latencyMs,
      });
    } else {
      updateStep(3, { status: "skip", detail: "Health check unavailable" });
    }

    // 4. Registered Issuers
    updateStep(4, { status: "running" });
    try {
      const { res, ms } = await timedFetch("admin/issuers");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const issuers = await res.json();
      if (Array.isArray(issuers) && issuers.length > 0) {
        firstIssuerCode = issuers[0].issuerCode;
        updateStep(4, { status: "pass", detail: `${issuers.length} issuer(s): ${issuers.map((i: { issuerCode: string }) => i.issuerCode).join(", ")}`, durationMs: ms });
      } else {
        updateStep(4, { status: "fail", detail: "No issuers registered" });
      }
    } catch (e: unknown) {
      updateStep(4, { status: "fail", detail: (e as Error).message });
    }

    // 5. Connector Ping
    updateStep(5, { status: "running" });
    if (firstIssuerCode) {
      try {
        const { res, ms } = await timedFetch(`admin/issuers/${firstIssuerCode}/ping`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ping = await res.json();
        updateStep(5, {
          status: ping.ok ? "pass" : "fail",
          detail: ping.ok ? `${firstIssuerCode} — ${ping.latencyMs ?? ms}ms` : (ping.message || "Ping failed"),
          durationMs: ms,
        });
      } catch (e: unknown) {
        updateStep(5, { status: "fail", detail: (e as Error).message });
      }
    } else {
      updateStep(5, { status: "skip", detail: "No issuer to ping" });
    }

    // 6. ERP Records
    updateStep(6, { status: "running" });
    if (firstIssuerCode) {
      try {
        const { res, ms } = await timedFetch(`admin/issuers/${firstIssuerCode}/erp/records`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const erp = await res.json();
        const count = Array.isArray(erp) ? erp.length : erp.count ?? 0;
        updateStep(6, {
          status: count > 0 ? "pass" : "fail",
          detail: count > 0 ? `${count} student record(s) in mock ERP` : "No ERP records — seed required",
          durationMs: ms,
        });
      } catch (e: unknown) {
        updateStep(6, { status: "fail", detail: (e as Error).message });
      }
    } else {
      updateStep(6, { status: "skip", detail: "No issuer to query" });
    }

    // 7. ERP Seed — seed a deterministic QA test student
    const QA_STUDENT = {
      rollNumber: "QA-TEST-001",
      name: "QA Test Student",
      degree: "B.Tech",
      branch: "Computer Science",
      graduationYear: 2025,
      cgpa: 8.5,
    };
    updateStep(7, { status: "running" });
    if (firstIssuerCode) {
      try {
        const { res, ms } = await timedFetch(`admin/issuers/${firstIssuerCode}/erp/upsert-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: [QA_STUDENT] }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        updateStep(7, {
          status: "pass",
          detail: `Seeded ${QA_STUDENT.rollNumber} — ${body.upserted ?? 1} upserted`,
          durationMs: ms,
        });
      } catch (e: unknown) {
        updateStep(7, { status: "fail", detail: (e as Error).message });
      }
    } else {
      updateStep(7, { status: "skip", detail: "No issuer to seed" });
    }

    // 8. ERP Lookup — verify the seeded student can be retrieved
    updateStep(8, { status: "running" });
    if (firstIssuerCode) {
      try {
        // Lookup goes through the connector admin — proxy via admin/issuers/:code/erp/records and filter
        const { res, ms } = await timedFetch(`admin/issuers/${firstIssuerCode}/erp/records`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const allRecords = await res.json();
        const records = Array.isArray(allRecords) ? allRecords : allRecords.data ?? [];
        const found = records.find((r: { rollNumber: string }) => r.rollNumber.toUpperCase() === QA_STUDENT.rollNumber.toUpperCase());
        if (found) {
          updateStep(8, {
            status: "pass",
            detail: `Found ${found.rollNumber}: ${found.name} (${found.degree}, ${found.branch})`,
            durationMs: ms,
          });
        } else {
          updateStep(8, { status: "fail", detail: `${QA_STUDENT.rollNumber} not found in ERP after seeding` });
        }
      } catch (e: unknown) {
        updateStep(8, { status: "fail", detail: (e as Error).message });
      }
    } else {
      updateStep(8, { status: "skip", detail: "No issuer" });
    }

    // 9. Platform Stats
    updateStep(9, { status: "running" });
    try {
      const { res, ms } = await timedFetch("admin/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = await res.json();
      updateStep(9, {
        status: "pass",
        detail: `${s.totalCredentials} credentials, ${s.totalVerifications} verifications`,
        durationMs: ms,
      });
    } catch (e: unknown) {
      updateStep(9, { status: "fail", detail: (e as Error).message });
    }

    // 10. Credential Explorer
    updateStep(10, { status: "running" });
    try {
      const { res, ms } = await timedFetch("admin/credentials?page=1&limit=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const creds = await res.json();
      if (creds.data?.length > 0) {
        firstCredentialId = creds.data[0].id;
        updateStep(10, { status: "pass", detail: `${creds.total} total — first: ${firstCredentialId!.slice(0, 16)}…`, durationMs: ms });
      } else {
        updateStep(10, { status: "fail", detail: "No credentials in database" });
      }
    } catch (e: unknown) {
      updateStep(10, { status: "fail", detail: (e as Error).message });
    }

    // 11. Public Verify
    updateStep(11, { status: "running" });
    if (firstCredentialId) {
      try {
        const { res, ms } = await timedFetch(`public/verify/${firstCredentialId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const v = await res.json();
        const label = v.verification?.revoked
          ? "REVOKED"
          : v.verification?.verified
            ? "VERIFIED"
            : v.verification?.tamperDetected
              ? "TAMPERED"
              : "UNKNOWN";
        updateStep(11, { status: "pass", detail: `${label} — hash:${v.verification?.hashValid ? "✓" : "✗"} sig:${v.verification?.signatureValid ? "✓" : "✗"}`, durationMs: ms });
      } catch (e: unknown) {
        updateStep(11, { status: "fail", detail: (e as Error).message });
      }
    } else {
      updateStep(11, { status: "skip", detail: "No credential to verify" });
    }

    // 12. Credential Integrity — deep-verify hash + signature independently
    updateStep(12, { status: "running" });
    if (firstCredentialId) {
      try {
        const { res, ms } = await timedFetch(`admin/credentials/${firstCredentialId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const cred = await res.json();
        const checks: string[] = [];
        if (cred.hash) checks.push("hash:✓");
        else checks.push("hash:✗");
        if (cred.signature) checks.push("sig:✓");
        else checks.push("sig:✗");
        if (cred.status === "ISSUED" || cred.status === "REVOKED") checks.push(`status:${cred.status}`);
        if (cred.issuerCode) checks.push(`issuer:${cred.issuerCode}`);
        const allGood = cred.hash && cred.signature;
        updateStep(12, {
          status: allGood ? "pass" : "fail",
          detail: checks.join(" | "),
          durationMs: ms,
        });
      } catch (e: unknown) {
        updateStep(12, { status: "fail", detail: (e as Error).message });
      }
    } else {
      updateStep(12, { status: "skip", detail: "No credential to inspect" });
    }

    // 13. Audit Chain
    updateStep(13, { status: "running" });
    try {
      const { res, ms } = await timedFetch("admin/audit-logs/verify-chain");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const chain = await res.json();
      updateStep(13, {
        status: chain.valid ? "pass" : "fail",
        detail: chain.valid ? `${chain.totalEntries} entries — chain intact` : `Broken at entry ${chain.brokenAt}`,
        durationMs: ms,
      });
    } catch (e: unknown) {
      updateStep(13, { status: "fail", detail: (e as Error).message });
    }

    // 14. Analytics
    updateStep(14, { status: "running" });
    try {
      const { res, ms } = await timedFetch("admin/analytics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const a = await res.json();
      updateStep(14, {
        status: "pass",
        detail: `${a.issuedPerDay?.length ?? 0} days tracked, ${Math.round(a.verificationRate ?? 0)}% success rate`,
        durationMs: ms,
      });
    } catch (e: unknown) {
      updateStep(14, { status: "fail", detail: (e as Error).message });
    }

    // 15. Audit Export
    updateStep(15, { status: "running" });
    try {
      const { res, ms } = await timedFetch("admin/audit-logs/export");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const exp = await res.json();
      updateStep(15, {
        status: "pass",
        detail: `${exp.count} entries exported (${exp.filename})`,
        durationMs: ms,
      });
    } catch (e: unknown) {
      updateStep(15, { status: "fail", detail: (e as Error).message });
    }

    setFinishedAt(Date.now());
    setRunning(false);
  }, [updateStep]);

  const passCount = steps.filter((s) => s.status === "pass").length;
  const failCount = steps.filter((s) => s.status === "fail").length;
  const skipCount = steps.filter((s) => s.status === "skip").length;
  const totalDuration = startedAt && finishedAt ? ((finishedAt - startedAt) / 1000).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Platform QA</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">End-to-End System Checklist</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">
              ← Dashboard
            </a>
            <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Run button + summary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">System Health Checklist</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Runs 15 sequential checks against all platform endpoints.
              </p>
            </div>
            <button
              onClick={runAll}
              disabled={running}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {running ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Run All Checks
                </>
              )}
            </button>
          </div>

          {/* Summary bar */}
          {finishedAt && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                {passCount} passed
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  {failCount} failed
                </div>
              )}
              {skipCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                  <span className="w-3 h-3 rounded-full bg-slate-400" />
                  {skipCount} skipped
                </div>
              )}
              <span className="ml-auto text-xs text-slate-400">{totalDuration}s total</span>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {steps.map((step, idx) => {
            // Section headers
            const sectionHeaders: Record<number, string> = { 1: "Infrastructure", 6: "Mock ERP", 9: "Platform Data", 13: "Audit & Analytics" };
            const sectionLabel = sectionHeaders[step.id];
            return (
              <div key={step.id}>
                {sectionLabel && (
                  <div className={`px-6 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 ${idx > 0 ? "border-t" : ""}`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{sectionLabel}</span>
                  </div>
                )}
                <div className={`px-6 py-4 flex items-center gap-4 ${idx < steps.length - 1 ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
              {/* Status icon */}
              <div className="w-8 h-8 flex-shrink-0">
                {step.status === "idle" && (
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-400">{step.id}</span>
                  </div>
                )}
                {step.status === "running" && (
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 text-cyan-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
                {step.status === "pass" && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                )}
                {step.status === "fail" && (
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                {step.status === "skip" && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{step.label}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{step.description}</span>
                </div>
                {step.detail && (
                  <p className={`text-xs mt-0.5 truncate ${
                    step.status === "fail" ? "text-red-500 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
                  }`}>
                    {step.detail}
                  </p>
                )}
              </div>

              {/* Duration */}
              {step.durationMs !== undefined && (
                <span className="text-xs font-mono text-slate-400 flex-shrink-0">{step.durationMs}ms</span>
              )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            AuthenX QA — All checks run as SUPER_ADMIN via the proxy. Public verify uses the unauthenticated endpoint.
          </p>
        </div>
      </main>
    </div>
  );
}
