"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { CollegeShell } from "@/components/shells";
import { PageSpinner, Spinner, Button, inputCls, Card, Modal, Pagination } from "@/components/ui";
import { QrModal } from "@/components/ui/qr-modal";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

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

interface IssuedCredential {
  id: string;
  issuerCode: string;
  keyVersion: number;
  name: string;
  rollNumber: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
  hash: string;
  signature: string;
  status: "ISSUED" | "REVOKED";
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
}

interface IssuedResponse {
  data: IssuedCredential[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type Tab = "issue" | "erp" | "issued";

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
  /* auth */
  const [authChecked, setAuthChecked] = useState(false);
  const [userIssuerCode, setUserIssuerCode] = useState<string | null>(null);

  /* tabs */
  const [activeTab, setActiveTab] = useState<Tab>("issue");

  /* batch (Issue tab) */
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [form, setForm] = useState<StudentRecord>({ ...EMPTY_RECORD });
  const [issuerCode, setIssuerCode] = useState("CVR");

  /* publish */
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<PublishResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* precheck state: rollNumber -> { status, detail } */
  const [precheckMap, setPrecheckMap] = useState<Record<string, { status: "checking" | "matched" | "not_found" | "mismatch" | "error"; detail?: string }>>({});

  const handlePrecheck = async (record: StudentRecord) => {
    setPrecheckMap((prev) => ({ ...prev, [record.rollNumber]: { status: "checking" } }));
    try {
      const data = await apiPost<{ matched: boolean; reason?: string; diff?: Record<string, unknown> }>("/college/credentials/precheck", { issuerCode, ...record });
      if (data.matched) {
        setPrecheckMap((prev) => ({ ...prev, [record.rollNumber]: { status: "matched", detail: "Found in ERP" } }));
      } else if (data.reason === "NOT_FOUND" || data.reason === "ERP_EMPTY") {
        setPrecheckMap((prev) => ({ ...prev, [record.rollNumber]: { status: "not_found", detail: data.reason === "ERP_EMPTY" ? "ERP store is empty" : "Not found in ERP" } }));
      } else {
        setPrecheckMap((prev) => ({ ...prev, [record.rollNumber]: { status: "mismatch", detail: `Mismatch: ${Object.keys(data.diff || {}).join(", ")}` } }));
      }
    } catch (err) {
      setPrecheckMap((prev) => ({ ...prev, [record.rollNumber]: { status: "error", detail: (err as Error).message } }));
    }
  };

  /* csv */
  const fileRef = useRef<HTMLInputElement>(null);

  /* qr modal */
  const [qrModal, setQrModal] = useState<{ id: string; name: string } | null>(null);

  /* revoke modal */
  const [revokeModal, setRevokeModal] = useState<{ id: string; name: string; rollNumber: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  /* copy feedback */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* expand diff rows */
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  /* issued tab */
  const [issuedData, setIssuedData] = useState<IssuedResponse | null>(null);
  const [issuedPage, setIssuedPage] = useState(1);
  const [issuedSearch, setIssuedSearch] = useState("");
  const [issuedLoading, setIssuedLoading] = useState(false);

  /* ERP issue tab */
  const [erpRollNumber, setErpRollNumber] = useState("");
  const [erpLoading, setErpLoading] = useState(false);
  const [erpError, setErpError] = useState<string | null>(null);
  const [erpResult, setErpResult] = useState<{
    credentialId: string;
    hash: string;
    signature: string;
    student: { rollNumber: string; name: string; degree: string; branch: string; graduationYear: number };
  } | null>(null);
  const [erpAlreadyIssued, setErpAlreadyIssued] = useState<string | null>(null);

  /* ── Auth check ─────────────────────────────────────────── */
  useEffect(() => {
    apiGet<{ issuerCode?: string }>("/auth/me")
      .then((u) => {
        if (u.issuerCode) {
          setUserIssuerCode(u.issuerCode);
          setIssuerCode(u.issuerCode);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  /* ── Fetch issued credentials ───────────────────────────── */
  const fetchIssued = async (page: number, search: string) => {
    setIssuedLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search.trim()) params.set("search", search.trim());
      const data = await apiGet<IssuedResponse>(`/college/credentials?${params}`);
      setIssuedData(data);
    } catch {
      // silent
    } finally {
      setIssuedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "issued" && authChecked) {
      fetchIssued(issuedPage, issuedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, issuedPage, issuedSearch, authChecked]);

  /* ── Loading gate ───────────────────────────────────────── */
  if (!authChecked) return <PageSpinner gradient="bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900" />;

  /* ── Handlers ───────────────────────────────────────────── */

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
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePublish = async () => {
    if (records.length === 0) return;
    setPublishing(true);
    setError(null);
    setResults(null);
    setExpandedRows(new Set());

    try {
      const data = await apiPost<PublishResponse>("/college/credentials/publish", { issuerCode, records });
      setResults(data);
      if (data.issued > 0) {
        fetchIssued(1, "");
      }
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = async (text: string, feedbackKey: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(feedbackKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async () => {
    if (!revokeModal || !revokeReason.trim()) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await apiPatch(`/college/credentials/${revokeModal.id}/revoke`, { reason: revokeReason.trim() });
      fetchIssued(issuedPage, issuedSearch);
      setRevokeModal(null);
      setRevokeReason("");
    } catch (ex: unknown) {
      setRevokeError(ex instanceof Error ? ex.message : "Revoke failed");
    } finally {
      setRevoking(false);
    }
  };

  const toggleRowExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleErpIssue = async () => {
    if (!erpRollNumber.trim()) return;
    setErpLoading(true);
    setErpError(null);
    setErpResult(null);
    setErpAlreadyIssued(null);
    try {
      const data = await apiPost<{
        credentialId: string;
        hash: string;
        signature: string;
        student: { rollNumber: string; name: string; degree: string; branch: string; graduationYear: number };
      }>("/college/credentials/issue-from-erp", { rollNumber: erpRollNumber.trim() });
      setErpResult(data);
      fetchIssued(1, "");
    } catch (ex: unknown) {
      if (ex instanceof ApiError && ex.status === 409) {
        const match = ex.message.match(/id=([a-zA-Z0-9]+)/);
        setErpAlreadyIssued(match ? match[1] : ex.message || "Already issued");
        return;
      }
      setErpError(ex instanceof Error ? ex.message : "Issue failed");
    } finally {
      setErpLoading(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <CollegeShell
      issuerCode={userIssuerCode}
      navItems={[{ label: "Dashboard", href: "/college", color: "text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400" }]}
    >
        {/* Tab navigation */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("issue")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "issue"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Issue New
          </button>
          <button
            onClick={() => setActiveTab("erp")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "erp"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Issue from ERP
          </button>
          <button
            onClick={() => setActiveTab("issued")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "issued"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Issued Credentials
            {issuedData && <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">{issuedData.total}</span>}
          </button>
        </div>

        <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">{error}</motion.div>
        )}
        </AnimatePresence>

        {/* ═══════════════════════ ISSUE TAB ═══════════════════════ */}
        {activeTab === "issue" && (
          <>
            {/* Issuer Code */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Issuer Code</label>
              <input
                type="text"
                value={issuerCode}
                onChange={(e) => setIssuerCode(e.target.value)}
                className={inputCls + " max-w-xs"}
                placeholder="e.g. CVR"
                readOnly={!!userIssuerCode}
              />
              {userIssuerCode && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Auto-set from your account profile</p>
              )}
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
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">ERP</th>
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
                          <td className="px-6 py-3">
                            {(() => {
                              const pc = precheckMap[r.rollNumber];
                              if (!pc) return (
                                <button onClick={() => handlePrecheck(r)} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 cursor-pointer whitespace-nowrap">Check ERP</button>
                              );
                              if (pc.status === "checking") return <span className="text-xs text-slate-400">Checking…</span>;
                              if (pc.status === "matched") return <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Found</span>;
                              if (pc.status === "not_found") return <span className="text-xs text-red-500" title={pc.detail}>✗ Not found</span>;
                              if (pc.status === "mismatch") return <span className="text-xs text-amber-500" title={pc.detail}>⚠ Mismatch</span>;
                              return <span className="text-xs text-red-400" title={pc.detail}>Error</span>;
                            })()}
                          </td>
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
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <SummaryCard label="Total Records" value={results.total} icon="list" color="blue" />
                  <SummaryCard label="Issued" value={results.issued} icon="check" color="emerald" />
                  <SummaryCard label="Failed" value={results.failed} icon="x" color="red" />
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
                      <button
                        onClick={() => setActiveTab("issued")}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-2"
                      >
                        View All Issued →
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Roll No.</th>
                          <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                          <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Details</th>
                          <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.results.map((r, i) => (
                          <ResultRow
                            key={i}
                            item={r}
                            idx={i}
                            expanded={expandedRows.has(i)}
                            onToggleExpand={() => toggleRowExpand(i)}
                            onShowQr={(id, name) => setQrModal({ id, name })}
                            onCopy={copyToClipboard}
                            copiedId={copiedId}
                          />
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
          </>
        )}

        {/* ═══════════════════════ ERP ISSUE TAB ═══════════════════════ */}
        {activeTab === "erp" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Issue from College ERP</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Look up a student in the College ERP database by roll number and issue a signed credential. The ERP record is the source of truth.
              </p>
              <div className="flex gap-3 items-end max-w-lg">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Roll Number</label>
                  <input
                    type="text"
                    value={erpRollNumber}
                    onChange={(e) => { setErpRollNumber(e.target.value); setErpError(null); setErpResult(null); setErpAlreadyIssued(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleErpIssue()}
                    className={inputCls}
                    placeholder="e.g. 21B81A0501"
                    disabled={erpLoading}
                  />
                </div>
                <button
                  onClick={handleErpIssue}
                  disabled={erpLoading || !erpRollNumber.trim()}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {erpLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Issuing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      Issue Credential
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
            {erpError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {erpError}
              </motion.div>
            )}
            </AnimatePresence>

            {/* Already Issued */}
            <AnimatePresence>
            {erpAlreadyIssued && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-sm flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                </svg>
                <div>
                  <p className="font-semibold">Credential already issued</p>
                  <p className="text-xs mt-0.5 opacity-80">ID: {erpAlreadyIssued}</p>
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Success Result */}
            <AnimatePresence>
            {erpResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-emerald-200 dark:border-emerald-800 p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-300">Credential Issued Successfully</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Source of truth: College ERP database</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Student</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{erpResult.student.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Roll Number</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{erpResult.student.rollNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Degree</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{erpResult.student.degree} — {erpResult.student.branch}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Credential ID</span>
                    <button onClick={() => copyToClipboard(erpResult.credentialId, "erp-id")} className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 cursor-pointer">
                      {copiedId === "erp-id" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-sm text-slate-900 dark:text-white break-all">{erpResult.credentialId}</p>
                  <div className="flex gap-2 text-xs text-slate-400">
                    <span>Hash: {erpResult.hash?.slice(0, 16)}...</span>
                    <span>Sig: {erpResult.signature?.slice(0, 16)}...</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center pt-2">
                  <div className="text-center">
                    <QRCodeSVG value={`authenx:${erpResult.credentialId}`} size={160} />
                    <p className="text-xs text-slate-400 mt-2">Scan to verify credential</p>
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══════════════════════ ISSUED TAB ═══════════════════════ */}
        {activeTab === "issued" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Search bar */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex-shrink-0">
                Issued Credentials
              </h3>
              <div className="relative max-w-sm w-full">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={issuedSearch}
                  onChange={(e) => { setIssuedSearch(e.target.value); setIssuedPage(1); }}
                  placeholder="Search by name or roll number…"
                  className={inputCls + " pl-9"}
                />
              </div>
            </div>

            {issuedLoading ? (
              <div className="p-12 text-center">
                <Spinner label="Loading…" />
              </div>
            ) : issuedData && issuedData.data.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Roll No.</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Degree</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Branch</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Year</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">CGPA</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                        <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Issued</th>
                        <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issuedData.data.map((cred) => (
                        <tr key={cred.id} className={`border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 ${cred.status === "REVOKED" ? "opacity-60" : ""}`}>
                          <td className="px-6 py-3 text-slate-900 dark:text-white font-medium">{cred.name}</td>
                          <td className="px-6 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{cred.rollNumber}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{cred.degree}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{cred.branch}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{cred.graduationYear}</td>
                          <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{cred.cgpa}</td>
                          <td className="px-6 py-3">
                            {cred.status === "REVOKED" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400" title={cred.revokedReason || undefined}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                Revoked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-xs text-slate-400 dark:text-slate-500">
                            {new Date(cred.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Copy credential ID */}
                              <button
                                onClick={() => copyToClipboard(cred.id, `id-${cred.id}`)}
                                title="Copy credential ID"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                              >
                                {copiedId === `id-${cred.id}` ? (
                                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                                )}
                              </button>
                              {/* Copy verify link */}
                              <button
                                onClick={() => copyToClipboard(`${window.location.origin}/employer/verify/${cred.id}`, `link-${cred.id}`)}
                                title="Copy verify link"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                              >
                                {copiedId === `link-${cred.id}` ? (
                                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                                )}
                              </button>
                              {/* Show QR */}
                              <button
                                onClick={() => setQrModal({ id: cred.id, name: cred.name })}
                                title="Show QR code"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" /></svg>
                              </button>
                              {/* Revoke button — only for ISSUED */}
                              {cred.status === "ISSUED" && (
                                <button
                                  onClick={() => setRevokeModal({ id: cred.id, name: cred.name, rollNumber: cred.rollNumber })}
                                  title="Revoke credential"
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {issuedData.totalPages > 1 && (
                  <Pagination page={issuedData.page} totalPages={issuedData.totalPages} total={issuedData.total} limit={issuedData.limit} onPageChange={setIssuedPage} />
                )}
              </>
            ) : (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <p className="text-sm">No credentials issued yet.</p>
              </div>
            )}
          </div>
        )}

      {/* QR Modal */}
      <QrModal
        open={!!qrModal}
        onClose={() => setQrModal(null)}
        credentialId={qrModal?.id ?? ""}
        credentialName={qrModal?.name}
      />

      {/* Revoke Confirmation Modal */}
      <Modal
        open={!!revokeModal}
        onClose={() => { setRevokeModal(null); setRevokeReason(""); setRevokeError(null); }}
        title="Revoke Credential"
        subtitle="This action cannot be undone."
      >
            {revokeModal && (
              <>
                <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 mb-4 text-sm">
                  <p className="text-red-800 dark:text-red-300">
                    <span className="font-semibold">{revokeModal.name}</span> — {revokeModal.rollNumber}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">{revokeModal.id}</p>
                </div>

                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason for revocation *</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Fraudulent application, data error, student expelled…"
                  rows={3}
                  className={inputCls + " resize-none focus:ring-red-500"}
                />

                {revokeError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">{revokeError}</p>
                )}

                <div className="flex gap-2 mt-4">
                  <Button variant="secondary" className="flex-1" onClick={() => { setRevokeModal(null); setRevokeReason(""); setRevokeError(null); }}>
                    Cancel
                  </Button>
                  <Button variant="danger" className="flex-1" loading={revoking} disabled={!revokeReason.trim()} onClick={handleRevoke}>
                    Revoke Credential
                  </Button>
                </div>
              </>
            )}
      </Modal>
    </CollegeShell>
  );
}

/* ── Result Row Component (with expandable diff) ──────────── */

function ResultRow({
  item,
  idx,
  expanded,
  onToggleExpand,
  onShowQr,
  onCopy,
  copiedId,
}: {
  item: PublishResultItem;
  idx: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onShowQr: (id: string, name: string) => void;
  onCopy: (text: string, key: string) => void;
  copiedId: string | null;
}) {
  const hasDiff = item.diff && Object.keys(item.diff).length > 0;

  return (
    <>
      <tr className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
        <td className="px-6 py-3 font-mono text-xs text-slate-900 dark:text-white">{item.rollNumber}</td>
        <td className="px-6 py-3">
          <StatusBadge status={item.status} />
        </td>
        <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
          {item.status === "MATCHED_AND_ISSUED" && item.credentialId && (
            <span>
              Issued —{" "}
              <a href={`/employer/verify/${item.credentialId}`} className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono">
                {item.credentialId.slice(0, 12)}…
              </a>
            </span>
          )}
          {item.status === "ALREADY_ISSUED" && item.credentialId && (
            <span>
              Already exists —{" "}
              <a href={`/employer/verify/${item.credentialId}`} className="text-blue-600 dark:text-blue-400 hover:underline font-mono">
                {item.credentialId.slice(0, 12)}…
              </a>
            </span>
          )}
          {item.status === "ALREADY_ISSUED" && !item.credentialId && (
            <span>{item.reason || "Credential already exists"}</span>
          )}
          {item.status === "NOT_FOUND" && (
            <span className="text-red-500">{item.reason || "Student not found in ERP source. Seed mock ERP via Admin → Issuers, or connect a real ERP."}</span>
          )}
          {item.status === "ERROR" && <span className="text-red-500">{item.reason || "Unknown error"}</span>}
          {item.status === "MISMATCH" && (
            <button
              onClick={onToggleExpand}
              className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              {hasDiff ? `${Object.keys(item.diff!).length} field(s) differ` : item.reason || "Data mismatch"}
              {hasDiff && (
                <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              )}
            </button>
          )}
        </td>
        <td className="px-6 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {item.credentialId && (
              <>
                <button
                  onClick={() => onCopy(item.credentialId!, `res-id-${idx}`)}
                  title="Copy credential ID"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                >
                  {copiedId === `res-id-${idx}` ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                  )}
                </button>
                <button
                  onClick={() => onCopy(`${window.location.origin}/employer/verify/${item.credentialId}`, `res-link-${idx}`)}
                  title="Copy verify link"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
                >
                  {copiedId === `res-link-${idx}` ? (
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                  )}
                </button>
                <button
                  onClick={() => onShowQr(item.credentialId!, item.rollNumber)}
                  title="Show QR code"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" /></svg>
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {/* Expanded diff row */}
      {expanded && hasDiff && (
        <tr className="bg-amber-50/50 dark:bg-amber-950/20">
          <td colSpan={4} className="px-6 py-4">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-100 dark:bg-amber-900/40">
                    <th className="text-left px-4 py-2 font-semibold text-amber-800 dark:text-amber-300">Field</th>
                    <th className="text-left px-4 py-2 font-semibold text-red-700 dark:text-red-400">You Sent</th>
                    <th className="text-left px-4 py-2 font-semibold text-emerald-700 dark:text-emerald-400">ERP Record</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(item.diff!).map(([field, vals]) => (
                    <tr key={field} className="border-t border-amber-200 dark:border-amber-800/50">
                      <td className="px-4 py-2 font-medium text-amber-800 dark:text-amber-300">{field}</td>
                      <td className="px-4 py-2 text-red-600 dark:text-red-400 font-mono bg-red-50/50 dark:bg-red-950/20">{String(vals.received)}</td>
                      <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50/50 dark:bg-emerald-950/20">{String(vals.expected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Shared Components ────────────────────────────────────── */

/* ── Page-specific components ─────────────────────────────── */

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: "list" | "check" | "x"; color: "blue" | "emerald" | "red" }) {
  const bgMap = { blue: "bg-blue-50 dark:bg-blue-950/40", emerald: "bg-emerald-50 dark:bg-emerald-950/40", red: "bg-red-50 dark:bg-red-950/40" };
  const textMap = { blue: "text-blue-600 dark:text-blue-400", emerald: "text-emerald-600 dark:text-emerald-400", red: "text-red-600 dark:text-red-400" };
  const icons = {
    list: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>,
    check: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
    x: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgMap[color]} ${textMap[color]}`}>
        {icons[icon]}
      </div>
      <div>
        <p className={`text-2xl font-bold ${textMap[color]}`}>{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

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

