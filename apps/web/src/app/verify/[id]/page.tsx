"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

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
    tamperDetected: boolean;
    verifiedAt: string;
    orgName: string;
  };
}

export default function PublicVerifyPage() {
  const params = useParams();
  const credentialId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credentialId) return;

    fetch(`/api/proxy/public/verify/${credentialId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || `Credential not found (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((data: VerificationResult) => setResult(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [credentialId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Verifying credential…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">AuthenX</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Public Credential Verification</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {error ? (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-red-800 dark:text-red-300 mb-1">Verification Failed</h2>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : result ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Status Banner */}
            <div className={`px-6 py-6 text-center ${
              result.verification.verified
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800"
            }`}>
              {result.verification.verified ? (
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <svg className="w-9 h-9 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                  <svg className="w-9 h-9 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <h2 className={`text-2xl font-bold ${
                result.verification.verified
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}>
                {result.verification.verified
                  ? "CREDENTIAL VERIFIED"
                  : result.verification.tamperDetected
                    ? "TAMPER DETECTED"
                    : "VERIFICATION FAILED"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {result.verification.tamperDetected
                  ? "⚠ This credential's data has been altered — hash mismatch"
                  : `Checked at ${new Date(result.verification.verifiedAt).toLocaleString()}`}
              </p>
            </div>

            {/* Crypto Checks */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-6">
              <CryptoCheck label="SHA-256 Hash" ok={result.verification.hashValid} />
              <CryptoCheck label="Ed25519 Signature" ok={result.verification.signatureValid} />
              <div className="ml-auto text-right">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Issuer</span>
                <p className="font-semibold text-blue-600 dark:text-blue-400">{result.issuerCode}</p>
              </div>
            </div>

            {/* Credential Details */}
            <div className="px-6 py-5">
              <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Credential Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Name" value={result.name} />
                <DetailField label="Roll Number" value={result.rollNumber} mono />
                <DetailField label="Degree" value={result.degree} />
                <DetailField label="Branch" value={result.branch} />
                <DetailField label="Graduation Year" value={String(result.graduationYear)} />
                <DetailField label="CGPA" value={String(result.cgpa)} />
                <DetailField label="Issued At" value={new Date(result.issuedAt).toLocaleDateString()} />
                <DetailField label="Credential ID" value={result.credentialId} mono />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                This credential was cryptographically verified using SHA-256 hash integrity and Ed25519 digital signature.
              </p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function CryptoCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      )}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
    </div>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      <p className={`text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
