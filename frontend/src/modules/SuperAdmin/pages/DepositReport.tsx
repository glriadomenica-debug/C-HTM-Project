import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../services/api";

interface Deposit {
  id: number;
  member_number: string;
  amount: number | string;
  deposit_date: string;
  deposit_type: string;
  description?: string | null;
  member?: {
    member_number?: string;
    full_name?: string;
  } | null;
}

interface Member {
  id: number;
  member_number: string;
  full_name: string;
}

type TransactionFilter = "all" | "deposit" | "withdrawal";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const getRows = <T,>(response: unknown): T[] => {
  const body = (response as { data?: unknown })?.data;

  if (Array.isArray(body)) return body as T[];

  if (body && typeof body === "object") {
    const data = (body as { data?: unknown }).data;

    if (Array.isArray(data)) return data as T[];

    if (data && typeof data === "object") {
      const nested = (data as { data?: unknown }).data;
      if (Array.isArray(nested)) return nested as T[];
    }
  }

  return [];
};

const getAmount = (deposit: Deposit) => {
  const amount = Number(deposit.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const isWithdrawal = (deposit: Deposit) =>
  deposit.deposit_type?.trim().toLowerCase() === "withdrawal";

const formatDate = (date: string) => {
  const [year, month, day] = (date || "").slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return date || "-";

  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getMemberName = (deposit: Deposit, members: Member[]): string =>
  deposit.member?.full_name ||
  members.find(
    (member) =>
      member.member_number ===
      (deposit.member_number || deposit.member?.member_number),
  )?.full_name ||
  "Unknown member";

function Icon({
  name,
}: {
  name: "document" | "calendar" | "search" | "back" | "print" | "empty";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "document":
      return (
        <svg {...common}>
          <path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" />
          <path d="M14 3.75v4h4M8.5 12h7M8.5 16h7" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.2 4.2" />
        </svg>
      );

    case "back":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6M9 12h12" />
        </svg>
      );

    case "print":
      return (
        <svg {...common}>
          <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v7H6z" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2V5.75a2 2 0 0 1 2-2Z" />
          <path d="M14 3.75v4h4M8.5 12h7M8.5 16h5" />
        </svg>
      );
  }
}

export default function DepositReport() {
  const today = new Date();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0"),
  );
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [search, setSearch] = useState("");
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [depositResponse, memberResponse] = await Promise.all([
        api.get("/deposits"),
        api.get("/members"),
      ]);

      setDeposits(getRows<Deposit>(depositResponse));
      setMembers(getRows<Member>(memberResponse));
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      setError(
        errorResponse?.response?.data?.message ||
          errorResponse?.message ||
          "We couldn't load the deposit report. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const years = useMemo(() => {
    const result = new Set<string>([String(today.getFullYear())]);

    deposits.forEach((deposit) => {
      const year = deposit.deposit_date?.slice(0, 4);
      if (year && /^\d{4}$/.test(year)) result.add(year);
    });

    return Array.from(result).sort((a, b) => Number(b) - Number(a));
  }, [deposits, today]);

  const monthlyDeposits = useMemo(
    () =>
      deposits
        .filter((deposit) => {
          const date = deposit.deposit_date?.slice(0, 10) || "";

          return (
            date.slice(0, 4) === selectedYear &&
            date.slice(5, 7) === selectedMonth
          );
        })
        .sort((a, b) => {
          const dateCompare = (b.deposit_date || "").localeCompare(
            a.deposit_date || "",
          );

          return dateCompare || b.id - a.id;
        }),
    [deposits, selectedMonth, selectedYear],
  );

  const summary = useMemo(
    () =>
      monthlyDeposits.reduce(
        (result, deposit) => {
          const amount = getAmount(deposit);

          if (isWithdrawal(deposit)) {
            result.withdrawals += amount;
            result.withdrawalCount += 1;
          } else {
            result.deposits += amount;
            result.depositCount += 1;
          }

          return result;
        },
        {
          deposits: 0,
          withdrawals: 0,
          depositCount: 0,
          withdrawalCount: 0,
        },
      ),
    [monthlyDeposits],
  );

  const netAmount = summary.deposits - summary.withdrawals;

  const monthLabel =
    MONTHS.find((month) => month.value === selectedMonth)?.label || "";

  const filteredDeposits = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return monthlyDeposits.filter((deposit) => {
      const withdrawal = isWithdrawal(deposit);

      const matchesType =
        transactionFilter === "all" ||
        (transactionFilter === "withdrawal" && withdrawal) ||
        (transactionFilter === "deposit" && !withdrawal);

      const memberNumber =
        deposit.member_number || deposit.member?.member_number || "";
      const memberName = getMemberName(deposit, members);

      const matchesSearch =
        !keyword ||
        memberNumber.toLowerCase().includes(keyword) ||
        memberName.toLowerCase().includes(keyword) ||
        (deposit.description || "").toLowerCase().includes(keyword) ||
        (deposit.deposit_type || "").toLowerCase().includes(keyword);

      return matchesType && matchesSearch;
    });
  }, [monthlyDeposits, search, transactionFilter, members]);

  const clearFilters = () => {
    setSearch("");
    setTransactionFilter("all");
  };

  const hasActiveFilters = search.trim() !== "" || transactionFilter !== "all";

  return (
    <div className="deposit-report-print min-h-full space-y-5 bg-slate-50/80 p-3 sm:space-y-6 sm:p-5 lg:p-6">
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <Icon name="document" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Reports / Deposits
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Monthly Deposit Report
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-slate-500">
              Review member deposits and withdrawals for your selected month.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <Icon name="back" />
            Back
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="print" />
            Print Report
          </button>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden"
        >
          <div>
            <p className="font-semibold text-red-800">Unable to load report</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {/* Month and year filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
            <Icon name="calendar" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">Report period</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select the month and year you want to review.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label
              htmlFor="report-month"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Month
            </label>
            <select
              id="report-month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="report-year"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Year
            </label>
            <select
              id="report-year"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedMonth(String(today.getMonth() + 1).padStart(2, "0"));
              setSelectedYear(String(today.getFullYear()));
              clearFilters();
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            Reset filters
          </button>
        </div>
      </section>

      {/* Summary cards — styled like Non-Member cards */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">
            {monthLabel} {selectedYear} Summary
          </h2>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
            {summary.depositCount + summary.withdrawalCount} transactions
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Total Deposits"
            amount={formatMoney(summary.deposits)}
            color="green"
            icon="plus"
          />

          <SummaryCard
            title="Total Withdrawals"
            amount={formatMoney(summary.withdrawals)}
            color="red"
            icon="minus"
          />

          <SummaryCard
            title="Monthly Net Amount"
            amount={formatMoney(netAmount)}
            color={netAmount < 0 ? "red" : "blue"}
            icon="wallet"
          />
        </div>
      </section>

      {/* Transaction table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5 print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Transaction Details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {monthLabel} {selectedYear}
              </p>
            </div>

            <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
              {filteredDeposits.length} of {monthlyDeposits.length} shown
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div className="relative">
              <label htmlFor="deposit-search" className="sr-only">
                Search transactions
              </label>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" />
              </span>
              <input
                id="deposit-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member, number, description..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="transaction-type" className="sr-only">
                Transaction type
              </label>
              <select
                id="transaction-type"
                value={transactionFilter}
                onChange={(event) =>
                  setTransactionFilter(event.target.value as TransactionFilter)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">All transaction types</option>
                <option value="deposit">Deposits only</option>
                <option value="withdrawal">Withdrawals only</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear search
            </button>
          </div>
        </div>

        {/* Print heading */}
        <div className="hidden px-5 py-4 print:block">
          <h1 className="text-xl font-bold text-slate-900">
            C-HTM Monthly Deposit Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Report period: {monthLabel} {selectedYear}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Total deposits: {formatMoney(summary.deposits)} · Total withdrawals:{" "}
            {formatMoney(summary.withdrawals)} · Net amount:{" "}
            {formatMoney(netAmount)}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Loading transactions...
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Please wait while we prepare your report.
            </p>
          </div>
        ) : error ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-slate-500">
              Transactions cannot be displayed until the report loads
              successfully.
            </p>
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="px-4 py-14 text-center sm:px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Icon name="empty" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              {monthlyDeposits.length === 0
                ? "No transactions for this month"
                : "No matching transactions"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              {monthlyDeposits.length === 0
                ? `There are no deposit or withdrawal records for ${monthLabel} ${selectedYear}. Try selecting another month or year.`
                : "Try another search term or clear your transaction filters."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden print:hidden">
              {filteredDeposits.map((deposit, index) => {
                const withdrawal = isWithdrawal(deposit);
                const memberNumber =
                  deposit.member_number || deposit.member?.member_number || "-";

                return (
                  <article
                    key={deposit.id}
                    className="p-4 transition hover:bg-blue-50/40"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                          withdrawal
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {withdrawal ? "−" : "+"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-400">
                              No. {index + 1}
                            </p>
                            <h3 className="mt-1 break-words font-semibold text-slate-900">
                              {getMemberName(deposit, members)}
                            </h3>
                            <p className="mt-1 text-xs font-medium text-blue-700">
                              {memberNumber}
                            </p>
                          </div>

                          <p
                            className={`break-words text-right text-sm font-bold ${
                              withdrawal ? "text-red-600" : "text-green-700"
                            }`}
                          >
                            {withdrawal ? "−" : "+"}
                            {formatMoney(getAmount(deposit))}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-3">
                      <MobileField
                        label="Transaction date"
                        value={formatDate(deposit.deposit_date)}
                      />
                      <MobileField
                        label="Transaction type"
                        value={deposit.deposit_type || "Deposit"}
                      />
                      <MobileField
                        label="Amount"
                        value={formatMoney(getAmount(deposit))}
                        color={withdrawal ? "red" : "green"}
                      />
                      <MobileField
                        label="Description"
                        value={deposit.description || "-"}
                      />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden w-full overflow-x-auto md:block">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead className="bg-slate-800 text-xs uppercase tracking-wider text-slate-100">
                  <tr>
                    <th className="w-16 whitespace-nowrap px-4 py-4 text-center font-semibold">
                      No.
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Member Number
                    </th>
                    <th className="min-w-48 px-4 py-4 font-semibold">
                      Member Name
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Type
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 text-right font-semibold">
                      Amount
                    </th>
                    <th className="min-w-48 px-4 py-4 font-semibold">
                      Description
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredDeposits.map((deposit, index) => {
                    const withdrawal = isWithdrawal(deposit);

                    return (
                      <tr
                        key={deposit.id}
                        className="transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50"
                      >
                        <td className="px-4 py-4 text-center tabular-nums text-slate-400">
                          {index + 1}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {formatDate(deposit.deposit_date)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-100">
                            {deposit.member_number ||
                              deposit.member?.member_number ||
                              "-"}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {getMemberName(deposit, members)}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                              withdrawal
                                ? "bg-red-50 text-red-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {deposit.deposit_type || "Deposit"}
                          </span>
                        </td>

                        <td
                          className={`whitespace-nowrap px-4 py-4 text-right font-bold tabular-nums ${
                            withdrawal ? "text-red-600" : "text-green-700"
                          }`}
                        >
                          {withdrawal ? "−" : "+"}
                          {formatMoney(getAmount(deposit))}
                        </td>

                        <td className="max-w-xs whitespace-normal break-words px-4 py-4 text-slate-500">
                          {deposit.description || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p>
            Showing{" "}
            <strong className="text-slate-800">
              {filteredDeposits.length}
            </strong>{" "}
            of{" "}
            <strong className="text-slate-800">{monthlyDeposits.length}</strong>{" "}
            transactions
          </p>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            >
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" />
            </svg>
            Refresh report
          </button>
        </footer>
      </section>

      <p className="text-center text-xs text-slate-400 print:hidden">
        C-HTM · Monthly Deposit Report · {monthLabel} {selectedYear}
      </p>

      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 12mm;
          }

          body {
            background: #fff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          .deposit-report-print,
          .deposit-report-print * {
            visibility: visible !important;
          }

          .deposit-report-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }

          .deposit-report-print .print\\:hidden {
            display: none !important;
          }

          .deposit-report-print .print\\:block {
            display: block !important;
          }

          .deposit-report-print .md\\:hidden {
            display: none !important;
          }

          .deposit-report-print .hidden.md\\:block {
            display: block !important;
          }

          .deposit-report-print .overflow-hidden,
          .deposit-report-print .overflow-x-auto {
            overflow: visible !important;
          }

          .deposit-report-print section {
            break-inside: avoid;
            box-shadow: none !important;
          }

          .deposit-report-print table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
            font-size: 8pt !important;
          }

          .deposit-report-print th,
          .deposit-report-print td {
            padding: 5px !important;
            overflow-wrap: anywhere !important;
          }

          .deposit-report-print thead {
            display: table-header-group;
          }

          .deposit-report-print tr {
            break-inside: avoid;
          }

          .deposit-report-print .rounded-2xl {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  amount: string;
  color: "green" | "red" | "blue";
  icon: "plus" | "minus" | "wallet";
}

function SummaryCard({ title, amount, color, icon }: SummaryCardProps) {
  const styles = {
    green: {
      iconBox: "bg-green-100 text-green-700",
      amount: "text-green-700",
      border: "border-green-100",
      accent: "bg-green-500",
    },
    red: {
      iconBox: "bg-red-100 text-red-700",
      amount: "text-red-600",
      border: "border-red-100",
      accent: "bg-red-500",
    },
    blue: {
      iconBox: "bg-blue-100 text-blue-700",
      amount: "text-blue-700",
      border: "border-blue-100",
      accent: "bg-blue-500",
    },
  }[color];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${styles.border} bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p
            className={`mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl ${styles.amount}`}
          >
            {amount}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.iconBox}`}
        >
          {icon === "plus" && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v14M5 12h14"
              />
            </svg>
          )}

          {icon === "minus" && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
            </svg>
          )}

          {icon === "wallet" && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="15" rx="2.5" />
              <path d="M3 9h18M16 14h.01" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileField({
  label,
  value,
  color = "default",
}: {
  label: string;
  value?: string | null;
  color?: "default" | "green" | "red";
}) {
  const valueColor = {
    default: "text-slate-800",
    green: "text-green-700",
    red: "text-red-600",
  }[color];

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 break-words text-sm font-semibold ${valueColor}`}>
        {value || "-"}
      </p>
    </div>
  );
}
