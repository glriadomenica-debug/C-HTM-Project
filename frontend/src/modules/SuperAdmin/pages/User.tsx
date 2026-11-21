import { useCallback, useEffect, useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import api from "../../../services/api";

interface Role {
  id: number;
  role_name: string;
}
interface User {
  id: number;
  name: string;
  email: string;
  phone_number: string;
  role_id: number;
  role?: Role;
}
interface UserForm {
  name: string;
  email: string;
  phone_number: string;
  role_id: string;
  password: string;
  password_confirmation: string;
}
type NoticeType = "success" | "error" | "warning";
type ActionType = "load" | "create" | "update" | "delete";
interface Notice { type: NoticeType; title: string; message: string; }

const emptyForm: UserForm = {
  name: "", email: "", phone_number: "", role_id: "", password: "", password_confirmation: "",
};
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
  const serverMessage = typeof data?.message === "string" ? data.message.toLowerCase() : "";
  if (!error?.response) return "Labele konekta ba servidor. Favor verifika ita-nia koneksaun no koko fila-fali..";
  if (status === 401) return "Ita-nia sesaun remata ona. Favor login fila-fali.";
  if (status === 403) return "Ita la iha permisaun atu halo asaun ida-ne'e. Favor kontaktu Admin se ita presiza asesu.";
  if (status === 404) return action === "delete" || action === "update" ? "La hetan utilizador ida-ne'e. Favor atualiza lista." : "Informasaun ne'ebe ita husu agora ne'e la disponivel. Favor koko fila-fali.";
  if (serverMessage.includes("email_in_use") || serverMessage.includes("email already exists") || serverMessage.includes("email has already been taken")) {
    return "Email address ida-ne'e rejista ona. Favor uza email address seluk.";
  }

  const errors = data?.errors;
  if (errors && typeof errors === "object") {
    const entries = Object.entries(errors) as [string, unknown][];
    const emailError = entries.find(([key]) => key === "email");
    const passwordError = entries.find(([key]) => ["password", "password_confirmation"].includes(key));
    const roleError = entries.find(([key]) => key === "role_id");
    const firstError = entries.flatMap(([, value]) => Array.isArray(value) ? value : [value]).find((v) => typeof v === "string" && v.trim());
    if (emailError) {
      const message = String(Array.isArray(emailError[1]) ? emailError[1][0] : emailError[1]).toLowerCase();
      return message.includes("taken") || message.includes("already exists") ? "Email address ida-ne'e rejista ona. Favor uza  email address seluk." : "Favor verifika email address no hatama email ne'ebe valida";
    }
    if (passwordError) return "Favor verifika ita-nia password. Tenki kontein karakter minumu 8 no hanesan ho konfirma password.";
    if (roleError) return "Favor hili role ne'e iha ona.";
    if (firstError) return String(firstError).toLowerCase().includes("required") ? "Informasaun balun falta. Favor kompleta field obrigatoriu hotu-hotu." : "Informasaun balun la validu. Favor hare fila-fali dadus ne'ebe prenxe no koko fali.";  
  }

    if (status === 409) return "Asaun ida-ne'e iha konflitu ho informasaun ezistente. Favór atualiza lista no koko fali.";
    if (status === 422) return action === "delete" ? "Labele hamoos utilizadór ida-ne'e tanba iha restrisaun ba dadus." : "Labele rai informasaun utilizadór nian. Favór verifika informasaun ne'ebé ita hatama.";
    if (status >= 500) return "Iha erru durante prosesu ita-nia pedidu. Favór koko fali.";
    return ({
      load: "Labele karrega informasaun. Favór koko fali.",
      create: "Labele kria utilizadór ida-ne'e. Favór koko fali.",
      update: "Labele atualiza utilizadór ida-ne'e. Favór koko fali.",
      delete: "Labele hamoos utilizadór ida-ne'e. Favór koko fali."
    })[action];

}
function Icon({ name }: { name: string }) {
  const common = { className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 1.8, viewBox: "0 0 24 24", "aria-hidden": true as const };
  switch (name) {
    case "plus": return <svg {...common}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>;
    case "search": return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path strokeLinecap="round" strokeLinejoin="round" d="m16 16 4 4" /></svg>;
    case "edit": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" /></svg>;
    case "trash": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6" /></svg>;
    case "refresh": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></svg>;
    case "users": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "check": return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg>;
  }
}
// function SummaryCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: "blue" | "green" | "purple" }) {
//   const colors = {
//     blue: "bg-blue-50 text-blue-700 ring-blue-100",
//     green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
//     purple: "bg-purple-50 text-purple-700 ring-purple-100",
//   };
//   return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
//     <div className="flex items-center justify-between gap-3">
//       <p className="text-sm font-medium text-slate-500">{title}</p>
//       <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${colors[color]}`}><Icon name={icon} /></span>
//     </div>
//     <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
//   </div>;
// }
function RoleBadge({ role }: { role: string }) {
  return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700 ring-1 ring-inset ring-blue-100">{role || "Unassigned"}</span>;
}
function NoticeToast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const style = notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : notice.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800";
  return <div role={notice.type === "error" ? "alert" : "status"} aria-live="polite" className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-xl border bg-white p-4 shadow-xl ${style}`}>
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 font-bold">{notice.type === "success" ? "✓" : "!"}</span>
    <div className="min-w-0 flex-1"><p className="text-sm font-bold">{notice.title}</p><p className="mt-1 text-sm leading-5">{notice.message}</p></div>
    <button type="button" onClick={onClose} aria-label="Close notification" className="rounded-lg px-2 text-lg opacity-60 hover:bg-black/5">×</button>
  </div>;
}
function FieldError({ children }: { children: string }) {
  return <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{children}</p>;
}
function MobileField({ label, value }: { label: string; value?: string | null }) {
  return <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-700">{value || "-"}</p></div>;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersLoadFailed, setUsersLoadFailed] = useState(false);
  const [rolesLoadFailed, setRolesLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof UserForm, string>>>({});

  const showNotice = (type: NoticeType, title: string, message: string) => setNotice({ type, title, message });
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const fetchData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setUsersLoadFailed(false);
    setRolesLoadFailed(false);
    try {
      const [usersResult, rolesResult] = await Promise.allSettled([api.get("/users"), api.get("/roles")]);
      if (usersResult.status === "fulfilled") setUsers(getList<User>(usersResult.value));
      else {
        setUsersLoadFailed(true);
        showNotice("error", "Unable to load users", getFriendlyError(usersResult.reason, "load"));
      }
      if (rolesResult.status === "fulfilled") setRoles(getList<Role>(rolesResult.value));
      else {
        setRolesLoadFailed(true);
        showNotice("error", "Unable to load roles", "We couldn't retrieve the available roles. Please try again before creating or editing a user.");
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      const roleName = user.role?.role_name ?? roles.find((role) => role.id === user.role_id)?.role_name ?? "";
      return !keyword || [user.name, user.email, user.phone_number, roleName].some((value) => String(value ?? "").toLowerCase().includes(keyword));
    });
  }, [users, roles, search]);
  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); setFieldErrors({}); };
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => ({ ...previous, [name]: undefined }));
  };
  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setForm({ name: user.name ?? "", email: user.email ?? "", phone_number: user.phone_number ?? "", role_id: String(user.role_id ?? user.role?.id ?? ""), password: "", password_confirmation: "" });
    setFieldErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const validateForm = () => {
    const errors: Partial<Record<keyof UserForm, string>> = {};
    if (!form.name.trim()) errors.name = "Please enter the user's full name.";
    if (!form.email.trim()) errors.email = "Please enter an email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Please enter a valid email address.";
    if (!form.phone_number.trim()) errors.phone_number = "Please enter a phone number.";
    if (!form.role_id) errors.role_id = "Please select a role for this user.";
    else if (!roles.some((role) => String(role.id) === form.role_id)) errors.role_id = "Please select an available role.";
    if (editingId === null || form.password || form.password_confirmation) {
      if (form.password.length < 8) errors.password = "Your password must contain at least 8 characters.";
      if (form.password !== form.password_confirmation) errors.password_confirmation = "The passwords do not match.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      showNotice("warning", "Check the information", "Some information is missing or incorrect. Please review the highlighted fields.");
      return false;
    }
    return true;
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || deletingId !== null) return;
    if (rolesLoadFailed || roles.length === 0) {
      showNotice("warning", "Role selection unavailable", "You need an available role to create or update a user. Please reload the roles and try again.");
      return;
    }
    if (!validateForm()) return;
    const isEditing = editingId !== null;
    const payload: Record<string, string | number> = { name: form.name.trim(), email: form.email.trim(), phone_number: form.phone_number.trim(), role_id: Number(form.role_id) };
    if (!isEditing || form.password) {
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }
    setSaving(true);
    try {
      if (isEditing) await api.put(`/users/${editingId}`, payload);
      else await api.post("/users", payload);
      showNotice("success", isEditing ? "Utilizador hadia ho susesu" : "Utiliza kria ho susesu", isEditing ? `${form.name.trim()}'s informasaun utilizador atualiza ho susesu.` : 
      `${form.name.trim()} rai ona iha lista utilizador.`);
      resetForm();
      await fetchData(false);
    } catch (error: any) {
      showNotice("error", isEditing ? "Atualizasaun la susesu" : "Utilizado seidauk kria", getFriendlyError(error, isEditing ? "update" : "create"));
    } finally { setSaving(false); }
  };
  const openDeleteModal = (user: User) => { setDeleteUser(user); setDeleteError(""); };
  const closeDeleteModal = () => { if (deletingId !== null) return; setDeleteUser(null); setDeleteError(""); };
  const confirmDelete = async () => {
    if (!deleteUser || deletingId !== null || saving) return;
    const user = deleteUser;
    setDeletingId(user.id);
    setDeleteError("");
    try {
      await api.delete(`/users/${user.id}`);
      setDeleteUser(null);
      if (editingId === user.id) resetForm();
      showNotice("success", "Utilizador hamoos ho susesu", `${user.name} hamoos ona husi lista utilizador.`);
      await fetchData(false);
    } catch (error: any) {
      setDeleteError(getFriendlyError(error, "delete"));
    } finally { setDeletingId(null); }
  };
  const roleFor = (user: User) => user.role?.role_name ?? roles.find((role) => role.id === user.role_id)?.role_name ?? "-";

  return <div className="min-h-full space-y-5 bg-slate-50/80 p-3 sm:space-y-6 sm:p-5 lg:p-6">
    {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">C-HTM / User Management</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dadus Utilizador</h1>
      </div>

      <button type="button" disabled={loading || usersLoadFailed || rolesLoadFailed || saving || deletingId !== null}
        onClick={() => showForm ? resetForm() : (setForm(emptyForm), setEditingId(null), setFieldErrors({}), setShowForm(true))}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed cursor-pointer disabled:opacity-50">
        <Icon name="plus" /> {showForm ? "Kansela" : "Aumenta Utilizador"}
      </button>
    </header>

    {showForm && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5"><h2 className="text-lg font-bold text-slate-900">{editingId !== null ? "Hadia dadus utilizador" : "Aumenta dadus utilizador"}</h2>
      <p className="mt-1 text-sm text-slate-500">{editingId !== null ? "Atualiza dadus utilizador no permisaun asesu." : "Hatama informasaun detallu hodi kria utilizador foun."}</p></div>
      {rolesLoadFailed && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Dadus role la hetan. <button type="button" onClick={() => void fetchData()} className="font-semibold underline">Try again</button></div>}
      
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="user-name">Naran Utilizador <span className="text-red-500">*</span>
            </label>
            <input id="user-name" name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" maxLength={255} disabled={saving} className={inputClass} aria-invalid={!!fieldErrors.name} />
            {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-email">Email Address <span className="text-red-500">*</span>
            </label>
            <input id="user-email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" 
              maxLength={255} autoComplete="email" disabled={saving} className={inputClass} aria-invalid={!!fieldErrors.email} />
              {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-phone">Numeru telfone <span className="text-red-500">*</span>
            </label>
            <input id="user-phone" type="tel" name="phone_number" value={form.phone_number} onChange={handleChange} 
            placeholder="Enter phone number" maxLength={15} autoComplete="tel" disabled={saving} className={inputClass} aria-invalid={!!fieldErrors.phone_number} />
            {fieldErrors.phone_number && <FieldError>{fieldErrors.phone_number}</FieldError>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-role">Role <span className="text-red-500">*</span></label>
            <select id="user-role" name="role_id" value={form.role_id} onChange={handleChange} disabled={saving || rolesLoadFailed || roles.length === 0} 
              className={inputClass} aria-invalid={!!fieldErrors.role_id}>
                <option value="">{rolesLoadFailed ? "Unable to load roles" : roles.length ? "Hili role" : "Dadus role seidauk iha."}</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}
                </option>)}
            </select>
            {fieldErrors.role_id && <FieldError>{fieldErrors.role_id}</FieldError>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-password">{editingId !== null ? "Password foun" : "Password"} 
              {editingId === null && <span className="text-red-500">*</span>}</label>

            <input id="user-password" type="password" name="password" value={form.password} onChange={handleChange} 
              placeholder={editingId !== null ? "Husik mamuk, se hakarak mantein password atual" : "Tenki iha karakter pelumenus 8"} 
              minLength={8} autoComplete="new-password" disabled={saving} className={inputClass} aria-invalid={!!fieldErrors.password} />
              {fieldErrors.password && <FieldError>{fieldErrors.password}</FieldError>}{editingId !== null && 
              <p className="mt-1 text-xs text-slate-500">Husik mamuk, se ita la hakarak atu troka password
              </p>}
          </div>

          <div>
            <label className={labelClass} htmlFor="user-password-confirmation">
              Konfirma Password {editingId === null && <span className="text-red-500">*</span>}
            </label>
            
            <input id="user-password-confirmation" type="password"
              name="password_confirmation" value={form.password_confirmation} onChange={handleChange} placeholder="Hatama fila-fali password" minLength={8} 
              autoComplete="new-password" disabled={saving} className={inputClass} aria-invalid={!!fieldErrors.password_confirmation} />
              {fieldErrors.password_confirmation && <FieldError>{fieldErrors.password_confirmation}</FieldError>}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={resetForm} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
            Kansela</button>
          <button type="submit" disabled={saving || deletingId !== null || rolesLoadFailed || roles.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold 
            text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">{saving && 
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{saving ? "Saving..." : editingId !== null ? "Atualiza dadus" : "Rai dadus"}</button>
        </div>
      </form>
    </section>}

    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white p-4 sm:p-5 print:hidden">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold tracking-tight text-slate-900">Lista Utilizador</h2></div>
          
          </div>
          <div className="relative w-full sm:w-72"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><Icon name="search" /></span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users..." aria-label="Search users" disabled={loading || usersLoadFailed} className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></div>
        </div>
        
      </div>

      {loading ? <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4 py-12" role="status"><span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="text-sm font-medium text-slate-700">Loading dadus utilizador...</p></div>
      : usersLoadFailed ? <div className="flex min-h-56 flex-col items-center justify-center px-4 py-10 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><Icon name="warning" /></div><h3 className="mt-3 text-sm font-semibold text-slate-900">Labela karrega lista utilizador sira</h3><p className="mt-1 max-w-sm text-sm text-slate-500">Ita-nia lista utilizador agora la disponivel hela. Favor koko fila-fali.</p><button type="button" onClick={() => void fetchData()} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Try Again</button></div>
      : filteredUsers.length === 0 ? <div className="px-4 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon name="users" /></div><h3 className="mt-4 font-semibold text-slate-900">{search.trim() ? "La iha dadus utilizadór ne'ebé koresponde" : "Seidauk iha utilizadór ne'ebé rejista"}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {search.trim() ? "La iha utilizador ne'ebe korresponde ba ita-nia buka. Koko naran, email, numeru telfone ka role.." : "Aumenta utilizadór ida atu hahú jere asesu ba sistema."}</p>{search.trim() && <button type="button" onClick={() => setSearch("")} className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Fila ba inisiu</button>}</div>
      : <>
        <div className="divide-y divide-slate-100 md:hidden print:hidden">
          {filteredUsers.map((user, index) => <article key={user.id} className="p-4 transition hover:bg-blue-50/40">
            <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base font-bold text-blue-700">{user.name?.trim().charAt(0).toUpperCase() || "U"}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{user.name || "-"}</h3><p className="mt-1 break-all text-xs text-slate-500">{user.email || "-"}</p></div><RoleBadge role={roleFor(user)} /></div></div></div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-slate-50 p-3"><MobileField label="Phone number" value={user.phone_number} /><MobileField label="Role" value={roleFor(user)} /></div>
            <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">Record {index + 1}</span><div className="flex items-center gap-2"><button type="button" onClick={() => handleEdit(user)} disabled={saving || deletingId !== null} aria-label={`Edit ${user.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Icon name="edit" /> Edit</button><button type="button" onClick={() => openDeleteModal(user)} disabled={saving || deletingId !== null} aria-label={`Delete ${user.name}`} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Icon name="trash" /> Delete</button></div></div>
          </article>)}
        </div>
        <div className="hidden w-full overflow-x-auto md:block">
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="bg-slate-800 text-xs uppercase tracking-wider text-slate-100">
              <tr>
                <th className="w-16 whitespace-nowrap px-4 py-4 text-center font-semibold">No.</th>
                <th className="min-w-56 px-4 py-4 font-semibold">User Details</th>
                <th className="min-w-64 px-4 py-4 font-semibold">Email Address</th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">Phone Number</th>
                <th className="whitespace-nowrap px-4 py-4 font-semibold">Role</th>
                <th className="sticky right-0 z-10 whitespace-nowrap bg-slate-800 px-4 py-4 text-center font-semibold">
                  Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user, index) => 
              <tr key={user.id} className="group transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50">
                <td className="px-4 py-4 text-center tabular-nums text-slate-400">{index + 1}</td>
                <td className="px-4 py-4"><div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">{user.name?.trim().charAt(0).toUpperCase() || "U"}</div>
                  <div className="min-w-0"><p className="break-words font-semibold text-slate-900">{user.name || "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">Konta Utilizador</p>
                  </div>
                  </div>
                </td>
                <td className="break-all px-4 py-4 text-slate-600">{user.email || "-"}</td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600">{user.phone_number || "-"}</td>
                <td className="whitespace-nowrap px-4 py-4"><RoleBadge role={roleFor(user)} /></td>
                <td className="sticky right-0 bg-white/95 px-3 py-4 text-center shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)] group-hover:bg-blue-50 print:hidden">
                <div className="flex items-center justify-center gap-1">
                  <button type="button" onClick={() => handleEdit(user)} disabled={saving || deletingId !== null} title="Hadia Utilizador" aria-label={`Edit ${user.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 transition hover:border-blue-300 hover:bg-blue-600 cursor-pointer hover:text-white disabled:opacity-50 curso-pointer">
                    <Icon name="edit" />
                  </button>
                  <button type="button" onClick={() => openDeleteModal(user)} disabled={saving || deletingId !== null} title="Hamoos Utilizador" aria-label={`Delete ${user.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-600 hover:text-white disabled:opacity-50 cursor-pointer">
                    <Icon name="trash" />
                  </button>
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}

      <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between print:hidden"><p>Showing <strong className="text-slate-800">{filteredUsers.length}</strong> of <strong className="text-slate-800">{users.length}</strong> Utilizador</p><button type="button" onClick={() => void fetchData()} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"><Icon name="refresh" /> Refresh lista</button></footer>
    </section>

    {deleteUser && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteModal(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="p-6 sm:p-7"><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${deleteError ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
          <Icon name={deleteError ? "warning" : "trash"} />
        </div>
        <div className="mt-5 text-center">
          <h2 id="delete-user-title" className="text-lg font-bold text-slate-900">{deleteError ? "Labele atu hamoos utilizador ne'e!" : "Hamoos dadus utilizador ne'e?"}</h2>
          {deleteError ? 
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm leading-6 text-red-800">{deleteError}
          </div> : <><p className="mt-2 text-sm leading-6 text-slate-500">
            Ita hakarak atu hamoos dadus <strong className="text-slate-900">{deleteUser.name}</strong> husi lista utilizador?</p>
            
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">
              Aksaun ida-ne'e sei hamoos utilizadór nee no labele kansela ka fila-fali liuhusi pájina ida-ne'e.            </div></>
          }</div></div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={closeDeleteModal} disabled={deletingId !== null} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 
          disabled:opacity-50 cursor-pointer">{deleteError ? "Taka" : "Kansela"}
        </button>
        {!deleteError && 
        
        <button type="button" onClick={() => void confirmDelete()} disabled={deletingId !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer">
          {deletingId === deleteUser.id && 
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          }{deletingId === deleteUser.id ? "Hamoos..." : "Konfirma"}</button>}</div>
      </section>
    </div>}
  </div>;
}
