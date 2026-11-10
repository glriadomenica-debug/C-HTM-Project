import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
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

interface Notice {
  type: NoticeType;
  title: string;
  message: string;
}

const initialForm: UserForm = {
  name: "",
  email: "",
  phone_number: "",
  role_id: "",
  password: "",
  password_confirmation: "",
};

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

  const serverMessage =
    typeof data?.message === "string" ? data.message.toLowerCase() : "";

  // Network errors
  if (!error?.response) {
    return "We couldn't connect to the server. Please check your connection and try again.";
  }

  // Authentication and permission errors
  if (status === 401) {
    return "Your session may have expired. Please sign in again.";
  }

  if (status === 403) {
    return "You don't have permission to perform this action. Please contact your administrator if you need access.";
  }

  // Resource not found
  if (status === 404) {
    return action === "delete" || action === "update"
      ? "This user could not be found. The user may have already been removed. Please refresh the list."
      : "The requested information is currently unavailable. Please try again.";
  }

  // Duplicate email
  if (
    serverMessage.includes("email_in_use") ||
    serverMessage.includes("email already exists") ||
    serverMessage.includes("email has already been taken")
  ) {
    return "This email address is already registered. Please use a different email address.";
  }

  // Laravel validation errors
  const errors = data?.errors;

  if (errors && typeof errors === "object") {
    const entries = Object.entries(errors) as [string, unknown][];

    const emailError = entries.find(([key]) => key === "email");
    const passwordError = entries.find(([key]) =>
      ["password", "password_confirmation"].includes(key),
    );
    const roleError = entries.find(([key]) => key === "role_id");
    const firstError = entries
      .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
      .find((value) => typeof value === "string" && value.trim());

    if (emailError) {
      const message = String(
        Array.isArray(emailError[1]) ? emailError[1][0] : emailError[1],
      ).toLowerCase();

      if (message.includes("taken") || message.includes("already exists")) {
        return "This email address is already registered. Please use a different email address.";
      }

      return "Please check the email address and enter a valid email.";
    }

    if (passwordError) {
      return "Please check your password. It must meet the password requirements and match the confirmation.";
    }

    if (roleError) {
      return "Please select a valid role from the available options.";
    }

    if (firstError) {
      const message = String(firstError).toLowerCase();

      if (message.includes("required")) {
        return "Some required information is missing. Please complete all required fields.";
      }

      if (message.includes("unique") || message.includes("taken")) {
        return "Some information is already in use. Please check your entries and try again.";
      }

      return "Some information is invalid. Please review the form and try again.";
    }
  }

  // Common HTTP status codes
  if (status === 409) {
    return "This action conflicts with existing information. Please refresh the list and try again.";
  }

  if (status === 422) {
    if (action === "delete") {
      return "This user cannot be deleted at the moment because of a data restriction. Please contact your administrator.";
    }

    return "We couldn't save this user. Please check the information you entered and try again.";
  }

  if (status >= 500) {
    return "Something went wrong while processing your request. Please try again later.";
  }

  switch (action) {
    case "load":
      return "We couldn't load the information. Please try again.";
    case "create":
      return "We couldn't create this user. Please try again.";
    case "update":
      return "We couldn't update this user. Please try again.";
    case "delete":
      return "We couldn't delete this user. Please try again.";
  }
}

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${
        small ? "h-4 w-4" : "h-9 w-9"
      }`}
    />
  );
}

function NoticeToast({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const styles = {
    success: {
      icon: "✓",
      iconStyle: "bg-emerald-100 text-emerald-700",
      border: "border-emerald-200",
    },
    error: {
      icon: "!",
      iconStyle: "bg-red-100 text-red-700",
      border: "border-red-200",
    },
    warning: {
      icon: "!",
      iconStyle: "bg-amber-100 text-amber-700",
      border: "border-amber-200",
    },
  };

  const style = styles[notice.type];

  return (
    <div
      role={notice.type === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-xl border bg-white p-4 shadow-xl sm:right-6 sm:top-6 ${style.border}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${style.iconStyle}`}
      >
        {style.icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{notice.title}</p>
        <p className="mt-1 text-sm leading-5 text-gray-600">{notice.message}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m18 6-12 12M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
      {children}
    </p>
  );
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<UserForm>(initialForm);

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

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof UserForm, string>>
  >({});

  const showNotice = (type: NoticeType, title: string, message: string) => {
    setNotice({ type, title, message });
  };

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    setUsersLoadFailed(false);
    setRolesLoadFailed(false);

    try {
      // Load independently so one failed request does not hide
      // successfully retrieved data from the other endpoint.
      const [usersResult, rolesResult] = await Promise.allSettled([
        api.get("/users"),
        api.get("/roles"),
      ]);

      if (usersResult.status === "fulfilled") {
        setUsers(getList<User>(usersResult.value));
      } else {
        setUsersLoadFailed(true);
        showNotice(
          "error",
          "Unable to load users",
          getFriendlyError(usersResult.reason, "load"),
        );
      }

      if (rolesResult.status === "fulfilled") {
        setRoles(getList<Role>(rolesResult.value));
      } else {
        setRolesLoadFailed(true);
        showNotice(
          "error",
          "Unable to load roles",
          "We couldn't retrieve the available roles. Please try again before creating or editing a user.",
        );
      }
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();

    // Load data when the page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
    setFieldErrors({});
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  };

  const handleEdit = (user: User) => {
    setEditingId(user.id);

    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone_number: user.phone_number ?? "",
      role_id: String(user.role_id ?? user.role?.id ?? ""),
      password: "",
      password_confirmation: "",
    });

    setFieldErrors({});
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof UserForm, string>> = {};

    if (!form.name.trim()) {
      errors.name = "Please enter the user's full name.";
    }

    if (!form.email.trim()) {
      errors.email = "Please enter an email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!form.phone_number.trim()) {
      errors.phone_number = "Please enter a phone number.";
    }

    if (!form.role_id) {
      errors.role_id = "Please select a role for this user.";
    } else if (!roles.some((role) => String(role.id) === form.role_id)) {
      errors.role_id = "Please select an available role.";
    }

    if (editingId === null || form.password || form.password_confirmation) {
      if (form.password.length < 8) {
        errors.password = "Your password must contain at least 8 characters.";
      }

      if (form.password !== form.password_confirmation) {
        errors.password_confirmation = "The passwords do not match.";
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      showNotice(
        "warning",
        "Check the information",
        "Some information is missing or incorrect. Please review the highlighted fields.",
      );

      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (saving || deletingId !== null) return;

    if (rolesLoadFailed || roles.length === 0) {
      showNotice(
        "warning",
        "Role selection unavailable",
        "You need an available role to create or update a user. Please reload the roles and try again.",
      );
      return;
    }

    if (!validateForm()) return;

    const isEditing = editingId !== null;

    const payload: Record<string, string | number> = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
      role_id: Number(form.role_id),
    };

    if (!isEditing || form.password) {
      payload.password = form.password;
      payload.password_confirmation = form.password_confirmation;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await api.put(`/users/${editingId}`, payload);
      } else {
        await api.post("/users", payload);
      }

      showNotice(
        "success",
        isEditing ? "User updated successfully" : "User created successfully",
        isEditing
          ? `${form.name.trim()}'s information has been updated.`
          : `${form.name.trim()} has been added to the user list.`,
      );

      resetForm();
      await fetchData(false);
    } catch (error: any) {
      showNotice(
        "error",
        isEditing ? "Update unsuccessful" : "User not created",
        getFriendlyError(error, isEditing ? "update" : "create"),
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (user: User) => {
    setDeleteUser(user);
    setDeleteError("");
  };

  const closeDeleteModal = () => {
    if (deletingId !== null) return;

    setDeleteUser(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteUser || deletingId !== null || saving) return;

    const user = deleteUser;
    setDeletingId(user.id);
    setDeleteError("");

    try {
      await api.delete(`/users/${user.id}`);

      setDeleteUser(null);

      if (editingId === user.id) {
        resetForm();
      }

      showNotice(
        "success",
        "User deleted successfully",
        `${user.name} has been removed from the user list.`,
      );

      await fetchData(false);
    } catch (error: any) {
      setDeleteError(getFriendlyError(error, "delete"));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const keyword = search.trim().toLowerCase();

    const roleName =
      user.role?.role_name ??
      roles.find((role) => role.id === user.role_id)?.role_name ??
      "";

    return (
      user.name?.toLowerCase().includes(keyword) ||
      user.email?.toLowerCase().includes(keyword) ||
      user.phone_number?.toLowerCase().includes(keyword) ||
      roleName.toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {notice && (
        <NoticeToast notice={notice} onClose={() => setNotice(null)} />
      )}

      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            User Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users and their roles.
          </p>
        </div>

        <button
          type="button"
          disabled={
            loading ||
            usersLoadFailed ||
            rolesLoadFailed ||
            saving ||
            deletingId !== null
          }
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setForm(initialForm);
              setEditingId(null);
              setFieldErrors({});
              setShowForm(true);
            }
          }}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition cursor-pointer hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {/* Add / edit form */}
      {showForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId !== null ? "Edit User" : "Add New User"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingId !== null
                ? "Update user information and access permissions."
                : "Enter the user's details to create an account."}
            </p>
          </div>

          {rolesLoadFailed && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-700">
                !
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Roles could not be loaded
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Please reload the role list before saving this user.
                </p>
                <button
                  type="button"
                  onClick={() => void fetchData()}
                  className="mt-2 text-sm font-semibold text-amber-900 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!rolesLoadFailed && roles.length === 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">No roles available</p>
              <p className="mt-1">Create a role before adding a user.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Full name */}
              <div>
                <label
                  htmlFor="user-name"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="user-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                  maxLength={255}
                  disabled={saving}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    fieldErrors.name
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
                {fieldErrors.name && (
                  <FieldError>{fieldErrors.name}</FieldError>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="user-email"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="user-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  required
                  maxLength={255}
                  disabled={saving}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    fieldErrors.email
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
                {fieldErrors.email && (
                  <FieldError>{fieldErrors.email}</FieldError>
                )}
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="user-phone"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="user-phone"
                  type="tel"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  required
                  maxLength={15}
                  disabled={saving}
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldErrors.phone_number)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    fieldErrors.phone_number
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
                {fieldErrors.phone_number && (
                  <FieldError>{fieldErrors.phone_number}</FieldError>
                )}
              </div>

              {/* Role */}
              <div>
                <label
                  htmlFor="user-role"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="user-role"
                  name="role_id"
                  value={form.role_id}
                  onChange={handleChange}
                  required
                  disabled={saving || rolesLoadFailed || roles.length === 0}
                  aria-invalid={Boolean(fieldErrors.role_id)}
                  className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    fieldErrors.role_id
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                >
                  <option value="">
                    {rolesLoadFailed
                      ? "Unable to load roles"
                      : roles.length === 0
                        ? "No roles available"
                        : "Select a role"}
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.role_id && (
                  <FieldError>{fieldErrors.role_id}</FieldError>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="user-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  {editingId !== null ? "New Password" : "Password"}
                  {editingId === null && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <input
                  id="user-password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={
                    editingId !== null
                      ? "Leave blank to keep current password"
                      : "At least 8 characters"
                  }
                  required={editingId === null}
                  minLength={8}
                  autoComplete="new-password"
                  disabled={saving}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    fieldErrors.password
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
                {fieldErrors.password && (
                  <FieldError>{fieldErrors.password}</FieldError>
                )}
                {editingId !== null && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Leave blank if you don't want to change the password.
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="user-password-confirmation"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Confirm Password
                  {editingId === null && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <input
                  id="user-password-confirmation"
                  type="password"
                  name="password_confirmation"
                  value={form.password_confirmation}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  required={editingId === null || Boolean(form.password)}
                  minLength={8}
                  autoComplete="new-password"
                  disabled={saving}
                  aria-invalid={Boolean(fieldErrors.password_confirmation)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                    fieldErrors.password_confirmation
                      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                  }`}
                />
                {fieldErrors.password_confirmation && (
                  <FieldError>{fieldErrors.password_confirmation}</FieldError>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition cursor-pointer hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  deletingId !== null ||
                  rolesLoadFailed ||
                  roles.length === 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition cursor-pointer hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Spinner small />}
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Create User"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Users list */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Users List
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {loading
                ? "Retrieving users"
                : `${filteredUsers.length} ${
                    filteredUsers.length === 1 ? "user" : "users"
                  } found`}
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            aria-label="Search users"
            disabled={loading || usersLoadFailed}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div
            className="flex min-h-64 flex-col items-center justify-center gap-4 px-4 py-12"
            role="status"
            aria-live="polite"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
              <div className="h-2 w-2 rounded-full bg-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">
                Loading users
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Please wait while we retrieve your data.
              </p>
            </div>
          </div>
        ) : usersLoadFailed ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 8v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3l-7.6-13.1a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-900">
              We couldn't load your users
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Your user list is temporarily unavailable. Please try again.
            </p>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold sm:px-5">#</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Name</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Email</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Phone</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Role</th>
                  <th className="px-4 py-3 text-right font-semibold sm:px-5">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <path d="m16 16 4 4" />
                        </svg>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-gray-800">
                        {search.trim() ? "No matching users" : "No users yet"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {search.trim()
                          ? "Try a different search term."
                          : "Add a user to get started."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => {
                    const roleName =
                      user.role?.role_name ??
                      roles.find((role) => role.id === user.role_id)
                        ?.role_name ??
                      "-";

                    return (
                      <tr key={user.id} className="transition hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-4 text-gray-500 sm:px-5">
                          {index + 1}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900 sm:px-5">
                          {user.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-gray-600 sm:px-5">
                          {user.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-gray-600 sm:px-5">
                          {user.phone_number || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {roleName}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right sm:px-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              disabled={saving || deletingId !== null}
                              className="px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed cursor-pointer disabled:opacity-50"
                            >
                              <svg
                                className="h-7 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.8"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(user)}
                              disabled={saving || deletingId !== null}
                              className="px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed cursor-pointer disabled:opacity-50"
                            >
                              <svg
                                className="h-7 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.8"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Custom delete confirmation modal */}
      {deleteUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="p-6 sm:p-7">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                  deleteError
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {deleteError ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6m0 4h.01" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" />
                  </svg>
                )}
              </div>

              <div className="mt-5 text-center">
                <h2
                  id="delete-user-title"
                  className="text-lg font-bold text-gray-900"
                >
                  {deleteError ? "Unable to delete user" : "Delete this user?"}
                </h2>

                {deleteError ? (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-left"
                  >
                    <p className="text-sm leading-6 text-red-800">
                      {deleteError}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-red-700">
                      The user has not been confirmed as deleted. You can close
                      this message and try again later.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      Are you sure you want to remove{" "}
                      <span className="font-semibold text-gray-900">
                        {deleteUser.name}
                      </span>{" "}
                      from the user list?
                    </p>

                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
                      <div className="flex items-start gap-2.5">
                        <svg
                          viewBox="0 0 24 24"
                          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v4m0 4h.01" />
                        </svg>
                        <p className="text-xs leading-5 text-amber-900">
                          This action will remove the user account and cannot be
                          undone through this screen.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deletingId !== null}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition cursor-pointer hover:bg-gray-50 disabled:opacity-50"
              >
                {deleteError ? "Close" : "Cancel"}
              </button>

              {!deleteError && (
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deletingId !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === deleteUser.id && <Spinner small />}
                  {deletingId === deleteUser.id
                    ? "Deleting..."
                    : "Yes, Delete User"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
