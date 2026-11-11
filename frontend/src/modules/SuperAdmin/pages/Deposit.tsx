import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import api from "../../../services/api";

type DepositType = "Initial" | "Regular" | "Additional" | "Withdrawal";
type ModalType = "success" | "error" | "confirm";

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

const transactionTypes: DepositType[] = [
  "Initial",
  "Regular",
  "Additional",
  "Withdrawal",
];

const today = () => {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const emptyForm: DepositForm = {
  member_number: "",
  amount: "",
  deposit_date: today(),
  deposit_type: "Regular",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-gray-100";

function getRows<T>(response: any): T[] {
  const candidates = [
    response?.data?.data,
    response?.data?.data?.data,
    response?.data,
  ];

  return candidates.find(Array.isArray) ?? [];
}

function getErrorMessage(error: any): string {
  const response = error?.response?.data;
  const validationErrors = response?.errors ?? response?.data;

  if (validationErrors && typeof validationErrors === "object") {
    for (const value of Object.values(validationErrors)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }

      if (typeof value === "string") {
        return value;
      }
    }
  }

  return (
    response?.message ||
    error?.message ||
    "Something went wrong. Please try again."
  );
}

function formatAmount(amount: number | string): string {
  const value = Number(amount);

  return Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function dateForInput(date: string): string {
  return date ? date.slice(0, 10) : "";
}

function formatDate(date: string): string {
  if (!date) return "—";

  const parsed = new Date(`${dateForInput(date)}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? dateForInput(date)
    : parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  color,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  color: "blue" | "green" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ring-1 ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

function ReportLink({
  href,
  title,
  description,
  color,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  color: "blue" | "green";
  icon: ReactNode;
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50/70 hover:border-blue-300 hover:bg-blue-50",
    green:
      "border-emerald-100 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50",
  };

  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className={`group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${styles[color]}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>

      <svg
        className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 12h14m-6-6 6 6-6 6"
        />
      </svg>
    </button>
  );
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
      setDeposits(getRows<Deposit>(response));
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
      setMembers(getRows<Member>(response));
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

  const filteredDeposits = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return deposits
      .filter((deposit) => {
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
      })
      .sort((a, b) =>
        String(b.deposit_date).localeCompare(String(a.deposit_date)),
      );
  }, [deposits, search, typeFilter]);

  const totalNet = deposits.reduce((total, deposit) => {
    const amount = Number(deposit.amount) || 0;

    return total + (deposit.deposit_type === "Withdrawal" ? -amount : amount);
  }, 0);

  const totalWithdrawals = deposits.reduce(
    (total, deposit) =>
      total +
      (deposit.deposit_type === "Withdrawal" ? Number(deposit.amount) || 0 : 0),
    0,
  );

  const updateField = <K extends keyof DepositForm>(
    field: K,
    value: DepositForm[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const openCreateForm = () => {
    setEditingDeposit(null);
    setForm({ ...emptyForm, deposit_date: today() });
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
      setMessage("Please select a member before saving this transaction.");
      setModal("error");
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Please enter an amount greater than zero.");
      setModal("error");
      return;
    }

    if (!form.deposit_date) {
      setMessage("Please select a transaction date.");
      setModal("error");
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      amount,
      description: form.description.trim() || null,
    };

    try {
      const response = editingDeposit
        ? await api.put(`/deposits/${editingDeposit.id}`, payload)
        : await api.post("/deposits", payload);

      setMessage(
        response.data?.message ||
          (editingDeposit
            ? "Transaction updated successfully."
            : "Transaction created successfully."),
      );

      setShowForm(false);
      setEditingDeposit(null);
      setForm({ ...emptyForm, deposit_date: today() });
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
      `Delete this ${deposit.deposit_type.toLowerCase()} transaction for $${formatAmount(deposit.amount)}? This action cannot be undone.`,
    );
    setModal("confirm");
  };

  const handleDelete = async () => {
    if (!selectedDeposit) return;

    setDeleting(true);

    try {
      const response = await api.delete(`/deposits/${selectedDeposit.id}`);

      setMessage(response.data?.message || "Transaction deleted successfully.");
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
    if (deleting || saving) return;

    setModal(null);
    setMessage("");
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50/70 p-4 md:p-6 lg:p-8">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Finance</span>
            <span>/</span>
            <span className="font-medium text-gray-700">Deposits</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            Deposit Management
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Record member savings, manage withdrawals, and review transaction
            history.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 5v14m-7-7h14"
            />
          </svg>
          Add Transaction
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total Transactions"
          value={deposits.length.toLocaleString("en-US")}
          description="All recorded member transactions"
          color="blue"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              />
            </svg>
          }
        />

        <SummaryCard
          title="Net Transaction Amount"
          value={`$${formatAmount(totalNet)}`}
          description="All deposits minus all withdrawals"
          color="green"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v18m5-13H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              />
            </svg>
          }
        />

        <SummaryCard
          title="Total Withdrawals"
          value={`$${formatAmount(totalWithdrawals)}`}
          description="Total money withdrawn by members"
          color="red"
          icon={
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v14m-7-7h14"
              />
            </svg>
          }
        />
      </div>

      {/* Report shortcuts */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold text-gray-900">Deposit Reports</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose the report you want to view.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ReportLink
            href="/superadmin/depositreport"
            title="Monthly Deposit Report"
            description="View transaction details and totals for a selected month."
            color="blue"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h7"
                />
              </svg>
            }
          />

          <ReportLink
            href="/superadmin/membersaving"
            title="Member Savings Summary"
            description="Review each member's accumulated savings and the overall total."
            color="green"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-5h5m-2.5-2.5v5"
                />
              </svg>
            }
          />
        </div>
      </section>

      {/* Transaction history */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Transaction History
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {filteredDeposits.length} transaction
                {filteredDeposits.length !== 1 ? "s" : ""} displayed
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex">
              <div className="relative sm:col-span-2 xl:w-72">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
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
                  placeholder="Search member or transaction..."
                  aria-label="Search transactions"
                  className={`${inputClass} pl-9`}
                />
              </div>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={`${inputClass} xl:w-44`}
                aria-label="Filter by transaction type"
              >
                <option value="All">All transaction types</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All");
                }}
                disabled={!search && typeFilter === "All"}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear filters
              </button>

              <button
                type="button"
                onClick={() => void fetchDeposits()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <svg
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7v5h-5M4 17v-5h5"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
            <p className="text-sm font-medium text-gray-700">
              Loading transaction history...
            </p>
            <p className="text-xs text-gray-400">
              Please wait while the records are retrieved.
            </p>
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                />
              </svg>
            </div>

            <h3 className="mt-4 text-base font-bold text-gray-900">
              {search || typeFilter !== "All"
                ? "No matching transactions"
                : "No transactions yet"}
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
              {search || typeFilter !== "All"
                ? "Try a different search term or clear your filters to see more records."
                : "Start by recording a member deposit or withdrawal. Your transactions will appear here."}
            </p>

            {search || typeFilter !== "All" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All");
                }}
                className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                + Add First Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase tracking-wide text-gray-100">
                <tr>
                  <th className="px-5 py-4 font-semibold">No.</th>
                  <th className="px-5 py-4 font-semibold">Transaction Date</th>
                  <th className="px-5 py-4 font-semibold">Member Details</th>
                  <th className="px-5 py-4 font-semibold">Transaction Type</th>
                  <th className="px-5 py-4 text-right font-semibold">Amount</th>
                  <th className="px-5 py-4 font-semibold">Description</th>
                  <th className="px-5 py-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredDeposits.map((deposit, index) => (
                  <tr
                    key={deposit.id}
                    className="transition hover:bg-blue-50/40"
                  >
                    <td className="px-5 py-4 text-gray-400">{index + 1}</td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {formatDate(deposit.deposit_date)}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {deposit.member?.full_name || "Member"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {deposit.member_number}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          deposit.deposit_type === "Withdrawal"
                            ? "bg-red-50 text-red-700"
                            : deposit.deposit_type === "Initial"
                              ? "bg-purple-50 text-purple-700"
                              : deposit.deposit_type === "Additional"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {deposit.deposit_type}
                      </span>
                    </td>

                    <td
                      className={`whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums ${
                        deposit.deposit_type === "Withdrawal"
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {deposit.deposit_type === "Withdrawal" ? "−" : "+"}$
                      {formatAmount(deposit.amount)}
                    </td>

                    <td className="max-w-xs px-5 py-4 text-gray-500">
                      <span
                        className="block truncate"
                        title={deposit.description || ""}
                      >
                        {deposit.description || "—"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(deposit)}
                          aria-label={`Edit transaction ${index + 1}`}
                          title="Edit transaction"
                          className="rounded-lg border border-blue-100 p-2 text-blue-700 transition hover:bg-blue-50"
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
                              d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => confirmDelete(deposit)}
                          aria-label={`Delete transaction ${index + 1}`}
                          title="Delete transaction"
                          className="rounded-lg border border-red-100 p-2 text-red-600 transition hover:bg-red-50"
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
                              d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-4 text-right font-semibold text-gray-600"
                  >
                    Net amount of all transactions
                  </td>
                  <td
                    className={`whitespace-nowrap px-5 py-4 text-right font-bold tabular-nums ${totalNet < 0 ? "text-red-600" : "text-gray-900"}`}
                  >
                    ${formatAmount(totalNet)}
                  </td>
                  <td colSpan={2} className="px-5 py-4 text-xs text-gray-500">
                    Based on all records
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && filteredDeposits.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredDeposits.length} of {deposits.length}{" "}
              transactions
            </span>
            <span>Latest transaction dates appear first</span>
          </div>
        )}
      </section>

      {/* Create and edit form */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowForm(false);
            }
          }}
        >
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 p-5 md:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Deposit Management
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {editingDeposit ? "Edit Transaction" : "Add Transaction"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Complete the information below.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setShowForm(false)}
                aria-label="Close form"
                className="rounded-xl p-2 text-2xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 md:p-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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

                    {!loadingMembers && members.length === 0 && (
                      <p className="mt-2 text-xs text-red-600">
                        No members were found. Add a member before creating a
                        deposit transaction.
                      </p>
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
                  <p className="text-xs text-gray-400">
                    Choose Withdrawal when money is taken out.
                  </p>
                </FormField>

                <FormField label="Amount (USD)" required>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-gray-400">
                      $
                    </span>
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
                      className={`${inputClass} pl-8`}
                    />
                  </div>
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
                      placeholder="Enter a note or reference for this transaction (optional)"
                      className={`${inputClass} resize-y`}
                    />
                    <p className="text-right text-xs text-gray-400">
                      {form.description.length}/255 characters
                    </p>
                  </FormField>
                </div>
              </div>

              {form.deposit_type === "Withdrawal" && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <svg
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Withdrawal selected
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      Confirm that the withdrawal is authorized and that the
                      member has sufficient savings. This form does not
                      independently verify the member's available balance.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || loadingMembers || members.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {saving
                    ? "Saving transaction..."
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-modal-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold ${
                modal === "error"
                  ? "bg-red-50 text-red-600"
                  : modal === "confirm"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {modal === "error" ? "!" : modal === "confirm" ? "?" : "✓"}
            </div>

            <h3
              id="deposit-modal-title"
              className="text-lg font-bold text-gray-900"
            >
              {modal === "error"
                ? "Unable to complete action"
                : modal === "confirm"
                  ? "Confirm deletion"
                  : "Action completed"}
            </h3>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {message}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {modal === "confirm" ? (
                <>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={closeModal}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Keep Transaction
                  </button>

                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Yes, Delete"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
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
