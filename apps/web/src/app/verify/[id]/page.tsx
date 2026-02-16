"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Legacy public verify route — DISABLED.
 * All verification now requires EMPLOYER authentication.
 * Redirects to /employer/verify/[id] which will prompt login if unauthenticated.
 */
export default function PublicVerifyRedirect() {
  const params = useParams();
  const router = useRouter();
  const credentialId = params.id as string;

  useEffect(() => {
    if (credentialId) {
      router.replace(`/employer/verify/${credentialId}`);
    } else {
      router.replace("/login");
    }
  }, [credentialId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3 text-slate-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Redirecting to employer verification…
        </div>
        <p className="text-xs text-slate-400">Public verification has been disabled. Employer login is required.</p>
      </div>
    </div>
  );
}
