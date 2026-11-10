import { useEffect, useState, type FormEvent } from "react";
import api from "../../../services/api";

interface Role {
  id: number;
  role_name: string;
}

interface RoleForm {
  role_name: string;
}

type NoticeType = "success" | "error" | "warning";

interface Notice {
  type: NoticeType;
  message: string;
}

const initialForm: RoleForm = {
  role_name: "",
};

function getList<T>(response: any): T[] {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;

  return [];
}

function getFriendlyError(
  error: any,
  action: "load" | "create" | "update" | "delete",
): string {
  const status = error?.response?.status;
  const data = error?.response?.data;

  const message =
    typeof data?.message === "string" ? data.message.toLowerCase() : "";

  if (
    action === "delete" &&
    (status === 409 ||
      message.includes("role_in_use") ||
      message.includes("assigned to users") ||
      message.includes("role is assigned") ||
      message.includes("still referenced") ||
      message.includes("foreign key constraint") ||
      message.includes("constraint fails"))
  ) {
    return "This role is currently assigned to one or more users. To protect your data, please assign those users to another role before deleting it.";
  }

  if (!error?.response) {
    return "We couldn't connect to the server. Please check your connection and try again.";
  }

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You don't have permission to perform this action. Please contact your administrator if you need access.";
  }

  if (status === 404) {
    return action === "load"
      ? "We couldn't find the roles list. Please try again."
      : "This role could not be found. It may have already been removed. Please refresh the page.";
  }

  if (status === 422) {
    const errors = data?.errors;

    if (errors && typeof errors === "object") {
      const firstError = Object.values(errors).flat()[0];

      if (firstError) {
        const text = String(firstError).toLowerCase();

        if (
          text.includes("already been taken") ||
          text.includes("already exists")
        ) {
          return "A role with this name already exists. Please choose a different name.";
        }

        if (text.includes("required")) {
          return "Please enter a role name before saving.";
        }

        if (text.includes("max") || text.includes("characters")) {
          return "The role name is too long. Please use a shorter name.";
        }
      }
    }

    if (action === "delete") {
      return "This role cannot be deleted because it may still be assigned to users. Please check its user assignments.";
    }

    return "We couldn't save this role. Please check the role name and try again.";
  }

  if (status === 409) {
    return "This change conflicts with existing data. Please refresh the page and try again.";
  }

  if (status >= 500) {
    return "Something went wrong on our side. Your request couldn't be completed. Please try again later.";
  }

  switch (action) {
    case "load":
      return "We couldn't load the roles. Please try again.";
    case "create":
      return "We couldn't create this role. Please try again.";
    case "update":
      return "We couldn't update this role. Please try again.";
    case "delete":
      return "We couldn't delete this role. Please try again.";
  }
}

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${
        small ? "h-4 w-4" : "h-9 w-9"
      }`}
      aria-hidden="true"
    />
  );
}

function Notification({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const styles = {
    success: {
      wrapper: "border-emerald-200 bg-white",
      icon: "bg-emerald-100 text-emerald-700",
      title: "Success",
      symbol: "✓",
    },
    error: {
      wrapper: "border-red-200 bg-white",
      icon: "bg-red-100 text-red-700",
      title: "Something went wrong",
      symbol: "!",
    },
    warning: {
      wrapper: "border-amber-200 bg-white",
      icon: "bg-amber-100 text-amber-700",
      title: "Please check",
      symbol: "!",
    },
  };

  const style = styles[notice.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-xl border p-4 shadow-xl sm:right-6 sm:top-6 ${style.wrapper}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${style.icon}`}
      >
        {style.symbol}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{style.title}</p>
        <p className="mt-1 text-sm leading-5 text-gray-600">{notice.message}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
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

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState<RoleForm>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [modalRole, setModalRole] = useState<Role | null>(null);
  const [modalMode, setModalMode] = useState<"confirm" | "error">("confirm");
  const [modalMessage, setModalMessage] = useState("");

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
  };

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const fetchRoles = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    setLoadFailed(false);

    try {
      const response = await api.get("/roles");
      setRoles(getList<Role>(response));
    } catch (error: any) {
      setLoadFailed(true);
      showNotice("error", getFriendlyError(error, "load"));
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoles();

    // The initial request runs when the page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (role: Role) => {
    setEditingId(role.id);
    setForm({ role_name: role.role_name });
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const roleName = form.role_name.trim();

    if (!roleName) {
      showNotice("warning", "Please enter a role name before saving.");
      return;
    }

    if (saving || deletingId !== null) return;

    const isEditing = editingId !== null;
    setSaving(true);

    try {
      if (isEditing) {
        await api.put(`/roles/${editingId}`, {
          role_name: roleName,
        });
      } else {
        await api.post("/roles", {
          role_name: roleName,
        });
      }

      resetForm();

      showNotice(
        "success",
        isEditing
          ? `The role "${roleName}" has been updated successfully.`
          : `The role "${roleName}" has been created successfully.`,
      );

      await fetchRoles(false);
    } catch (error: any) {
      showNotice(
        "error",
        getFriendlyError(error, isEditing ? "update" : "create"),
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (role: Role) => {
    setModalRole(role);
    setModalMode("confirm");
    setModalMessage("");
  };

  const closeDeleteModal = () => {
    if (deletingId !== null) return;

    setModalRole(null);
    setModalMessage("");
    setModalMode("confirm");
  };

  const confirmDelete = async () => {
    if (!modalRole || deletingId !== null || saving) return;

    const role = modalRole;
    setDeletingId(role.id);

    try {
      await api.delete(`/roles/${role.id}`);

      setModalRole(null);
      setModalMessage("");
      setModalMode("confirm");

      if (editingId === role.id) resetForm();

      showNotice(
        "success",
        `The role "${role.role_name}" has been deleted successfully.`,
      );

      await fetchRoles(false);
    } catch (error: any) {
      const message = getFriendlyError(error, "delete");

      // Keep the custom modal open and explain why deletion failed.
      setModalMode("error");
      setModalMessage(message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.role_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      {/* Custom in-app notification */}
      {notice && (
        <Notification notice={notice} onClose={() => setNotice(null)} />
      )}

      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Role Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage application roles and access levels.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || loadFailed || saving || deletingId !== null}
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setForm(initialForm);
              setEditingId(null);
              setShowForm(true);
            }
          }}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition cursor-pointer hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {showForm ? "Cancel" : "+ Add Role"}
        </button>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId !== null ? "Edit Role" : "Add New Role"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {editingId !== null
                ? "Update the name of this application role."
                : "Create a role to organize application access."}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="role-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Role Name
              </label>

              <input
                id="role-name"
                type="text"
                name="role_name"
                value={form.role_name}
                onChange={(e) => setForm({ role_name: e.target.value })}
                placeholder="e.g. Administrator"
                required
                maxLength={255}
                disabled={saving}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              />

              <p className="mt-1.5 text-xs text-gray-400">
                Enter a clear name that describes the role.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
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
                disabled={saving || deletingId !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition cursor-pointer hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <Spinner small />}

                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Create Role"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Roles table */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Roles List
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {loading
                ? "Retrieving roles"
                : `${filteredRoles.length} ${
                    filteredRoles.length === 1 ? "role" : "roles"
                  } found`}
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles..."
            aria-label="Search roles"
            disabled={loading || loadFailed}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4 py-12">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
              <div className="h-2 w-2 rounded-full bg-blue-600" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">
                Loading roles
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Please wait while we retrieve your data.
              </p>
            </div>
          </div>
        ) : loadFailed ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
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

            <h3 className="text-sm font-semibold text-gray-900">
              We couldn't load your roles
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Your data hasn't been displayed. Please try again.
            </p>

            <button
              type="button"
              onClick={() => void fetchRoles()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M5.5 9a7 7 0 0 1 11.6-2L20 12M4 12l2.9 5a7 7 0 0 0 11.6-2" />
              </svg>
              Try Again
            </button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-20 px-4 py-3 font-semibold sm:px-5">#</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Role Name</th>
                  <th className="px-4 py-3 text-right font-semibold sm:px-5">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-14 text-center">
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
                        {search.trim() ? "No matching roles" : "No roles yet"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {search.trim()
                          ? "Try a different search term."
                          : "Create your first role to get started."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role, index) => (
                    <tr key={role.id} className="transition hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-4 text-gray-500 sm:px-5">
                        {index + 1}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900 sm:px-5">
                        {role.role_name}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right sm:px-5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(role)}
                            disabled={saving || deletingId !== null}
                            className="px-3 py-2 text-xs font-semibold text-blue-700 transition cursor-pointer hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                            onClick={() => openDeleteModal(role)}
                            disabled={saving || deletingId !== null}
                            className="px-3 py-2 text-xs font-semibold text-red-700 transition cursor-pointer hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Custom delete confirmation / error modal */}
      {modalRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="p-6 sm:p-7">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                  modalMode === "error"
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {modalMode === "error" ? (
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
                    <path d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3l-7.6-13.1a2 2 0 0 0-3.4 0Z" />
                  </svg>
                )}
              </div>

              <div className="mt-5 text-center">
                <h2
                  id="delete-modal-title"
                  className="text-lg font-bold text-gray-900"
                >
                  {modalMode === "error"
                    ? "Role cannot be deleted"
                    : "Delete this role?"}
                </h2>

                {modalMode === "confirm" ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      You're about to delete the role{" "}
                      <span className="font-semibold text-gray-900">
                        "{modalRole.role_name}"
                      </span>
                      .
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
                          If this role is assigned to users, it cannot be
                          deleted until those users are reassigned. This action
                          cannot be undone.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left">
                    <p className="text-sm leading-6 text-red-800">
                      {modalMessage}
                    </p>

                    <p className="mt-3 text-xs leading-5 text-red-700">
                      No further action is needed here. Close this message and
                      review the users assigned to this role.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={() => {
                  if (modalMode === "error") {
                    setModalRole(null);
                    setModalMessage("");
                    setModalMode("confirm");
                  } else {
                    closeDeleteModal();
                  }
                }}
                disabled={deletingId !== null}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {modalMode === "error" ? "Close" : "Cancel"}
              </button>

              {modalMode === "confirm" && (
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deletingId !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === modalRole.id && <Spinner small />}
                  {deletingId === modalRole.id
                    ? "Deleting..."
                    : "Yes, Delete Role"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
