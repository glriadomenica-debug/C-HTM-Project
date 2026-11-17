import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import api from "../../../services/api";

interface Role {
  id: number;
  role_name: string;
}
type NoticeType = "success" | "error" | "warning";
type ActionType = "load" | "create" | "update" | "delete";
interface Notice {
  type: NoticeType;
  title: string;
  message: string;
}
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";
const labelClass = "block text-sm font-semibold text-slate-700";

function getList<T>(response: any): T[] {
  const body = response?.data;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  return [];
}
function getFriendlyError(error: any, action: ActionType): string {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const message = typeof data?.message === "string" ? data.message.toLowerCase() : "";
  if (action === "delete" && (status === 409 || message.includes("role_in_use") || message.includes("assigned to users") || message.includes("role is assigned") || message.includes("still referenced") || message.includes("foreign key constraint") || message.includes("constraint fails"))) {
    return "This role is assigned to one or more users. Reassign those users to another role before deleting it.";
  }
  if (!error?.response) return "We couldn't connect to the server. Please check your connection and try again.";
  if (status === 401) return "Your session may have expired. Please sign in again.";
  if (status === 403) return "You don't have permission to perform this action. Please contact your administrator.";
  if (status === 404) return action === "load" ? "We couldn't find the roles list. Please try again." : "This role could not be found. Please refresh the page.";
  const errors = data?.errors;
  if (errors && typeof errors === "object") {
    const entries = Object.values(errors).flat();
    const first = entries.find((value) => typeof value === "string");
    if (first) {
      const text = String(first).toLowerCase();
      if (text.includes("taken") || text.includes("already exists")) return "A role with this name already exists. Please choose a different name.";
      if (text.includes("required")) return "Please enter a role name before saving.";
      if (text.includes("max") || text.includes("characters")) return "The role name is too long. Please use a shorter name.";
    }
  }
  if (message.includes("already exists") || message.includes("role_name") && message.includes("unique")) return "A role with this name already exists. Please choose a different name.";
  if (status === 422) return action === "delete" ? "This role cannot be deleted because it may still be assigned to users." : "We couldn't save this role. Please check the role name and try again.";
  if (status === 409) return "This change conflicts with existing data. Please refresh the page and try again.";
  if (status >= 500) return "Something went wrong while processing your request. Please try again later.";
  return ({ load: "We couldn't load the roles. Please try again.", create: "We couldn't create this role. Please try again.", update: "We couldn't update this role. Please try again.", delete: "We couldn't delete this role. Please try again." })[action];
}
function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, viewBox: "0 0 24 24", "aria-hidden": true as const };
  switch (name) {
    case "plus": return <svg {...common}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>;
    case "search": return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path strokeLinecap="round" strokeLinejoin="round" d="m16 16 4 4" /></svg>;
    case "edit": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" /></svg>;
    case "trash": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6" /></svg>;
    case "refresh": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></svg>;
    case "shield": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" /></svg>;
    case "close": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="m18 6-12 12M6 6l12 12" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg>;
  }
}
function SummaryCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: "blue" | "green" | "purple" }) {
  const colors = { blue: "bg-blue-50 text-blue-700 ring-blue-100", green: "bg-emerald-50 text-emerald-700 ring-emerald-100", purple: "bg-purple-50 text-purple-700 ring-purple-100" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{title}</p><span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${colors[color]}`}><Icon name={icon} /></span></div>
    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
  </div>;
}
function NoticeToast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const style = notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : notice.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800";
  return <div role="status" aria-live="polite" className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-2xl border p-4 shadow-xl ${style}`}>
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 font-bold">{notice.type === "success" ? "✓" : "!"}</span>
    <div className="min-w-0 flex-1"><p className="text-sm font-bold">{notice.title}</p><p className="mt-1 text-sm leading-5">{notice.message}</p></div>
    <button type="button" aria-label="Dismiss notification" onClick={onClose} className="rounded-lg p-1 opacity-70 hover:bg-white/70"><Icon name="close" className="h-4 w-4" /></button>
  </div>;
}
function Spinner() { return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />; }

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleName, setRoleName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const showNotice = useCallback((type: NoticeType, title: string, message: string) => setNotice({ type, title, message }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const fetchRoles = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setLoadFailed(false);
    try {
      const response = await api.get("/roles");
      setRoles(getList<Role>(response));
    } catch (error: any) {
      setLoadFailed(true);
      showNotice("error", "Unable to load roles", getFriendlyError(error, "load"));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => { void fetchRoles(); }, [fetchRoles]);

  const resetForm = () => { setRoleName(""); setEditingId(null); setShowForm(false); };
  const handleEdit = (role: Role) => {
    setEditingId(role.id);
    setRoleName(role.role_name);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = roleName.trim();
    if (!name) { showNotice("warning", "Role name required", "Please enter a role name before saving."); return; }
    if (saving || deletingId !== null) return;
    const editing = editingId !== null;
    setSaving(true);
    try {
      if (editing) await api.put(`/roles/${editingId}`, { role_name: name });
      else await api.post("/roles", { role_name: name });
      resetForm();
      showNotice("success", editing ? "Role updated" : "Role created", `The role "${name}" has been ${editing ? "updated" : "created"} successfully.`);
      await fetchRoles(false);
    } catch (error: any) {
      showNotice("error", editing ? "Unable to update role" : "Unable to create role", getFriendlyError(error, editing ? "update" : "create"));
    } finally { setSaving(false); }
  };
  const confirmDelete = async () => {
    if (!deleteRole || deletingId !== null || saving) return;
    const role = deleteRole;
    setDeletingId(role.id);
    setDeleteError("");
    try {
      await api.delete(`/roles/${role.id}`);
      setDeleteRole(null);
      if (editingId === role.id) resetForm();
      showNotice("success", "Role deleted", `The role "${role.role_name}" has been deleted successfully.`);
      await fetchRoles(false);
    } catch (error: any) {
      setDeleteError(getFriendlyError(error, "delete"));
    } finally { setDeletingId(null); }
  };

  const filteredRoles = useMemo(() => roles.filter((role) => role.role_name.toLowerCase().includes(search.trim().toLowerCase())), [roles, search]);
  const canInteract = !saving && deletingId === null;

  return <div className="min-w-0 space-y-5 sm:space-y-6">
    {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">C-HTM / Administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Role Management</h1>
      </div>
      <button type="button" disabled={loading || loadFailed || !canInteract} onClick={() => { if (showForm) resetForm(); else { setRoleName(""); setEditingId(null); setShowForm(true); } }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Icon name="plus" />{showForm ? "Cancel" : "Add Role"}</button>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      <SummaryCard title="Total Roles" value={roles.length} icon="shield" color="blue" />
      <SummaryCard title="Roles Shown" value={filteredRoles.length} icon="search" color="green" />
      <SummaryCard title="Role Names" value={new Set(roles.map((role) => role.role_name.trim().toLowerCase())).size} icon="check" color="purple" />
    </div>

    {showForm && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5"><h2 className="text-lg font-bold text-slate-900">{editingId !== null ? "Edit Role" : "Add New Role"}</h2><p className="mt-1 text-sm text-slate-500">{editingId !== null ? "Update the name for this application role." : "Enter a clear name for the new application role."}</p></div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1"><label htmlFor="role_name" className={labelClass}>Role Name <span className="text-red-500">*</span></label><input id="role_name" name="role_name" type="text" value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="e.g. Manager" maxLength={255} required disabled={saving} autoFocus className={inputClass} /><p className="mt-1.5 text-xs text-slate-400">Use a name that clearly describes the role.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={resetForm} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!canInteract} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving && <Spinner />}{saving ? "Saving..." : editingId !== null ? "Save Changes" : "Create Role"}</button></div>
      </form>
    </section>}

    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="text-base font-bold text-slate-900">Roles List</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading role records..." : `${filteredRoles.length} ${filteredRoles.length === 1 ? "role" : "roles"} found`}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><div className="relative w-full sm:w-64"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" className="h-4 w-4" /></span><input type="search" aria-label="Search roles" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search role name..." disabled={loading || loadFailed} className={`${inputClass} mt-0 pl-9`} /></div><button type="button" onClick={() => void fetchRoles()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><Icon name="refresh" className="h-4 w-4" />Refresh</button></div>
      </div>
      {loading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8"><span className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="text-sm font-medium text-slate-600">Loading roles...</p></div> : loadFailed ? <div className="flex min-h-60 flex-col items-center justify-center p-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Icon name="alert" className="h-6 w-6" /></span><h3 className="mt-3 font-bold text-slate-900">We couldn't load your roles</h3><p className="mt-1 max-w-sm text-sm text-slate-500">Your data has not been displayed. Please try again.</p><button type="button" onClick={() => void fetchRoles()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Try Again</button></div> : filteredRoles.length === 0 ? <div className="flex min-h-60 flex-col items-center justify-center p-8 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon name="search" className="h-6 w-6" /></span><h3 className="mt-3 font-bold text-slate-900">{search.trim() ? "No matching roles" : "No roles yet"}</h3><p className="mt-1 text-sm text-slate-500">{search.trim() ? "Try a different search term." : "Create your first role to get started."}</p>{!search.trim() && <button type="button" onClick={() => { setShowForm(true); setRoleName(""); }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" />Add Role</button>}</div> : <div className="w-full overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-20 px-4 py-3.5 font-bold sm:px-5">No.</th><th className="px-4 py-3.5 font-bold sm:px-5">Role Name</th><th className="w-40 px-4 py-3.5 text-right font-bold sm:px-5">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRoles.map((role, index) => <tr key={role.id} className="transition hover:bg-slate-50/80"><td className="whitespace-nowrap px-4 py-4 text-slate-500 sm:px-5">{index + 1}</td><td className="px-4 py-4 sm:px-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name="shield" /></span><div><p className="font-semibold capitalize text-slate-900">{role.role_name}</p><p className="mt-0.5 text-xs text-slate-500">Application role</p></div></div></td><td className="whitespace-nowrap px-4 py-4 sm:px-5"><div className="flex justify-end gap-2"><button type="button" title="Edit role" aria-label={`Edit ${role.role_name}`} onClick={() => handleEdit(role)} disabled={!canInteract} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"><Icon name="edit" className="h-4 w-4" /><span>Edit</span></button><button type="button" title="Delete role" aria-label={`Delete ${role.role_name}`} onClick={() => { setDeleteRole(role); setDeleteError(""); }} disabled={!canInteract} className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"><Icon name="trash" className="h-4 w-4" /><span>Delete</span></button></div></td></tr>)}</tbody></table></div>}
    </section>

    {deleteRole && <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && deletingId === null) { setDeleteRole(null); setDeleteError(""); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="delete-role-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="p-6 sm:p-7"><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${deleteError ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}><Icon name={deleteError ? "alert" : "trash"} className="h-7 w-7" /></div><div className="mt-5 text-center"><h2 id="delete-role-title" className="text-lg font-bold text-slate-900">{deleteError ? "Role cannot be deleted" : "Delete this role?"}</h2>{deleteError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left"><p className="text-sm leading-6 text-red-800">{deleteError}</p><p className="mt-2 text-xs leading-5 text-red-700">Close this message and review the users assigned to this role.</p></div> : <><p className="mt-2 text-sm leading-6 text-slate-500">You're about to delete the role <strong className="text-slate-900">"{deleteRole.role_name}"</strong>.</p><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left"><p className="text-xs leading-5 text-amber-900">If this role is assigned to users, it cannot be deleted until those users are reassigned. This action cannot be undone.</p></div></>}</div></div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end sm:px-7"><button type="button" onClick={() => { if (deletingId !== null) return; setDeleteRole(null); setDeleteError(""); }} disabled={deletingId !== null} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{deleteError ? "Close" : "Cancel"}</button>{!deleteError && <button type="button" onClick={() => void confirmDelete()} disabled={deletingId !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">{deletingId === deleteRole.id && <Spinner />}{deletingId === deleteRole.id ? "Deleting..." : "Yes, Delete Role"}</button>}</div>
      </section>
    </div>}
  </div>;
}
