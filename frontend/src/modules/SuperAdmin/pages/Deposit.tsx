import { useCallback, useEffect, useState, type FormEvent } from "react";
import api from "../../../services/api";

type DepositType = "Initial" | "Regular" | "Additional" | "Withdrawal";

interface Member {
  id: number;
  member_number: string;
  full_name: string;
  membership_status?: "Active" | "Inactive";
}

interface Deposit {
  id: number;
  member_number: string;
  amount: number | string;
  deposit_date: string;
  deposit_type: DepositType;
  description: string | null;
  member?: Member;
}

interface DepositForm {
  member_number: string;
  amount: string;
  deposit_date: string;
  deposit_type: DepositType;
  description: string;
}

type ModalType = "success" | "error" | "confirm";

const emptyForm: DepositForm = {
  member_number: "",
  amount: "",
  deposit_date: new Date().toLocaleDateString("en-CA"),
  deposit_type: "Regular",
  description: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getErrorMessage(error: any): string {
  const response = error?.response?.data;
  const errors = response?.data;

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

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function formatAmount(amount: number | string): string {
  const value = Number(amount);

  return Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(amount);
}

function dateForInput(date: string): string {
  if (!date) return "";

  return date.slice(0, 10);
}

export default function Deposit() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [form, setForm] = useState<DepositForm>(emptyForm);

  const [modal, setModal] = useState<ModalType | null>(null);
  const [message, setMessage] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/deposits");
      const rows = response.data?.data;

      if (!Array.isArray(rows)) {
        throw new Error("Invalid deposit data received from the server.");
      }

      setDeposits(rows);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);

    try {
      const response = await api.get("/members");
      const rows = response.data?.data;

      if (!Array.isArray(rows)) {
        throw new Error("Invalid member data received from the server.");
      }

      setMembers(rows);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeposits();
    void fetchMembers();
  }, [fetchDeposits, fetchMembers]);

  const filteredDeposits = deposits.filter((deposit) => {
    const keyword = search.toLowerCase();

    const matchesSearch = [
      deposit.member_number,
      deposit.member?.full_name,
      deposit.deposit_type,
      deposit.description,
      deposit.deposit_date,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(keyword),
    );

    const matchesType =
      typeFilter === "All" || deposit.deposit_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const updateField = <K extends keyof DepositForm>(
    field: K,
    value: DepositForm[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const openCreateForm = () => {
    setEditingDeposit(null);
    setForm({
      ...emptyForm,
      deposit_date: new Date().toLocaleDateString("en-CA"),
    });
    setShowForm(true);
  };

  const openEditForm = (deposit: Deposit) => {
    setEditingDeposit(deposit);

    setForm({
      member_number: deposit.member_number ?? "",
      amount: String(deposit.amount ?? ""),
      deposit_date: dateForInput(deposit.deposit_date),
      deposit_type: deposit.deposit_type,
      description: deposit.description ?? "",
    });

    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.member_number) {
      setMessage("Please select a member.");
      setModal("error");
      return;
    }

    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setMessage("The amount must be greater than zero.");
      setModal("error");
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      amount: Number(form.amount),
      description: form.description.trim() || null,
    };

    try {
      if (editingDeposit) {
        const response = await api.put(
          `/deposits/${editingDeposit.id}`,
          payload,
        );

        setMessage(response.data?.message || "Deposit updated successfully.");
      } else {
        const response = await api.post("/deposits", payload);

        setMessage(response.data?.message || "Deposit created successfully.");
      }

      setShowForm(false);
      setEditingDeposit(null);
      setForm(emptyForm);
      setModal("success");

      await fetchDeposits();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (deposit: Deposit) => {
    setSelectedDeposit(deposit);
    setMessage(
      `Are you sure you want to delete this ${deposit.deposit_type.toLowerCase()} transaction of ${formatAmount(deposit.amount)}?`,
    );
    setModal("confirm");
  };

  const handleDelete = async () => {
    if (!selectedDeposit) return;

    setDeleting(true);

    try {
      const response = await api.delete(`/deposits/${selectedDeposit.id}`);

      setMessage(response.data?.message || "Deposit deleted successfully.");
      setSelectedDeposit(null);
      setModal("success");

      await fetchDeposits();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    if (deleting) return;

    setModal(null);
    setMessage("");
  };

  const totalDeposits = deposits.reduce((total, deposit) => {
    const amount = Number(deposit.amount) || 0;

    return total + (deposit.deposit_type === "Withdrawal" ? -amount : amount);
  }, 0);

  const totalWithdrawals = deposits
    .filter((deposit) => deposit.deposit_type === "Withdrawal")
    .reduce((total, deposit) => total + (Number(deposit.amount) || 0), 0);

  const transactionTypes: DepositType[] = [
    "Initial",
    "Regular",
    "Additional",
    "Withdrawal",
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deposits</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage member deposits and withdrawal transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 cursor-pointer"
        >
          + Add Transaction
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Transactions</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {deposits.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Net Transaction Amount</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            ${formatAmount(totalDeposits)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Deposits minus withdrawals, across all records.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Withdrawals</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            ${formatAmount(totalWithdrawals)}
          </p>
        </div>
      </div>

      {/* Transactions table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-semibold text-gray-900">Transaction History</h2>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/superadmin/depositreport";
              }}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white cursor-pointer"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 3h7l4 4v14H5V3h3Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 3v5h4M8 13h8M8 17h8"
                />
              </svg>
              Deposit Report
            </button>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transactions..."
              className={`${inputClass} sm:w-50`}
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by transaction type"
            >
              <option value="All">All Types</option>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Loading deposits...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr className="bg-slate-800 text-white">
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Member</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredDeposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-gray-600">
                      {dateForInput(deposit.deposit_date)}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">
                        {deposit.member?.full_name || "Member"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {deposit.member_number}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          deposit.deposit_type === "Withdrawal"
                            ? "bg-red-100 text-red-700"
                            : deposit.deposit_type === "Initial"
                              ? "bg-purple-100 text-purple-700"
                              : deposit.deposit_type === "Additional"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                        }`}
                      >
                        {deposit.deposit_type}
                      </span>
                    </td>

                    <td
                      className={`px-5 py-4 font-semibold ${
                        deposit.deposit_type === "Withdrawal"
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {deposit.deposit_type === "Withdrawal" ? "−" : "+"}$
                      {formatAmount(deposit.amount)}
                    </td>

                    <td className="max-w-xs px-5 py-4 text-gray-600">
                      {deposit.description || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(deposit)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
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
                          onClick={() => confirmDelete(deposit)}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
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
                            />{" "}
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredDeposits.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-gray-500"
                    >
                      {search || typeFilter !== "All"
                        ? "No transactions match your filters."
                        : "No deposit transactions found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingDeposit ? "Edit Transaction" : "Add Transaction"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter the transaction details below.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setShowForm(false)}
                aria-label="Close form"
                className="rounded-lg px-3 py-1 text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Member" required>
                    <select
                      required
                      value={form.member_number}
                      onChange={(event) =>
                        updateField("member_number", event.target.value)
                      }
                      disabled={loadingMembers || members.length === 0}
                      className={inputClass}
                    >
                      <option value="">
                        {loadingMembers
                          ? "Loading members..."
                          : members.length === 0
                            ? "No members available"
                            : "Select a member"}
                      </option>

                      {members.map((member) => (
                        <option key={member.id} value={member.member_number}>
                          {member.member_number} — {member.full_name}
                          {member.membership_status === "Inactive"
                            ? " (Inactive)"
                            : ""}
                        </option>
                      ))}
                    </select>

                    {members.length === 0 && !loadingMembers && (
                      <span className="text-xs text-red-600">
                        Add a member before recording a deposit.
                      </span>
                    )}
                  </FormField>
                </div>

                <FormField label="Transaction Type" required>
                  <select
                    required
                    value={form.deposit_type}
                    onChange={(event) =>
                      updateField(
                        "deposit_type",
                        event.target.value as DepositType,
                      )
                    }
                    className={inputClass}
                  >
                    {transactionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Amount (USD)" required>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      updateField("amount", event.target.value)
                    }
                    placeholder="0.00"
                    className={inputClass}
                  />
                  <span className="text-xs text-gray-500">
                    Enter a positive amount. Select Withdrawal for money taken
                    out.
                  </span>
                </FormField>

                <FormField label="Transaction Date" required>
                  <input
                    required
                    type="date"
                    value={form.deposit_date}
                    onChange={(event) =>
                      updateField("deposit_date", event.target.value)
                    }
                    className={inputClass}
                  />
                </FormField>

                <div className="sm:col-span-2">
                  <FormField label="Description">
                    <textarea
                      rows={3}
                      maxLength={255}
                      value={form.description}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      placeholder="Optional transaction details"
                      className={inputClass}
                    />
                  </FormField>
                </div>
              </div>

              {form.deposit_type === "Withdrawal" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  You selected Withdrawal. Ensure the transaction is authorized
                  and the member has sufficient balance. The current backend
                  validation does not check the member's available balance.
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || loadingMembers || members.length === 0}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingDeposit
                      ? "Save Changes"
                      : "Create Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation and feedback modal */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full text-xl ${
                modal === "error"
                  ? "bg-red-100 text-red-700"
                  : modal === "confirm"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {modal === "error" ? "!" : modal === "confirm" ? "?" : "✓"}
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              {modal === "error"
                ? "Something went wrong"
                : modal === "confirm"
                  ? "Confirm Deletion"
                  : "Success"}
            </h3>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {message}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              {modal === "confirm" ? (
                <>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={closeModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
