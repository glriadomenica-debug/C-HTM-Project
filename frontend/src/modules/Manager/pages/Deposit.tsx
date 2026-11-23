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

const emptyForm: DepositForm = {
  member_number: "",
  amount: "",
  deposit_date: new Date().toLocaleDateString("en-CA"),
  deposit_type: "Regular",
  description: "",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

const labelClass = "block text-sm font-semibold text-slate-700";

function getErrorMessage(error: unknown): string {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Record<string, unknown>;
        data?: Record<string, unknown>;
      };
    };
    message?: string;
  };

  const response = err?.response?.data;
  const errors = response?.errors ?? response?.data;

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    for (const value of Object.values(errors)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === "string") return first;
    }
  }

  return (
    response?.message ||
    err?.message ||
    "An unexpected error occurred. Please try again."
  );
}

function getResponseData<T>(response: unknown): T[] | null {
  const payload = (response as { data?: unknown })?.data;

  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;

    if (Array.isArray(data)) return data as T[];

    if (data && typeof data === "object") {
      const nested = (data as { data?: unknown }).data;
      if (Array.isArray(nested)) return nested as T[];
    }
  }

  return null;
}

function formatAmount(amount: number | string): string {
  const value = Number(amount);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(date: string): string {
  if (!date) return "-";

  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMemberName(deposit: Deposit, members: Member[]): string {
  const member = members.find(
    (item) => item.member_number === deposit.member_number,
  );

  return deposit.member?.full_name || member?.full_name || "Unknown member";
}

function getDepositAmount(deposit: Deposit): number {
  const amount = Number(deposit.amount);
  return Number.isFinite(amount) ? amount : 0;
}

function isWithdrawal(deposit: Deposit): boolean {
  return deposit.deposit_type === "Withdrawal";
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
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
  );
}

function SummaryCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: string | number;
  color: "blue" | "green" | "red" | "gray";
  icon: "deposit" | "withdrawal" | "transactions" | "balance";
}) {
  const colors = {
    blue: {
      iconBox: "bg-blue-100 text-blue-700",
      number: "text-blue-700",
      border: "border-blue-100",
      accent: "bg-blue-500",
    },
    green: {
      iconBox: "bg-green-100 text-green-700",
      number: "text-green-700",
      border: "border-green-100",
      accent: "bg-green-500",
    },
    red: {
      iconBox: "bg-red-100 text-red-700",
      number: "text-red-700",
      border: "border-red-100",
      accent: "bg-red-500",
    },
    gray: {
      iconBox: "bg-slate-100 text-slate-600",
      number: "text-slate-800",
      border: "border-slate-200",
      accent: "bg-slate-400",
    },
  }[color];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${colors.border} bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${colors.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p
            className={`mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl ${colors.number}`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors.iconBox}`}
        >
          <DepositIcon name={icon} />
        </div>
      </div>
    </div>
  );
}

function DepositIcon({
  name,
}: {
  name: "deposit" | "withdrawal" | "transactions" | "balance";
}) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "deposit":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"
          />
        </svg>
      );

    case "withdrawal":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v12m-5-5 5 5 5-5M4 20h16"
          />
        </svg>
      );

    case "transactions":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
          />
        </svg>
      );

    case "balance":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10h18M7 15h4"
          />
        </svg>
      );
  }
}

function Icon({ name }: { name: string }) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 4 4" />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z"
          />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"
          />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
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
      );

    case "check":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m5 12 4 4L19 6"
          />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"
          />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v18m9-9H3"
          />
        </svg>
      );
  }
}

function ReportLink({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: "transactions" | "balance";
}) {
  return (
    <a
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
        <DepositIcon name={icon} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>

      <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700">
        →
      </span>
    </a>
  );
}

export default function Deposit() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | DepositType>("All");

  const [showForm, setShowForm] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [form, setForm] = useState<DepositForm>({ ...emptyForm });

  const [modal, setModal] = useState<ModalType | null>(null);
  const [message, setMessage] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<Deposit | null>(null);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/deposits");
      const rows = getResponseData<Deposit>(response);

      if (!rows) {
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
      const rows = getResponseData<Member>(response);

      if (!rows) {
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

  const filteredDeposits = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return [...deposits]
      .filter((deposit) => {
        const matchesType =
          typeFilter === "All" || deposit.deposit_type === typeFilter;

        const matchesSearch =
          !keyword ||
          [
            deposit.member_number,
            getMemberName(deposit, members),
            deposit.deposit_type,
            deposit.deposit_date,
            deposit.description,
            deposit.amount,
          ].some((value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(keyword),
          );

        return matchesType && matchesSearch;
      })
      .sort((a, b) => {
        const dateDifference =
          new Date(b.deposit_date).getTime() -
          new Date(a.deposit_date).getTime();

        return dateDifference || b.id - a.id;
      });
  }, [deposits, members, search, typeFilter]);

  const totalDeposits = useMemo(
    () =>
      deposits.reduce(
        (total, deposit) =>
          total + (isWithdrawal(deposit) ? 0 : getDepositAmount(deposit)),
        0,
      ),
    [deposits],
  );

  const totalWithdrawals = useMemo(
    () =>
      deposits.reduce(
        (total, deposit) =>
          total + (isWithdrawal(deposit) ? getDepositAmount(deposit) : 0),
        0,
      ),
    [deposits],
  );

  const totalNet = totalDeposits - totalWithdrawals;

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
      deposit_date: deposit.deposit_date?.slice(0, 10) ?? "",
      deposit_type: deposit.deposit_type,
      description: deposit.description ?? "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingDeposit(null);
    setForm({
      ...emptyForm,
      deposit_date: new Date().toLocaleDateString("en-CA"),
    });
  };

  const updateField = <K extends keyof DepositForm>(
    field: K,
    value: DepositForm[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) return;

    const amount = Number(form.amount);

    if (!form.member_number) {
      setMessage("Please select a member.");
      setModal("error");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Amount must be greater than zero.");
      setModal("error");
      return;
    }

    if (!form.deposit_date) {
      setMessage("Please select the transaction date.");
      setModal("error");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        amount,
        description: form.description.trim() || null,
      };

      const response = editingDeposit
        ? await api.put(`/deposits/${editingDeposit.id}`, payload)
        : await api.post("/deposits", payload);

      setMessage(
        response.data?.message ||
          (editingDeposit
            ? "Deposit transaction updated successfully."
            : "Deposit transaction created successfully."),
      );

      setShowForm(false);
      setEditingDeposit(null);
      setForm({ ...emptyForm });
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
      `Ita-boot hakarak duni atu hamoos dadus ${deposit.deposit_type.toLowerCase()} transaksaun ${getMemberName(deposit, members)}? Dadus ne'e sei hamoos permanente.`,
    );
    setModal("confirm");
  };

  const handleDelete = async () => {
    if (!selectedDeposit || deleting) return;

    setDeleting(true);

    try {
      const response = await api.delete(`/deposits/${selectedDeposit.id}`);

      setMessage(
        response.data?.message || "Deposit transaction deleted successfully.",
      );

      setModal("success");
      setSelectedDeposit(null);

      await fetchDeposits();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
      setSelectedDeposit(null);
    } finally {
      setDeleting(false);
    }
  };

  const closeModal = () => {
    if (deleting) return;

    setModal(null);
    setMessage("");
    setSelectedDeposit(null);
  };

  return (
    <div className="min-h-full space-y-5 bg-slate-50/80 p-3 sm:space-y-6 sm:p-5 lg:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            C-HTM / Finance Management
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dadus depositu
          </h1>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200 active:scale-[0.98] cursor-pointer"
        >
          <Icon name="plus" />
          Aumenta depositu
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Transaksaun"
          value={deposits.length.toLocaleString()}
          color="blue"
          icon="transactions"
        />

        <SummaryCard
          title="Total Depositu"
          value={formatAmount(totalDeposits)}
          color="green"
          icon="deposit"
        />

        <SummaryCard
          title="Total Levantamentu"
          value={formatAmount(totalWithdrawals)}
          color="red"
          icon="withdrawal"
        />

        <SummaryCard
          title="Montante Likidasaun"
          value={formatAmount(totalNet)}
          color="gray"
          icon="balance"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportLink
          title="Relatoriu Mensal"
          description="Halo relatoriu ba transaksaun depositu mensal"
          href="/superadmin/depositreport"
          icon="transactions"
        />

        <ReportLink
          title="Lista Membru saving"
          description="Haree total osan akumulada ba membru ida-idak"
          href="/superadmin/membersaving"
          icon="balance"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Transaksaun Depositu
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
                  {filteredDeposits.length}
                </span>
              </div>
             
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-64">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Icon name="search" />
                </span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transaksaun..."
                  aria-label="Search deposit transactions"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 cursor-pointer"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "All" | DepositType)
                }
                aria-label="Filter by transaction type"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:w-48 cursor-pointer"
              >
                <option value="All">Hili tipu depositu</option>
                <option value="Initial">Inisial</option>
                <option value="Regular">Regular</option>
                <option value="Additional">Adisional</option>
                <option value="Withdrawal">Levantamentu</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Depositu:{" "}
              <strong className="text-slate-800">
                {formatAmount(totalDeposits)}
              </strong>
            </span>

            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Levantamentu:{" "}
              <strong className="text-slate-800">
                {formatAmount(totalWithdrawals)}
              </strong>
            </span>

            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Fo sai dadus:{" "}
              <strong className="text-slate-800">
                {filteredDeposits.length}
              </strong>{" "}
              husi {deposits.length}
            </span>
          </div>
        </div>

        {/* Loading and empty states */}
        {loading ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Loading transaksaun depositu...
            </p>
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <DepositIcon name="transactions" />
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              {search.trim() || typeFilter !== "All"
                ? "La iha transaksaun ne'ebe korresponde"
                : "Seidauk iha transaksaun depositu"}
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
              {search.trim() || typeFilter !== "All"
                ? "Koko muda filtru tipu transaksaun."
                : "Aumenta transaksaun ida atu hahu rejistu depositu membru nian."}
            </p>

            {(search.trim() || typeFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All");
                }}
                className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Fila ba inisiu
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile transaction cards */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredDeposits.map((deposit, index) => {
                const withdrawal = isWithdrawal(deposit);

                return (
                  <article
                    key={deposit.id}
                    className="p-4 transition hover:bg-blue-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${withdrawal ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        <DepositIcon
                          name={withdrawal ? "withdrawal" : "deposit"}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="mb-1 text-xs text-slate-400">
                              Nu. {index + 1}
                            </p>

                            <h3 className="break-words font-semibold text-slate-900">
                              {getMemberName(deposit, members)}
                            </h3>

                            <p className="mt-1 text-xs font-medium text-blue-700">
                              {deposit.member_number || "-"}
                            </p>
                          </div>

                          <span
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                              withdrawal
                                ? "bg-red-50 text-red-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {deposit.deposit_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-slate-50 p-3">
                      <MobileField
                        label="Data depositu"
                        value={formatDate(deposit.deposit_date)}
                      />

                      <MobileField
                        label="Montante"
                        value={`${withdrawal ? "−" : "+"}${formatAmount(
                          getDepositAmount(deposit),
                        )}`}
                        valueClassName={
                          withdrawal ? "text-red-600" : "text-green-700"
                        }
                      />

                      <div className="col-span-2 min-w-0">
                        <MobileField
                          label="Deskrisaun"
                          value={deposit.description || "-"}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(deposit)}
                        aria-label={`Edit transaction ${deposit.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 cursor-pointer"
                      >
                        <Icon name="edit" />
                        Hadia
                      </button>

                      <button
                        type="button"
                        onClick={() => confirmDelete(deposit)}
                        aria-label={`Delete transaction ${deposit.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
                      >
                        <Icon name="trash" />
                        Hamoos
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop data table */}
            <div className="hidden w-full overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                <thead className="bg-slate-800 text-xs uppercase tracking-wider text-slate-100">
                  <tr>
                    <th className="w-16 whitespace-nowrap px-4 py-4 text-center font-semibold">
                      Nu.
                    </th>

                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Data
                    </th>

                    <th className="min-w-52 px-4 py-4 font-semibold">
                      Naran
                    </th>

                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Tipu Depositu
                    </th>

                    <th className="whitespace-nowrap px-4 py-4 text-right font-semibold">
                      Montante
                    </th>

                    <th className="min-w-48 px-4 py-4 font-semibold">
                      Deskrisaun
                    </th>

                    <th className="sticky right-0 z-10 whitespace-nowrap bg-slate-800 px-4 py-4 text-center font-semibold">
                      Aksaun
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredDeposits.map((deposit, index) => {
                    const withdrawal = isWithdrawal(deposit);

                    return (
                      <tr
                        key={deposit.id}
                        className="group transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50"
                      >
                        <td className="px-4 py-4 text-center tabular-nums text-slate-400">
                          {index + 1}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {formatDate(deposit.deposit_date)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                                withdrawal
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700"
                              }`}
                            >
                              {getMemberName(deposit, members)
                                .trim()
                                .charAt(0)
                                .toUpperCase() || "M"}
                            </div>

                            <div className="min-w-0">
                              <p className="break-words font-semibold text-slate-900">
                                {getMemberName(deposit, members)}
                              </p>

                              <p className="mt-1 text-xs font-medium text-blue-700">
                                {deposit.member_number || "-"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                              withdrawal
                                ? "bg-red-50 text-red-700"
                                : deposit.deposit_type === "Initial"
                                  ? "bg-purple-50 text-purple-700"
                                  : deposit.deposit_type === "Additional"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-green-50 text-green-700"
                            }`}
                          >
                            {deposit.deposit_type}
                          </span>
                        </td>

                        <td
                          className={`whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums ${
                            withdrawal ? "text-red-600" : "text-green-700"
                          }`}
                        >
                          {withdrawal ? "−" : "+"}
                          {formatAmount(getDepositAmount(deposit))}
                        </td>

                        <td className="max-w-64 whitespace-normal break-words px-4 py-4 text-slate-600">
                          {deposit.description || (
                            <span className="text-slate-400">
                              Deskrisaun la iha
                            </span>
                          )}
                        </td>

                        <td className="sticky right-0 bg-white/95 px-3 py-4 text-center shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)] group-hover:bg-blue-50">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditForm(deposit)}
                              title="Hadia dadus"
                              aria-label={`Edit transaction ${deposit.id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 transition hover:border-blue-300 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer"
                            >
                              <Icon name="edit" />
                            </button>

                            <button
                              type="button"
                              onClick={() => confirmDelete(deposit)}
                              title="Hamoos dadus"
                              aria-label={`Delete transaction ${deposit.id}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-red-100 cursor-pointer"
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td
                      colSpan={4}
                      className="px-4 py-4 text-right font-semibold text-slate-700"
                    >
                      Montante depositu husi transaksaun hotu-hotu
                    </td>

                    <td
                      className={`whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums ${
                        totalNet < 0 ? "text-red-600" : "text-slate-900"
                      }`}
                    >
                      {formatAmount(totalNet)}
                    </td>

                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Table footer */}
        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing{" "}
            <strong className="text-slate-800">
              {filteredDeposits.length}
            </strong>{" "}
            of <strong className="text-slate-800">{deposits.length}</strong>{" "}
            transactions
          </p>

          <button
            type="button"
            onClick={() => {
              void fetchDeposits();
              void fetchMembers();
            }}
            disabled={loading || loadingMembers}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto cursor-pointer"
          >
            <Icon name="refresh" />
            Refresh list
          </button>
        </footer>
      </section>

      {/* Create / Edit transaction modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingDeposit
                    ? "Hadia dadus depositu"
                    : "Aumenta dadus depositu"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Hatama dadus detallu ba transaksaun membru nian iha kraik.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-xl p-2 text-2xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-6">
                <div className="sm:col-span-2">
                  <FormField label="Membru" required>
                    <select
                      required
                      value={form.member_number}
                      disabled={loadingMembers}
                      onChange={(event) =>
                        updateField("member_number", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">
                        {loadingMembers
                          ? "Loading dadus membru..."
                          : "Hili Membru"}
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
                      <p className="mt-1 text-xs text-red-600">
                        Dadus membru nian la iha. Rejistu dadus membru.
                      </p>
                    )}
                  </FormField>
                </div>

                <FormField label="Tipu Depositu" required>
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
                    <option value="Initial">Inisial</option>
                    <option value="Regular">Regular</option>
                    <option value="Additional">Adisional</option>
                    <option value="Withdrawal">Levantamentu</option>
                  </select>
                </FormField>

                <FormField label="Montante (USD)" required>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">
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

                <FormField label="Data depositu" required>
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
                  <FormField label="Deskrisaun">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={form.description}
                      onChange={(event) =>
                        updateField("description", event.target.value)
                      }
                      placeholder="Hatama detallu husi transaksaun (opsional)"
                      className={inputClass}
                    />
                    <p className="mt-1 text-right text-xs text-slate-400">
                      {form.description.length}/1000
                    </p>
                  </FormField>
                </div>

                {form.deposit_type === "Withdrawal" && (
                  <div className="sm:col-span-2">
                    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                      <div className="mt-0.5 shrink-0 text-amber-700">
                        <Icon name="warning" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Transaksaun Levantamentu
                        </p>
                        <p className="mt-1 text-sm leading-5 text-amber-800">
                          This transaction will be treated as money withdrawn
                          from member savings in the report calculations.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  Kansela
                </button>

                <button
                  type="submit"
                  disabled={saving || loadingMembers || members.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Spinner />}
                  {saving
                    ? "Rai..."
                    : editingDeposit
                      ? "Atualiza dadus"
                      : "Rai dadus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation and feedback modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  modal === "success"
                    ? "bg-green-100 text-green-700"
                    : modal === "confirm"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                <Icon
                  name={
                    modal === "success"
                      ? "check"
                      : modal === "confirm"
                        ? "warning"
                        : "warning"
                  }
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">
                  {modal === "success"
                    ? "Success"
                    : modal === "confirm"
                      ? "Konfirma hamoos?"
                      : "Akontese Erru ruma. Koko fila-fali"}
                </h3>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              {modal === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={deleting}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    Kansela
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {deleting && <Spinner />}
                    {deleting ? "Hamoos..." : "Hamoos dadus"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
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

function MobileField({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value?: string | null;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-0.5 break-words text-sm font-medium text-slate-800 ${valueClassName}`}
      >
        {value || "-"}
      </p>
    </div>
  );
}
