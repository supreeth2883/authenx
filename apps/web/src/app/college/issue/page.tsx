"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

/* ── Types ────────────────────────────────────────────────── */

interface StudentRecord {
  rollNumber: string;
  name: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
}

interface PublishResultItem {
  rollNumber: string;
  status: "MATCHED_AND_ISSUED" | "NOT_FOUND" | "MISMATCH" | "ALREADY_ISSUED" | "ERROR";
  credentialId?: string;
  qrPayload?: string;
  reason?: string;
  diff?: Record<string, { expected: unknown; received: unknown }>;
}

interface PublishResponse {
  total: number;
  issued: number;
  failed: number;
  results: PublishResultItem[];
}

const EMPTY_RECORD: StudentRecord = {
  rollNumber: "",
  name: "",
  degree: "B.Tech",
  branch: "",
  graduationYear: 2025,
  cgpa: 0,
};

/* ── Page ─────────────────────────────────────────────────── */

export default function IssueCredentialsPage() {
  const router = useRouter();

  /* auth */
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  /* batch */
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [form, setForm] = useState<StudentRecord>({ ...EMPTY_RECORD });
  const [issuerCode, setIssuerCode] = useState("CVR");

  /* publish */
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* csv */
  const fileRef = useRef<HTMLInputElement>(null);

  /* qr modal */
  const [qrModal, setQrModal] = useState<{ id: string; name: string } | null>(null);

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

  /* ── RBAC gate ──────────────────────────────────────────── */
  if (!authChecked) return <Spinner />;

  if (currentRole !== "COLLEGE_ADMIN" && currentRole !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow p-8 text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Not Authorized</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Only College Admins can issue credentials.</p>
          <button onClick={() => router.push("/admin")} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  /* ── Handlers ───────────────────────────────────────────── */
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const addRecord = () => {
    if (!form.rollNumber.trim() || !form.name.trim() || !form.branch.trim()) return;
    setRecords((prev) => [...prev, { ...form }]);
    setForm({ ...EMPTY_RECORD });
  };

  const removeRecord = (idx: number) => {
    setRecords((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;
      // Parse header
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const riRoll = header.indexOf("rollnumber");
      const riName = header.indexOf("name");
      const riDeg = header.indexOf("degree");
      const riBranch = header.indexOf("branch");
      const riYear = header.indexOf("graduationyear");
      const riCgpa = header.indexOf("cgpa");

      const parsed: StudentRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols.length < 6) continue;
        parsed.push({
          rollNumber: cols[riRoll >= 0 ? riRoll : 0] || "",
          name: cols[riName >= 0 ? riName : 1] || "",
          degree: cols[riDeg >= 0 ? riDeg : 2] || "B.Tech",
          branch: cols[riBranch >= 0 ? riBranch : 3] || "",
          graduationYear: parseInt(cols[riYear >= 0 ? riYear : 4]) || 2025,
          cgpa: parseFloat(cols[riCgpa >= 0 ? riCgpa : 5]) || 0,
        });
      }
      setRecords((prev) => [...prev, ...parsed]);
    };
    reader.readAsText(file);
    // Reset the input so same file can be re-uploaded
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePublish = async () => {
    if (records.length === 0) return;
    setPublishing(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/proxy/college/credentials/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuerCode, records }),
      });
      if (res.status === 403) {
        setError("Not authorized — COLLEGE_ADMIN only");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      const data: PublishResponse = await res.json();
      setResults(data);
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Issue Credentials</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">College Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">← Dashboard</a>
            <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {/* Issuer Code */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Issuer Code</label>
          <input
            type="text"
            value={issuerCode}
            onChange={(e) => setIssuerCode(e.target.value)}
            className={inputCls + " max-w-xs"}
            placeholder="e.g. CVR"
          />
        </div>

        {/* Add Record Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Add Student Record</h3>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Upload CSV
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Roll Number</label>
              <input type="text" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} className={inputCls} placeholder="21B81A0501" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Student Name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Degree</label>
              <input type="text" value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} className={inputCls} placeholder="B.Tech" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Branch</label>
              <input type="text" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className={inputCls} placeholder="Computer Science" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Graduation Year</label>
              <input type="number" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: parseInt(e.target.value) || 2025 })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">CGPA</label>
              <input type="number" step="0.01" value={form.cgpa || ""} onChange={(e) => setForm({ ...form, cgpa: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="8.75" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={addRecord}
              disabled={!form.rollNumber.trim() || !form.name.trim() || !form.branch.trim()}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add to Batch
            </button>
          </div>
        </div>

        {/* Batch Preview Table */}
        {records.length > 0 && !results && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Batch Preview — {records.length} record{records.length !== 1 ? "s" : ""}
              </h3>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {publishing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Publishing…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                    Publish Results
                  </>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Roll No.</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Degree</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Branch</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Year</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">CGPA</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3 font-mono text-xs text-slate-900 dark:text-white">{r.rollNumber}</td>
                      <td className="px-6 py-3 text-slate-900 dark:text-white">{r.name}</td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{r.degree}</td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{r.branch}</td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{r.graduationYear}</td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{r.cgpa}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => removeRecord(i)} className="text-xs text-red-500 hover:text-red-400 cursor-pointer">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Table */}
        {results && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{results.total}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Records</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{results.issued}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Issued</p>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.failed}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Failed</p>
                </div>
              </div>
            </div>

            {/* Per-row results */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Publish Results</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setResults(null); setRecords([]); }}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    New Batch
                  </button>
                  <a
                    href="/admin"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  >
                    View in Dashboard →
                  </a>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Roll No.</th>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Credential ID</th>
                      <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Details</th>
                      <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-3 font-mono text-xs text-slate-900 dark:text-white">{r.rollNumber}</td>
                        <td className="px-6 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {r.credentialId || "—"}
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {r.reason || (r.status === "MATCHED_AND_ISSUED" ? "Successfully issued" : "")}
                          {r.diff && (
                            <span className="block mt-1 text-red-500">
                              Mismatched: {Object.keys(r.diff).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {r.credentialId && (
                            <button
                              onClick={() => setQrModal({ id: r.credentialId!, name: r.rollNumber })}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 cursor-pointer font-medium"
                            >
                              Show QR
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {records.length === 0 && !results && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm">Add student records above or upload a CSV to get started.</p>
            <p className="text-xs mt-2 text-slate-300 dark:text-slate-600">CSV format: rollNumber, name, degree, branch, graduationYear, cgpa</p>
          </div>
        )}
      </main>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setQrModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">Credential QR</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">{qrModal.name}</p>
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/employer?credentialId=${qrModal.id}`}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
            </div>
            <p className="text-xs text-center font-mono text-slate-400 dark:text-slate-500 break-all mb-4">{qrModal.id}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/employer?credentialId=${qrModal.id}`)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Copy Link
              </button>
              <button
                onClick={() => setQrModal(null)}
                className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared Components ────────────────────────────────────── */

const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    MATCHED_AND_ISSUED: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    NOT_FOUND: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
    MISMATCH: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    ALREADY_ISSUED: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    ERROR: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  };
  const labels: Record<string, string> = {
    MATCHED_AND_ISSUED: "Issued",
    NOT_FOUND: "Not Found",
    MISMATCH: "Mismatch",
    ALREADY_ISSUED: "Already Issued",
    ERROR: "Error",
  };
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[status] || styles.ERROR}`}>
      {labels[status] || status}
    </span>
  );
}

function Spinner() {
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
