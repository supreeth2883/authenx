"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  status?: "ISSUED" | "REVOKED";
  revokedAt?: string | null;
  revokedReason?: string | null;
  verification: {
    hashValid: boolean;
    signatureValid: boolean;
    verified: boolean;
    tamperDetected: boolean;
    revoked?: boolean;
    verifiedAt: string;
    orgName: string;
  };
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
  const [waking, setWaking] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill credentialId from query param (e.g. QR code link)
  useEffect(() => {
    let qpId = searchParams.get("credentialId");
    if (qpId && !autoVerified.current) {
      if (qpId.startsWith("authenx:")) {
        qpId = qpId.slice(8);
      }
      setCredentialId(qpId);
    }
  }, [searchParams]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("authenx_role");
    localStorage.removeItem("authenx_user");
    router.push("/login");
  };

  // Auto-verify when credentialId is set from query param
  useEffect(() => {
    const qpId = searchParams.get("credentialId");
    if (qpId && credentialId === qpId && !autoVerified.current && !loading && !result) {
      autoVerified.current = true;
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
    setWaking(false);

    // Cold-start: if request takes >3s, show waking message
    const wakingTimer = setTimeout(() => setWaking(true), 3000);

    try {
      const params = new URLSearchParams();
      if (orgName.trim()) params.set("orgName", orgName.trim());

      const res = await fetch(
        `/api/proxy/employer/verify/${credentialId.trim()}?${params.toString()}`
      );

      clearTimeout(wakingTimer);
      setWaking(false);

      if (res.status === 404) {
        throw new Error("Credential not found — the ID may be incorrect or does not exist.");
      }
      if (res.status === 403) {
        throw new Error("Access denied — Employer role required.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Verification failed (HTTP ${res.status})`);
      }

      const data: VerificationResult = await res.json();
      setResult(data);
    } catch (err) {
      clearTimeout(wakingTimer);
      setWaking(false);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Determine result state
  const isRevoked = result?.status === "REVOKED" || result?.verification?.revoked === true;
  const isTampered = result?.verification?.tamperDetected === true;
  const isVerified = result?.verification?.verified === true && !isRevoked;

  // QR scanner: extract credential ID from QR data
  const extractCredentialId = useCallback((data: string): string | null => {
    let id = data.trim();
    if (id.startsWith("authenx:")) id = id.slice(8);
    // Check if it looks like a URL with credentialId param
    try {
      const url = new URL(id);
      const qp = url.searchParams.get("credentialId");
      if (qp) id = qp.startsWith("authenx:") ? qp.slice(8) : qp;
      // Check if it's a /employer/verify/<id> or /employer?credentialId=<id> path
      const parts = url.pathname.split("/");
      const verifyIdx = parts.indexOf("verify");
      if (verifyIdx >= 0 && parts[verifyIdx + 1]) {
        id = parts[verifyIdx + 1];
      }
    } catch {
      // Not a URL, use as-is
    }
    return id.length > 8 ? id : null;
  }, []);

  // Start camera scanner
  const startScanner = useCallback(async () => {
    setShowScanner(true);
    setCameraError(null);
    scanningRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Use BarcodeDetector if available (Chrome, Edge, Android)
      const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

      const scanFrame = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        const video = videoRef.current;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
          requestAnimationFrame(scanFrame);
          return;
        }

        try {
          if (hasBarcodeDetector) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const cid = extractCredentialId(barcodes[0].rawValue);
              if (cid) {
                setCredentialId(cid);
                stopScanner();
                return;
              }
            }
          } else {
            // Canvas-based fallback: capture frame to canvas and look for QR-like data
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              // Without a QR decoding library, we rely on BarcodeDetector
              // Show a message suggesting image upload instead
            }
          }
        } catch {
          // Detection failed for this frame, continue
        }

        if (scanningRef.current) {
          requestAnimationFrame(scanFrame);
        }
      };

      requestAnimationFrame(scanFrame);

      if (!hasBarcodeDetector) {
        setCameraError("Your browser does not support QR scanning from camera. Please use the image upload option instead.");
      }
    } catch (err) {
      setCameraError((err as Error).message || "Camera access denied");
      setShowScanner(false);
    }
  }, [extractCredentialId]);

  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowScanner(false);
    setCameraError(null);
  }, []);

  // Handle QR image upload
  const handleQrImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      // Use BarcodeDetector if available
      const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
      if (hasBarcodeDetector) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            const cid = extractCredentialId(barcodes[0].rawValue);
            if (cid) {
              setCredentialId(cid);
              setError(null);
              return;
            }
          }
        } catch {
          // BarcodeDetector failed
        }
      }

      // Try createImageBitmap + BarcodeDetector as fallback
      try {
        const bitmap = await createImageBitmap(canvas);
        if (hasBarcodeDetector) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          const barcodes = await detector.detect(bitmap);
          if (barcodes.length > 0) {
            const cid = extractCredentialId(barcodes[0].rawValue);
            if (cid) {
              setCredentialId(cid);
              setError(null);
              return;
            }
          }
        }
      } catch {
        // Failed
      }

      setError("Could not decode QR code from image. Try a clearer image or paste the credential ID manually.");
    };
    img.src = URL.createObjectURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [extractCredentialId]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">AuthenX</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Employer Verification Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-3 py-1 rounded-full">
              Employer
            </span>
            <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Verify Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Verify a Credential</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Scan a QR code, upload a QR image, or enter the credential ID to cryptographically verify its authenticity.
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
                onChange={(e) => {
                  let val = e.target.value.trim();
                  if (val.startsWith("authenx:")) val = val.slice(8);
                  setCredentialId(val);
                }}
                placeholder="e.g. cmlmkz8o5000ly1mz... or authenx:<id>"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-sm"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Paste a credential ID or QR payload (authenx:&lt;id&gt;)
              </p>
              {/* QR Scan buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={showScanner ? stopScanner : startScanner}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  {showScanner ? "Stop Camera" : "Scan QR"}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleQrImageUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload QR Image
                </button>
              </div>
            </div>

            {/* Camera Scanner */}
            {showScanner && (
              <div className="rounded-xl overflow-hidden border border-blue-200 dark:border-blue-800 bg-black relative">
                <video
                  ref={videoRef}
                  className="w-full max-h-80 object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-2xl" />
                </div>
                {cameraError && (
                  <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-white text-xs p-2 text-center">
                    {cameraError}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !credentialId.trim()}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {waking ? "Waking server…" : "Verifying…"}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                  Verify Credential
                </>
              )}
            </button>
          </form>
        </div>

        {/* Cold start hint */}
        {waking && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            Server is waking up from cold start. This may take 10-15 seconds on first request.
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-5 flex items-start gap-3"
          >
            <svg className="w-6 h-6 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Verification Failed</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Result Card */}
        <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Status Banner */}
            <div className={`px-6 py-5 border-b ${
              isRevoked
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
                : isVerified
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
            }`}>
              <div className="flex items-center gap-3">
                {isRevoked ? (
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                    <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                ) : isVerified ? (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className={`text-2xl font-bold ${
                    isRevoked
                      ? "text-amber-700 dark:text-amber-300"
                      : isVerified
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-red-700 dark:text-red-300"
                  }`}>
                    {isRevoked ? "REVOKED" : isVerified ? "VERIFIED" : isTampered ? "TAMPERED" : "NOT VERIFIED"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isRevoked
                      ? `This credential was revoked${result.revokedAt ? ` on ${new Date(result.revokedAt).toLocaleDateString()}` : ""}`
                      : isTampered
                        ? "⚠ Credential data has been tampered with — hash mismatch detected"
                        : `Verified at ${new Date(result.verification.verifiedAt).toLocaleString()}`}
                  </p>
                </div>
              </div>

              {/* Revocation reason */}
              {isRevoked && result.revokedReason && (
                <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <span className="font-semibold">Reason:</span> {result.revokedReason}
                  </p>
                </div>
              )}
            </div>

            {/* Crypto checks */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-6">
                <Check label="SHA-256 Hash" ok={result.verification.hashValid} />
                <Check label="Ed25519 Signature" ok={result.verification.signatureValid} />
                <div className="ml-auto">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Issuer
                  </span>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">{result.issuerCode}</p>
                </div>
              </div>
            </div>

            {/* Minimal Safe Details — NO PII */}
            <div className="px-6 py-5">
              <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Credential Info
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Credential ID" value={result.credentialId} mono />
                <Field label="Issuer" value={result.issuerCode} />
                <Field label="Issued At" value={new Date(result.issuedAt).toLocaleDateString()} />
                <Field label="Status" value={result.status || (isRevoked ? "REVOKED" : isVerified ? "ISSUED" : "UNKNOWN")} />
                {isRevoked && result.revokedAt && (
                  <Field label="Revoked At" value={new Date(result.revokedAt).toLocaleDateString()} />
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

            {/* Employer verify link */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Employer Verification Link (login required)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}/employer/verify/${result.credentialId}` : ""}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/employer/verify/${result.credentialId}`)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 cursor-pointer whitespace-nowrap"
                >
                  Copy
                </button>
                <a
                  href={`/employer/verify/${result.credentialId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-500 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 cursor-pointer whitespace-nowrap"
                >
                  Open ↗
                </a>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      <p className={`text-sm font-medium text-slate-900 dark:text-white mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
