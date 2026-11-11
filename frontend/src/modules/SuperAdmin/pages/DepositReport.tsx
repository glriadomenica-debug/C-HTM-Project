import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../services/api";

type DepositType = "Initial" | "Regular" | "Additional" | "Withdrawal";

interface Member {
  id: number;
  member_number: string;
  full_name: string;
  membership_status?: string;
  created_at?: string;
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

interface MonthReport {
  month: string;
  depositCount: number;
  uniqueClients: number;
  deposits: number;
  withdrawals: number;
  net: number;
  registrations: number;
}

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function getRows<T>(response: any): T[] {
  const data = response?.data?.data ?? response?.data;
  return Array.isArray(data) ? data : [];
}

function monthKey(date?: string) {
  if (!date) return "";
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dateLabel(date?: string) {
  if (!date) return "—";

  const [year, month, day] = date.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return date;

  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMemberName(deposit: Deposit, members: Member[]) {
  const member =
    deposit.member ||
    members.find((item) => item.member_number === deposit.member_number);

  return member?.full_name || "Member name unavailable";
}

export default function DepositReport() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [search, setSearch] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [depositResponse, memberResponse] = await Promise.all([
        api.get("/deposits"),
        api.get("/members"),
      ]);

      setDeposits(getRows<Deposit>(depositResponse));
      setMembers(getRows<Member>(memberResponse));
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Unable to load the report. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReportData();
  }, [fetchReportData]);

  const years = useMemo(() => {
    const values = new Set<string>();

    deposits.forEach((deposit) => {
      const key = monthKey(deposit.deposit_date);
      if (key) values.add(key.slice(0, 4));
    });

    members.forEach((member) => {
      const key = monthKey(member.created_at);
      if (key) values.add(key.slice(0, 4));
    });

    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [deposits, members]);

  const monthsForYear = useMemo(() => {
    const values = new Set<string>();

    deposits.forEach((deposit) => {
      const key = monthKey(deposit.deposit_date);

      if (key && (selectedYear === "All" || key.startsWith(selectedYear))) {
        values.add(key);
      }
    });

    members.forEach((member) => {
      const key = monthKey(member.created_at);

      if (key && (selectedYear === "All" || key.startsWith(selectedYear))) {
        values.add(key);
      }
    });

    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [deposits, members, selectedYear]);

  const report = useMemo<MonthReport[]>(() => {
    const months = new Map<string, MonthReport>();

    const addMonth = (key: string) => {
      if (!key) return undefined;

      if (!months.has(key)) {
        months.set(key, {
          month: key,
          depositCount: 0,
          uniqueClients: 0,
          deposits: 0,
          withdrawals: 0,
          net: 0,
          registrations: 0,
        });
      }

      return months.get(key)!;
    };

    deposits.forEach((deposit) => {
      const key = monthKey(deposit.deposit_date);

      if (!key) return;
      if (selectedYear !== "All" && !key.startsWith(selectedYear)) return;
      if (selectedMonth !== "All" && key !== selectedMonth) return;

      const row = addMonth(key)!;
      const amount = Number(deposit.amount) || 0;

      row.depositCount++;

      if (deposit.deposit_type === "Withdrawal") {
        row.withdrawals += amount;
        row.net -= amount;
      } else {
        row.deposits += amount;
        row.net += amount;
      }
    });

    const clientsByMonth = new Map<string, Set<string>>();

    deposits.forEach((deposit) => {
      const key = monthKey(deposit.deposit_date);

      if (!key) return;
      if (selectedYear !== "All" && !key.startsWith(selectedYear)) return;
      if (selectedMonth !== "All" && key !== selectedMonth) return;

      if (!clientsByMonth.has(key)) {
        clientsByMonth.set(key, new Set<string>());
      }

      clientsByMonth.get(key)!.add(deposit.member_number);
    });

    clientsByMonth.forEach((clients, key) => {
      const row = addMonth(key);
      if (row) row.uniqueClients = clients.size;
    });

    members.forEach((member) => {
      const key = monthKey(member.created_at);

      if (!key) return;
      if (selectedYear !== "All" && !key.startsWith(selectedYear)) return;
      if (selectedMonth !== "All" && key !== selectedMonth) return;

      const row = addMonth(key);
      if (row) row.registrations++;
    });

    return Array.from(months.values()).sort((a, b) =>
      b.month.localeCompare(a.month),
    );
  }, [deposits, members, selectedYear, selectedMonth]);

  const filteredDeposits = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return deposits
      .filter((deposit) => {
        const key = monthKey(deposit.deposit_date);

        if (!key) return false;
        if (selectedYear !== "All" && !key.startsWith(selectedYear)) {
          return false;
        }
        if (selectedMonth !== "All" && key !== selectedMonth) {
          return false;
        }

        if (!keyword) return true;

        return [
          deposit.member_number,
          getMemberName(deposit, members),
          deposit.deposit_type,
          deposit.description,
          deposit.deposit_date,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(keyword),
        );
      })
      .sort((a, b) => {
        const dateComparison = b.deposit_date.localeCompare(a.deposit_date);
        return dateComparison || b.id - a.id;
      });
  }, [deposits, members, selectedYear, selectedMonth, search]);

