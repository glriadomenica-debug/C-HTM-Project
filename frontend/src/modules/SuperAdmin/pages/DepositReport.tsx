import { useEffect, useMemo, useState } from "react";
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

const getRows = <T,>(response: any): T[] => {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;

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

export default function DepositReport() {
  const today = new Date();

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    String(today.getMonth() + 1).padStart(2, "0"),
  );
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [depositResponse, memberResponse] = await Promise.all([
          api.get("/deposits"),
          api.get("/members"),
        ]);

        setDeposits(getRows<Deposit>(depositResponse));
        setMembers(getRows<Member>(memberResponse));
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            "Failed to load monthly deposit report.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const years = useMemo(() => {
    const result = new Set<string>([String(today.getFullYear())]);

    deposits.forEach((deposit) => {
      if (deposit.deposit_date) {
        result.add(deposit.deposit_date.slice(0, 4));
      }
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
        .sort((a, b) => b.deposit_date.localeCompare(a.deposit_date)),
    [deposits, selectedMonth, selectedYear],
  );

  const summary = useMemo(
    () =>
      monthlyDeposits.reduce(
        (result, deposit) => {
          const amount = getAmount(deposit);

          if (isWithdrawal(deposit)) {
            result.withdrawals += amount;
          } else {
            result.deposits += amount;
          }

          return result;
        },
        { deposits: 0, withdrawals: 0 },
      ),
    [monthlyDeposits],
  );

  const netAmount = summary.deposits - summary.withdrawals;
  const monthLabel =
    MONTHS.find((month) => month.value === selectedMonth)?.label || "";

  const findMemberName = (deposit: Deposit) =>
    deposit.member?.full_name ||
    members.find((member) => member.member_number === deposit.member_number)
      ?.full_name ||
    "Unknown member";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Monthly Deposit Report
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monthly member deposit and withdrawal transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 print:hidden"
        >
          Print Report
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Filter Report
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="report-month"
              className="mb-1.5 block text-sm font-medium text-gray-600"
            >
              Month
            </label>
            <select
              id="report-month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              className="mb-1.5 block text-sm font-medium text-gray-600"
            >
              Year
            </label>
            <select
              id="report-year"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          {monthLabel} {selectedYear} Summary
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Deposits</p>
            <p className="mt-2 text-2xl font-bold text-green-700">
              {formatMoney(summary.deposits)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Withdrawals</p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatMoney(summary.withdrawals)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Monthly Net Amount</p>
            <p
              className={`mt-2 text-2xl font-bold ${
                netAmount < 0 ? "text-red-600" : "text-blue-700"
              }`}
            >
              {formatMoney(netAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Transaction Details
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {monthLabel} {selectedYear} · {monthlyDeposits.length} transactions
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading transactions...
          </div>
        ) : monthlyDeposits.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No transactions found for {monthLabel} {selectedYear}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">No.</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Member Number</th>
                  <th className="px-4 py-3 font-semibold">Member Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {monthlyDeposits.map((deposit, index) => {
                  const withdrawal = isWithdrawal(deposit);

                  return (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatDate(deposit.deposit_date)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {deposit.member_number ||
                          deposit.member?.member_number ||
                          "-"}
                      </td>
                      <td className="px-4 py-3">{findMemberName(deposit)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            withdrawal
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {deposit.deposit_type}
                        </span>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                          withdrawal ? "text-red-600" : "text-gray-800"
                        }`}
                      >
                        {withdrawal ? "-" : ""}
                        {formatMoney(getAmount(deposit))}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {deposit.description || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Monthly Net Amount
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {formatMoney(netAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          button, select {
            display: none !important;
          }

          .shadow-sm {
            box-shadow: none !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
          }

          table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 9px !important;
          }

          th, td {
            padding: 5px !important;
          }
        }
      `}</style>
    </div>
  );
}
