"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ── Types ────────────────────────────────────────────────── */

type UserRole = "SUPER_ADMIN" | "COLLEGE_ADMIN" | "EMPLOYER";

interface User {
  id: string;
  email: string;
  role: UserRole;
  issuerCode: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsersPage {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── Page Component ───────────────────────────────────────── */

export default function UsersPage() {
  const router = useRouter();

  /* auth / role */
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  /* data */
  const [users, setUsers] = useState<UsersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* filters */
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);

  /* modals */
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

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
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  /* ── Fetch users ────────────────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (roleFilter) params.set("role", roleFilter);
    params.set("page", String(page));
    params.set("limit", "15");

    try {
      const res = await fetch(`/api/proxy/admin/users?${params}`);
      if (res.status === 403) {
        setError("Not authorized — SUPER_ADMIN only");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      const data: UsersPage = await res.json();
      setUsers(data);
      setError(null);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, page]);

  useEffect(() => {
    if (authChecked) fetchUsers();
  }, [authChecked, fetchUsers]);

  /* ── RBAC gate ──────────────────────────────────────────── */
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
        <Spinner />
      </div>
    );
  }

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
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Only Super Admins can manage users.</p>
          <button onClick={() => router.push("/admin")} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ── Handlers ───────────────────────────────────────────── */
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleCreated = () => {
    setShowCreate(false);
    fetchUsers();
  };

  const handleUpdated = () => {
    setEditUser(null);
    fetchUsers();
  };

  const handleDeactivate = async (user: User) => {
    if (!confirm(`Deactivate ${user.email}?`)) return;
    const res = await fetch(`/api/proxy/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">User Management</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              ← Dashboard
            </a>
            <a href="/admin/audit" className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors">
              Audit Trail →
            </a>
            <button onClick={handleLogout} className="text-sm font-medium text-red-500 hover:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded-full transition-colors cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[220px]">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email…"
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </form>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COLLEGE_ADMIN">College Admin</option>
            <option value="EMPLOYER">Employer</option>
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create User
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : users && users.data.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Email</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Role</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Issuer Code</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Created</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{u.email}</td>
                      <td className="px-6 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {u.issuerCode || "—"}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${u.active ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.active ? "bg-emerald-500" : "bg-red-500"}`} />
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditUser(u)}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 cursor-pointer"
                          >
                            Edit
                          </button>
                          {u.active && (
                            <button
                              onClick={() => handleDeactivate(u)}
                              className="text-xs font-medium text-red-500 hover:text-red-400 cursor-pointer"
                            >
                              Deactivate
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
            {users.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {users.total} user{users.total !== 1 ? "s" : ""} · Page {users.page} of {users.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(users.totalPages, p + 1))}
                    disabled={page >= users.totalPages}
                    className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
            No users found.
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}

/* ── Create User Modal ────────────────────────────────────── */

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("COLLEGE_ADMIN");
  const [issuerCode, setIssuerCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const body: Record<string, string> = { email, password, role };
    if (issuerCode.trim()) body.issuerCode = issuerCode.trim();

    try {
      const res = await fetch("/api/proxy/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      onCreated();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Create User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{err}</p>}
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="user@example.com" />
        </Field>
        <Field label="Password">
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Min 8 chars, upper+lower+digit+special" />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COLLEGE_ADMIN">College Admin</option>
            <option value="EMPLOYER">Employer</option>
          </select>
        </Field>
        {role === "COLLEGE_ADMIN" && (
          <Field label="Issuer Code">
            <input type="text" value={issuerCode} onChange={(e) => setIssuerCode(e.target.value)} className={inputCls} placeholder="e.g. CVR" />
          </Field>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ── Edit User Modal ──────────────────────────────────────── */

function EditUserModal({ user, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: () => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [issuerCode, setIssuerCode] = useState(user.issuerCode || "");
  const [active, setActive] = useState(user.active);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const body: Record<string, unknown> = { role, active };
    if (issuerCode.trim()) body.issuerCode = issuerCode.trim();
    else body.issuerCode = "";
    if (password.trim()) body.password = password;

    try {
      const res = await fetch(`/api/proxy/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Error ${res.status}`);
      }
      onUpdated();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Edit ${user.email}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{err}</p>}
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COLLEGE_ADMIN">College Admin</option>
            <option value="EMPLOYER">Employer</option>
          </select>
        </Field>
        {role === "COLLEGE_ADMIN" && (
          <Field label="Issuer Code">
            <input type="text" value={issuerCode} onChange={(e) => setIssuerCode(e.target.value)} className={inputCls} placeholder="e.g. CVR" />
          </Field>
        )}
        <Field label="Status">
          <select value={active ? "true" : "false"} onChange={(e) => setActive(e.target.value === "true")} className={inputCls}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <Field label="Reset Password (leave blank to keep current)">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="New password (optional)" />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ── Shared UI Components ─────────────────────────────────── */

const inputCls = "w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    SUPER_ADMIN: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400",
    COLLEGE_ADMIN: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
    EMPLOYER: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  };
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    COLLEGE_ADMIN: "College Admin",
    EMPLOYER: "Employer",
  };
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[role]}`}>
      {labels[role]}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-3 text-slate-500">
      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading…
    </div>
  );
}
