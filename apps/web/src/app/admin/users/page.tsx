"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/shells";
import { PageSpinner, Spinner, Button, inputCls, selectCls, Modal, Card, Pagination, RoleBadge } from "@/components/ui";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

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

  /* ── Fetch users ────────────────────────────────────────── */
  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (roleFilter) params.set("role", roleFilter);
    params.set("page", String(page));
    params.set("limit", "15");

    try {
      const data = await apiGet<UsersPage>(`/admin/users?${params}`);
      setUsers(data);
      setError(null);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleDeactivate = async (user: User) => {
    if (!confirm(`Deactivate ${user.email}?`)) return;
    try {
      await apiDelete(`/admin/users/${user.id}`);
      fetchUsers();
    } catch { /* handled by apiDelete */ }
  };

  if (loading) return <PageSpinner />;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <AdminShell>
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchUsers(); }} className="flex-1 min-w-[220px]">
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email…" className={inputCls} />
        </form>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className={selectCls + " w-auto"}>
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="COLLEGE_ADMIN">College Admin</option>
          <option value="EMPLOYER">Employer</option>
        </select>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create User
        </Button>
      </div>

      {/* Table */}
      {users && users.data.length > 0 ? (
        <Card padding="p-0" className="overflow-hidden">
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
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800">
                <Pagination page={page} totalPages={users.totalPages} total={users.total} limit={users.limit} onPageChange={setPage} />
              </div>
            )}
        </Card>
      ) : (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
          No users found.
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchUsers(); }} />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} onUpdated={() => { setEditUser(null); fetchUsers(); }} />
      )}
    </AdminShell>
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
      await apiPost("/admin/users", body);
      onCreated();
    } catch (ex: unknown) {
      setErr(ex instanceof ApiError ? ex.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Create User">
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{err}</p>}
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="user@example.com" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Password</span>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Min 8 chars, upper+lower+digit+special" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={selectCls}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COLLEGE_ADMIN">College Admin</option>
            <option value="EMPLOYER">Employer</option>
          </select>
        </label>
        {role === "COLLEGE_ADMIN" && (
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Issuer Code</span>
            <input type="text" value={issuerCode} onChange={(e) => setIssuerCode(e.target.value)} className={inputCls} placeholder="e.g. CVR" />
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create User</Button>
        </div>
      </form>
    </Modal>
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
      await apiPatch(`/admin/users/${user.id}`, body);
      onUpdated();
    } catch (ex: unknown) {
      setErr(ex instanceof ApiError ? ex.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${user.email}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 px-3 py-2 rounded-lg">{err}</p>}
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={selectCls}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="COLLEGE_ADMIN">College Admin</option>
            <option value="EMPLOYER">Employer</option>
          </select>
        </label>
        {role === "COLLEGE_ADMIN" && (
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Issuer Code</span>
            <input type="text" value={issuerCode} onChange={(e) => setIssuerCode(e.target.value)} className={inputCls} placeholder="e.g. CVR" />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Status</span>
          <select value={active ? "true" : "false"} onChange={(e) => setActive(e.target.value === "true")} className={selectCls}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Reset Password (leave blank to keep current)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="New password (optional)" />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