  const visibleReport = useMemo(() => {
    return report
      .map((row) => {
        const monthDeposits = filteredDeposits.filter(
          (deposit) => monthKey(deposit.deposit_date) === row.month,
        );

        return {
          ...row,
          visibleDepositCount: monthDeposits.length,
          visibleClients: new Set(
            monthDeposits.map((deposit) => deposit.member_number),
          ).size,
        };
      })
      .filter((row) => {
        if (!search.trim()) return true;

        return filteredDeposits.some(
          (deposit) => monthKey(deposit.deposit_date) === row.month,
        );
      });
  }, [report, filteredDeposits, search]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const key = monthKey(member.created_at);

      if (!key) return false;
      if (selectedYear !== "All" && !key.startsWith(selectedYear)) {
        return false;
      }
      if (selectedMonth !== "All" && key !== selectedMonth) {
        return false;
      }

      return true;
    });
  }, [members, selectedYear, selectedMonth]);

  const totals = useMemo(() => {
    return filteredDeposits.reduce(
      (result, deposit) => {
        const amount = Number(deposit.amount) || 0;

        if (deposit.deposit_type === "Withdrawal") {
          result.withdrawals += amount;
        } else {
          result.deposits += amount;
        }

        return result;
      },
      { deposits: 0, withdrawals: 0 },
    );
  }, [filteredDeposits]);

  const netAmount = totals.deposits - totals.withdrawals;

  const toggleMonth = (month: string) => {
    setExpandedMonths((previous) =>
      previous.includes(month)
        ? previous.filter((item) => item !== month)
        : [...previous, month],
    );
  };

  const expandAll = () => {
    setExpandedMonths(visibleReport.map((row) => row.month));
  };

  const collapseAll = () => {
    setExpandedMonths([]);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Monthly Deposit Report
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monthly deposit totals with detailed member transactions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Expand All
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Collapse All
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Print Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setSelectedMonth("All");
              setExpandedMonths([]);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="All">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Month
          </label>
          <select
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(event.target.value);
              setExpandedMonths([]);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="All">All Months</option>
            {monthsForYear.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Search Member
          </label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, member number, type..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => void fetchReportData()}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-gray-500">
          Loading report...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Registered Members</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {filteredMembers.length.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Registered in the selected period
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Deposit Transactions</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {filteredDeposits.length.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-gray-500">Includes withdrawals</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Total Deposits</p>
              <p className="mt-2 text-2xl font-bold text-green-700">
                ${money(totals.deposits)}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Net Amount</p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  netAmount < 0 ? "text-red-600" : "text-blue-700"
                }`}
              >
                ${money(netAmount)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Deposits minus withdrawals
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Monthly Deposit Summary
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Select a month to view its member-by-member transaction
                  details.
                </p>
              </div>
              <p className="text-sm text-gray-500">
                {visibleReport.length} month(s)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-800 text-xs uppercase text-white">
                  <tr>
                    <th className="px-4 py-4">No.</th>
                    <th className="px-4 py-4">Month</th>
                    <th className="px-4 py-4">Members Depositing</th>
                    <th className="px-4 py-4">Transactions</th>
                    <th className="px-4 py-4">Total Deposits</th>
                    <th className="px-4 py-4">Withdrawals</th>
                    <th className="px-4 py-4">Net Amount</th>
                    <th className="px-4 py-4 print:hidden">Details</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {visibleReport.map((row, index) => {
                    const expanded = expandedMonths.includes(row.month);
                    const monthDeposits = filteredDeposits.filter(
                      (deposit) => monthKey(deposit.deposit_date) === row.month,
                    );

                    const monthlyDepositTotal = monthDeposits.reduce(
                      (sum, deposit) =>
                        sum +
                        (deposit.deposit_type === "Withdrawal"
                          ? 0
                          : Number(deposit.amount) || 0),
                      0,
                    );

                    const monthlyWithdrawalTotal = monthDeposits.reduce(
                      (sum, deposit) =>
                        sum +
                        (deposit.deposit_type === "Withdrawal"
                          ? Number(deposit.amount) || 0
                          : 0),
                      0,
                    );

                    const monthlyNet =
                      monthlyDepositTotal - monthlyWithdrawalTotal;

                    return (
                      <>
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-gray-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-4 font-semibold text-gray-900">
                            {monthLabel(row.month)}
                          </td>
                          <td className="px-4 py-4">
                            {row.visibleClients.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            {row.visibleDepositCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 font-medium text-green-700">
                            ${money(monthlyDepositTotal)}
                          </td>
                          <td className="px-4 py-4 font-medium text-red-600">
                            ${money(monthlyWithdrawalTotal)}
                          </td>
                          <td className="px-4 py-4 font-semibold">
                            ${money(monthlyNet)}
                          </td>
                          <td className="px-4 py-4 print:hidden">
                            <button
                              type="button"
                              onClick={() => toggleMonth(row.month)}
                              className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              {expanded ? "Hide Details" : "View Members"}
                            </button>
                          </td>
                        </tr>

                        {expanded && (
                          <tr key={`${row.month}-details`}>
                            <td colSpan={8} className="bg-slate-50 p-4">
                              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <h3 className="font-semibold text-gray-900">
                                    Deposit Details — {monthLabel(row.month)}
                                  </h3>
                                  <p className="text-xs text-gray-500">
                                    Each row represents one transaction. A
                                    member may appear more than once if they
                                    made multiple transactions.
                                  </p>
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                  {monthDeposits.length} transaction(s)
                                </p>
                              </div>

                              {monthDeposits.length === 0 ? (
                                <p className="py-6 text-center text-sm text-gray-500">
                                  No transactions match the current search.
                                </p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                  <table className="w-full min-w-[750px] text-left text-sm">
                                    <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                                      <tr>
                                        <th className="px-4 py-3">No.</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">
                                          Member Number
                                        </th>
                                        <th className="px-4 py-3">
                                          Member Name
                                        </th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Amount</th>
                                        <th className="px-4 py-3">
                                          Description
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {monthDeposits.map(
                                        (deposit, detailIndex) => {
                                          const isWithdrawal =
                                            deposit.deposit_type ===
                                            "Withdrawal";

                                          return (
                                            <tr key={deposit.id}>
                                              <td className="px-4 py-3 text-gray-500">
                                                {detailIndex + 1}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                {dateLabel(
                                                  deposit.deposit_date,
                                                )}
                                              </td>
                                              <td className="px-4 py-3 font-medium text-gray-800">
                                                {deposit.member_number}
                                              </td>
                                              <td className="px-4 py-3 font-medium text-gray-900">
                                                {getMemberName(
                                                  deposit,
                                                  members,
                                                )}
                                              </td>
                                              <td className="px-4 py-3">
                                                <span
                                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    isWithdrawal
                                                      ? "bg-red-100 text-red-700"
                                                      : deposit.deposit_type ===
                                                          "Initial"
                                                        ? "bg-purple-100 text-purple-700"
                                                        : deposit.deposit_type ===
                                                            "Additional"
                                                          ? "bg-blue-100 text-blue-700"
                                                          : "bg-green-100 text-green-700"
                                                  }`}
                                                >
                                                  {deposit.deposit_type}
                                                </span>
                                              </td>
                                              <td
                                                className={`px-4 py-3 whitespace-nowrap font-semibold ${
                                                  isWithdrawal
                                                    ? "text-red-600"
                                                    : "text-gray-900"
                                                }`}
                                              >
                                                {isWithdrawal ? "−" : "+"}$
                                                {money(
                                                  Number(deposit.amount) || 0,
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-gray-600">
                                                {deposit.description || "—"}
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                    </tbody>
                                    <tfoot className="border-t-2 bg-gray-50 font-bold">
                                      <tr>
                                        <td
                                          colSpan={5}
                                          className="px-4 py-3 text-right"
                                        >
                                          Monthly totals
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <span className="text-green-700">
                                            +${money(monthlyDepositTotal)}
                                          </span>
                                          <br />
                                          <span className="text-xs text-red-600">
                                            −${money(monthlyWithdrawalTotal)}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          Net: ${money(monthlyNet)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}

                  {visibleReport.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        No transactions found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900">
              Member Registration Summary
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              New registrations by month, based on member creation date.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[450px] text-left text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3">No.</th>
                    <th className="px-4 py-3">Registration Month</th>
                    <th className="px-4 py-3">New Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report
                    .filter((row) => row.registrations > 0)
                    .map((row, index) => (
                      <tr key={row.month}>
                        <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">
                          {monthLabel(row.month)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-700">
                          {row.registrations.toLocaleString()}
                        </td>
                      </tr>
                    ))}

                  {report.every((row) => row.registrations === 0) && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No member registrations found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\\\:hidden { display: none !important; }
          button { display: none !important; }
          table { font-size: 10px !important; }
          th, td { padding: 6px !important; }
          .shadow-sm { box-shadow: none !important; }
          tr { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
