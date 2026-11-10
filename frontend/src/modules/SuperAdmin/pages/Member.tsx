import { useCallback, useEffect, useState, type FormEvent } from "react";
import api from "../../../services/api";

type Gender = "Male" | "Female";
type MembershipStatus = "Active" | "Inactive";
type ModalType = "success" | "error" | "confirm";

interface Member {
  id: number;
  member_number: string;
  full_name: string;
  gender: Gender;
  id_card_number: string;
  phone_number: string;
  address: string;
  employer: string;
  work_location: string;
  membership_status: MembershipStatus;
  deposits_count?: number;
  loans_count?: number;
  deposits?: unknown[];
  loans?: unknown[];
}

interface MemberForm {
  member_number: string;
  full_name: string;
  gender: Gender;
  id_card_number: string;
  phone_number: string;
  address: string;
  employer: string;
  work_location: string;
  membership_status: MembershipStatus;
}

const emptyForm: MemberForm = {
  member_number: "",
  full_name: "",
  gender: "Male",
  id_card_number: "",
  phone_number: "",
  address: "",
  employer: "",
  work_location: "",
  membership_status: "Active",
};

function getErrorMessage(error: any): string {
  const response = error?.response?.data;
  const errors = response?.errors ?? response?.data;

  if (errors && typeof errors === "object") {
    const firstError = Object.values(errors).flat()[0];

    if (typeof firstError === "string") {
      return firstError;
    }
  }

  return (
    response?.message ||
    error?.message ||
    "An unexpected error occurred. Please try again."
  );
}

