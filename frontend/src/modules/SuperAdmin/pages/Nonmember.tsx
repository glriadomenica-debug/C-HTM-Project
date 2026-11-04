import { useCallback, useEffect, useState, type FormEvent } from "react";
import api from "../../../services/api";

type Gender = "Male" | "Female";
type ModalType = "success" | "error" | "confirm";

interface NonMember {
  id: number;
  non_member_number: string;
  full_name: string;
  gender: Gender;
  id_card_number: string;
  phone_number: string;
  address: string;
  employer: string;
  work_location: string;
  loans_count?: number;
  loans?: unknown[];
}

interface NonMemberForm {
  non_member_number: string;
  full_name: string;
  gender: Gender;
  id_card_number: string;
  phone_number: string;
  address: string;
  employer: string;
  work_location: string;
}

const emptyForm: NonMemberForm = {
  non_member_number: "",
  full_name: "",
  gender: "Male",
  id_card_number: "",
  phone_number: "",
  address: "",
  employer: "",
  work_location: "",
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

function getResponseData<T>(response: any): T {
  return response?.data?.data ?? response?.data ?? [];
}

export default function NonMember() {
  const [nonMembers, setNonMembers] = useState<NonMember[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNonMember, setEditingNonMember] = useState<NonMember | null>(
    null,
  );
  const [form, setForm] = useState<NonMemberForm>(emptyForm);

  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalMessage, setModalMessage] = useState("");
  const [selectedNonMember, setSelectedNonMember] = useState<NonMember | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const fetchNonMembers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/nonmembers");
      const data = getResponseData<NonMember[]>(response);
      setNonMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      setModalType("error");
      setModalMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNonMembers();
  }, [fetchNonMembers]);

  const filteredNonMembers = nonMembers.filter((item) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return true;

    return [
      item.non_member_number,
      item.full_name,
      item.id_card_number,
      item.phone_number,
      item.employer,
      item.work_location,
      item.address,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(keyword),
    );
  });

  const openCreateForm = () => {
    setEditingNonMember(null);
    setForm({ ...emptyForm });
    setIsFormOpen(true);
  };

  const openEditForm = (item: NonMember) => {
    setEditingNonMember(item);

    setForm({
      non_member_number: item.non_member_number ?? "",
      full_name: item.full_name ?? "",
      gender: item.gender ?? "Male",
      id_card_number: item.id_card_number ?? "",
      phone_number: item.phone_number ?? "",
      address: item.address ?? "",
      employer: item.employer ?? "",
      work_location: item.work_location ?? "",
    });

    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;

    setIsFormOpen(false);
    setEditingNonMember(null);
    setForm({ ...emptyForm });
  };

  const handleChange = (field: keyof NonMemberForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    setSubmitting(true);

    try {
      if (editingNonMember) {
        await api.put(`/nonmembers/${editingNonMember.id}`, {
          full_name: form.full_name.trim(),
          gender: form.gender,
          id_card_number: form.id_card_number.trim(),
          phone_number: form.phone_number.trim(),
          address: form.address.trim(),
          employer: form.employer.trim(),
          work_location: form.work_location.trim(),
        });

        setModalType("success");
        setModalMessage("Non-Member updated successfully.");
      } else {
        await api.post("/nonmembers", {
          non_member_number: form.non_member_number.trim(),
          full_name: form.full_name.trim(),
          gender: form.gender,
          id_card_number: form.id_card_number.trim(),
          phone_number: form.phone_number.trim(),
          address: form.address.trim(),
          employer: form.employer.trim(),
          work_location: form.work_location.trim(),
        });

        setModalType("success");
        setModalMessage("Non-Member created successfully.");
      }

      setIsFormOpen(false);
      setEditingNonMember(null);
      setForm({ ...emptyForm });

      await fetchNonMembers();
    } catch (error) {
      setModalType("error");
      setModalMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const askDelete = (item: NonMember) => {
    setSelectedNonMember(item);
    setModalType("confirm");
    setModalMessage(
      `Are you sure you want to delete "${item.full_name}"? This action cannot be undone.`,
    );
  };

  const handleDelete = async () => {
    if (!selectedNonMember || deleting) return;

    setDeleting(true);

    try {
      await api.delete(`/nonmembers/${selectedNonMember.id}`);

      setModalType("success");
      setModalMessage("Non-Member deleted successfully.");
      setSelectedNonMember(null);

      await fetchNonMembers();
    } catch (error) {
      setModalType("error");
      setModalMessage(getErrorMessage(error));
      setSelectedNonMember(null);
    } finally {
      setDeleting(false);
    }
  };

  const closeMessageModal = () => {
    setModalType(null);
    setModalMessage("");
    setSelectedNonMember(null);
  };

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Non-Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage non-member records and their information.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <span className="text-lg leading-none">+</span>
          Add Non-Member
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Non-Members</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {nonMembers.length}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Filtered Results</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {filteredNonMembers.length}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16 16 4 4"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Non-Member List</h2>
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
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search non-members..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Non-Member No.</th>
                <th className="px-5 py-4 font-semibold">Full Name</th>
                <th className="px-5 py-4 font-semibold">ID Card Number</th>
                <th className="px-5 py-4 font-semibold">Phone</th>
                <th className="px-5 py-4 font-semibold">Employer</th>
                <th className="px-5 py-4 font-semibold">Work Location</th>
                <th className="px-5 py-4 text-center font-semibold">Loans</th>
                <th className="px-5 py-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex items-center justify-center gap-3 text-gray-500">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                      Loading non-members...
                    </div>
                  </td>
                </tr>
              ) : filteredNonMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    {search
                      ? "No non-members match your search."
                      : "No non-member records found."}
                  </td>
                </tr>
              ) : (
                filteredNonMembers.map((item) => (
                  <tr key={item.id} className="transition hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">
                      {item.non_member_number || "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                      {item.full_name || "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                      {item.id_card_number || "-"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {item.phone_number || "-"}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {item.employer || "-"}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {item.work_location || "-"}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {item.loans_count ?? item.loans?.length ?? 0}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(item)}
                          title="Edit non-member"
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
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
                          onClick={() => askDelete(item)}
                          title="Delete non-member"
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
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
            Showing {filteredNonMembers.length} of {nonMembers.length} records
          </span>

          <button
            type="button"
            onClick={() => void fetchNonMembers()}
            disabled={loading}
            className="self-start font-medium text-blue-600 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            Refresh list
          </button>
        </div>
      </div>

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingNonMember ? "Edit Non-Member" : "Add Non-Member"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the non-member information below.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Close form"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m6 6 12 12M18 6 6 18"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Non-Member Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.non_member_number}
                    disabled={!!editingNonMember}
                    onChange={(event) =>
                      handleChange("non_member_number", event.target.value)
                    }
                    placeholder="Enter non-member number"
                    className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
                  />
                  {editingNonMember && (
                    <p className="mt-1 text-xs text-gray-500">
                      Non-member number cannot be changed.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      handleChange("full_name", event.target.value)
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
                      handleChange("gender", event.target.value)
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
                    type="text"
                    required
                    value={form.id_card_number}
                    onChange={(event) =>
                      handleChange("id_card_number", event.target.value)
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
                    type="tel"
                    required
                    value={form.phone_number}
                    onChange={(event) =>
                      handleChange("phone_number", event.target.value)
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
                    type="text"
                    required
                    value={form.employer}
                    onChange={(event) =>
                      handleChange("employer", event.target.value)
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
                    type="text"
                    required
                    value={form.work_location}
                    onChange={(event) =>
                      handleChange("work_location", event.target.value)
                    }
                    placeholder="Enter work location"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={form.address}
                    onChange={(event) =>
                      handleChange("address", event.target.value)
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
                  disabled={submitting}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {submitting
                    ? "Saving..."
                    : editingNonMember
                      ? "Update Non-Member"
                      : "Save Non-Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation / Feedback Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  modalType === "success"
                    ? "bg-green-100 text-green-600"
                    : modalType === "confirm"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-red-100 text-red-600"
                }`}
              >
                {modalType === "success" ? (
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
                ) : modalType === "confirm" ? (
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
                      d="M12 9v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"
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
                      d="M12 8v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"
                    />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">
                  {modalType === "success"
                    ? "Success"
                    : modalType === "confirm"
                      ? "Confirm Delete"
                      : "Something Went Wrong"}
                </h3>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                  {modalMessage}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {modalType === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={closeMessageModal}
                    disabled={deleting}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  onClick={closeMessageModal}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
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
