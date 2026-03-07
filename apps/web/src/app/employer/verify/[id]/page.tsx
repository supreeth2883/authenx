"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { EmployerShell } from "@/components/shells";
import { Spinner } from "@/components/ui";
import { apiGet, ApiError } from "@/lib/api";

interface VerificationResult {
  credentialId: string;
  issuerCode: string;
  issuedAt: string;
  status: "ISSUED" | "REVOKED";
  revokedAt?: string | null;
  verification: {
    hashValid: boolean;
    signatureValid: boolean;
    verified: boolean;
    revoked: boolean;
    tamperDetected: boolean;
    verifiedAt: string;
  };
}

/**
 * Employer deep-link verification page.
 * URL: /employer/verify/[id]
 * Automatically verifies the credential on mount.
 * Requires EMPLOYER role (enforced by middleware + API guard).
 * Shows only minimal safe fields — NO student PII.
 */
export default function EmployerVerifyPage() {
  const params = useParams();
  const credentialId = params.id as string;
  const fetched = useRef(false);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [waking, setWaking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!credentialId || fetched.current) return;
    fetched.current = true;

    const wakingTimer = setTimeout(() => setWaking(true), 3000);

    apiGet<{
      credentialId: string;
      issuerCode: string;
      issuedAt: string;
      status: "ISSUED" | "REVOKED";
      revokedAt?: string | null;
      verification?: {
        hashValid?: boolean;
        signatureValid?: boolean;
        verified?: boolean;
        revoked?: boolean;
        tamperDetected?: boolean;
        verifiedAt?: string;
      };
    }>(`/employer/verify/${credentialId}`)
      .then((data) => {
        clearTimeout(wakingTimer);
        setWaking(false);

        setResult({
          credentialId: data.credentialId,
          issuerCode: data.issuerCode,
          issuedAt: data.issuedAt,
          status: data.status,
          revokedAt: data.revokedAt ?? null,
          verification: {
            hashValid: data.verification?.hashValid ?? false,
            signatureValid: data.verification?.signatureValid ?? false,
            verified: data.verification?.verified ?? false,
            revoked: data.verification?.revoked ?? false,
            tamperDetected: data.verification?.tamperDetected ?? false,
            verifiedAt: data.verification?.verifiedAt ?? new Date().toISOString(),
          },
        });
      })
      .catch((err) => {
        clearTimeout(wakingTimer);
        setWaking(false);
        if (err instanceof ApiError) {
          setErrorCode(err.status);
          if (err.status === 403) {
            setError("Access denied. Only users with the EMPLOYER role can verify credentials.");
          } else if (err.status === 404) {
            setError("Credential not found — the ID may be incorrect or does not exist.");
          } else if (err.status === 429) {
            setError("Rate limit exceeded. Please wait a moment before trying again.");
          } else {
            setError(err.message);
          }
        } else {
          setError((err as Error).message || "Verification failed");
        }
      })
      .finally(() => setLoading(false));
  }, [credentialId]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/employer/verify/${credentialId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Derive states
  const isRevoked = result?.verification?.revoked === true;
  const isTampered = result?.verification?.tamperDetected === true;
  const isVerified = result?.verification?.verified === true && !isRevoked;

  return (
    <EmployerShell
      navItems={[{ label: "Dashboard", href: "/employer", color: "text-blue-600 dark:text-blue-400 hover:text-blue-500" }]}
    >
      <div className="max-w-2xl mx-auto">
        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <Spinner label="Verifying credential…" />
            {waking && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Server is waking up from cold start. This may take 10-15 seconds.
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              {errorCode === 403 || errorCode === 401 ? (
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              ) : errorCode === 429 ? (
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              )}
            </div>
            <h2 className="text-lg font-bold text-red-800 dark:text-red-300 mb-1">
              {errorCode === 403 ? "Access Denied" : errorCode === 401 ? "Login Required" : errorCode === 429 ? "Rate Limited" : "Verification Failed"}
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {(errorCode === 401 || errorCode === 403) && (
              <a
                href={`/login?redirect=/employer/verify/${credentialId}`}
                className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Log in as Employer
              </a>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Status Banner */}
            <div className={`px-6 py-6 text-center ${
              isRevoked
                ? "bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800"
                : isVerified
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800"
            }`}>
              {isRevoked ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <svg className="w-9 h-9 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-red-700 dark:text-red-300">CREDENTIAL REVOKED</h2>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    This credential has been revoked by the issuing institution.
                  </p>
                  {result.revokedAt && (
                    <p className="text-xs text-red-400 dark:text-red-500 mt-1">
                      Revoked on {new Date(result.revokedAt).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : isVerified ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <svg className="w-9 h-9 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">CREDENTIAL VERIFIED</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Cryptographically verified at {new Date(result.verification.verifiedAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <svg className="w-9 h-9 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {isTampered ? "TAMPER DETECTED" : "VERIFICATION FAILED"}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {isTampered
                      ? "This credential's data has been altered — hash mismatch"
                      : `Checked at ${new Date(result.verification.verifiedAt).toLocaleString()}`}
                  </p>
                </>
              )}
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

            {/* Minimal Safe Details — NO PII */}
            <div className="px-6 py-5">
              <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Credential Info
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <SafeField label="Credential ID" value={result.credentialId} mono />
                <SafeField label="Issuer" value={result.issuerCode} />
                <SafeField label="Issued At" value={new Date(result.issuedAt).toLocaleDateString()} />
                <SafeField label="Status" value={result.status} />
                {result.revokedAt && (
                  <SafeField label="Revoked At" value={new Date(result.revokedAt).toLocaleDateString()} />
                )}
              </div>
            </div>

            {/* Privacy Notice */}
            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-950/30 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">Privacy Protected:</span> No sensitive student data (name, CGPA, roll number) is exposed through this verification.
                  Only the credential status and cryptographic integrity are shown.
                </p>
              </div>
            </div>

            {/* Copy Link */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Employer Verification Link (login required)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/employer/verify/${result.credentialId}` : ""}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 cursor-pointer whitespace-nowrap"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Verified using SHA-256 hash integrity and Ed25519 digital signature. Employer login required.
          </p>
        </div>
      </div>
    </EmployerShell>
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

function SafeField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      <p className={`text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