function getResponseData<T>(response: any): T | null {
  const payload = response?.data;

  if (Array.isArray(payload)) {
    return payload as T;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data as T;
  }

  return null;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const labelClass = "block text-sm font-medium text-gray-700";

export default function Member() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>({ ...emptyForm });

  const [modal, setModal] = useState<ModalType | null>(null);
  const [message, setMessage] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/members");
      const rows = getResponseData<Member[]>(response);

      if (!rows) {
        throw new Error("Invalid member data received from the server.");
      }

      setMembers(rows);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = members.filter((member) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return true;

    return [
      member.member_number,
      member.full_name,
      member.id_card_number,
      member.phone_number,
      member.employer,
      member.work_location,
      member.address,
      member.membership_status,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(keyword),
    );
  });

  const activeMembers = members.filter(
    (member) => member.membership_status === "Active",
  ).length;

  const inactiveMembers = members.filter(
    (member) => member.membership_status === "Inactive",
  ).length;

  const openCreateForm = () => {
    setEditingMember(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEditForm = (member: Member) => {
    setEditingMember(member);

    setForm({
      member_number: member.member_number ?? "",
      full_name: member.full_name ?? "",
      gender: member.gender ?? "Male",
      id_card_number: member.id_card_number ?? "",
      phone_number: member.phone_number ?? "",
      address: member.address ?? "",
      employer: member.employer ?? "",
      work_location: member.work_location ?? "",
      membership_status: member.membership_status ?? "Active",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingMember(null);
    setForm({ ...emptyForm });
  };

  const updateField = <K extends keyof MemberForm>(
    field: K,
    value: MemberForm[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) return;

    setSaving(true);

    try {
      if (editingMember) {
        const response = await api.put(`/members/${editingMember.id}`, form);

        setMessage(response.data?.message || "Member updated successfully.");
      } else {
        const response = await api.post("/members", form);

        setMessage(response.data?.message || "Member created successfully.");
      }

      setShowForm(false);
      setEditingMember(null);
      setForm({ ...emptyForm });
      setModal("success");

      await fetchMembers();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (member: Member) => {
    setSelectedMember(member);
    setMessage(
      `Are you sure you want to delete "${member.full_name}"? This action cannot be undone.`,
    );
    setModal("confirm");
  };

  const handleDelete = async () => {
    if (!selectedMember || deleting) return;

    setDeleting(true);

    try {
      const response = await api.delete(`/members/${selectedMember.id}`);

      setMessage(response.data?.message || "Member deleted successfully.");
      setModal("success");
      setSelectedMember(null);

      await fetchMembers();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
      setSelectedMember(null);
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    if (deleting) return;

    setModal(null);
    setMessage("");
    setSelectedMember(null);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage registered members and their information.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer"
        >
          <span className="text-lg leading-none">+</span>
          Add Member
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {members.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active Members</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {activeMembers}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Inactive Members</p>
          <p className="mt-2 text-3xl font-bold text-gray-600">
            {inactiveMembers}
          </p>
        </div>
      </div>

      {/* Member table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Member List</h2>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16 16 4 4"
              />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr className="bg-slate-800 text-white">
                <th className="px-5 py-4 font-semibold">Member No.</th>
                <th className="px-5 py-4 font-semibold">Full Name</th>
                <th className="px-5 py-4 font-semibold">ID Card Number</th>
                <th className="px-5 py-4 font-semibold">Phone</th>
                <th className="px-5 py-4 font-semibold">Employer</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-center font-semibold">
                  Deposits
                </th>
                <th className="px-5 py-4 text-center font-semibold">Loans</th>
                <th className="px-5 py-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-500">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                      Loading members...
                    </div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    {search
                      ? "No members match your search."
                      : "No member records found. Add your first member."}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">
                      {member.member_number || "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                      {member.full_name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                      {member.id_card_number || "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {member.phone_number || "-"}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {member.employer || "-"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.membership_status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {member.membership_status || "Inactive"}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                        {member.deposits_count ?? member.deposits?.length ?? 0}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {member.loans_count ?? member.loans?.length ?? 0}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(member)}
                          title="Edit member"
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 cursor-pointer"
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
                          onClick={() => confirmDelete(member)}
                          title="Delete member"
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 cursor-pointer"
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

        <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {filteredMembers.length} of {members.length} records
          </span>

          <button
            type="button"
            onClick={() => void fetchMembers()}
            disabled={loading}
            className="self-start font-medium text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            Refresh list
          </button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingMember ? "Edit Member" : "Add Member"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the member information below.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-lg p-2 text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Member Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={255}
                    value={form.member_number}
                    disabled={!!editingMember}
                    onChange={(event) =>
                      updateField("member_number", event.target.value)
                    }
                    placeholder="Enter member number"
                    className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                  {editingMember && (
                    <p className="mt-1 text-xs text-gray-500">
                      Member number cannot be changed.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={255}
                    value={form.full_name}
                    onChange={(event) =>
                      updateField("full_name", event.target.value)
                    }
                    placeholder="Enter full name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.gender}
                    onChange={(event) =>
                      updateField("gender", event.target.value as Gender)
                    }
                    className={inputClass}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    ID Card Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={255}
                    value={form.id_card_number}
                    onChange={(event) =>
                      updateField("id_card_number", event.target.value)
                    }
                    placeholder="Enter ID card number"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={255}
                    value={form.phone_number}
                    onChange={(event) =>
                      updateField("phone_number", event.target.value)
                    }
                    placeholder="Enter phone number"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Employer <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={255}
                    value={form.employer}
                    onChange={(event) =>
                      updateField("employer", event.target.value)
                    }
                    placeholder="Enter employer"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Work Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    maxLength={255}
                    value={form.work_location}
                    onChange={(event) =>
                      updateField("work_location", event.target.value)
                    }
                    placeholder="Enter work location"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Membership Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.membership_status}
                    onChange={(event) =>
                      updateField(
                        "membership_status",
                        event.target.value as MembershipStatus,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    maxLength={255}
                    rows={3}
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    placeholder="Enter address"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white cursor-pointer" />
                  )}
                  {saving
                    ? "Saving..."
                    : editingMember
                      ? "Update Member"
                      : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation / feedback modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  modal === "success"
                    ? "bg-green-100 text-green-600"
                    : modal === "confirm"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-red-100 text-red-600"
                }`}
              >
                {modal === "success" ? (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m5 12 4 4L19 6"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={
                        modal === "confirm"
                          ? "M12 9v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"
                          : "M12 8v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"
                      }
                    />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">
                  {modal === "success"
                    ? "Success"
                    : modal === "confirm"
                      ? "Confirm Delete"
                      : "Something Went Wrong"}
                </h3>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {modal === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={deleting}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {deleting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    )}
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
