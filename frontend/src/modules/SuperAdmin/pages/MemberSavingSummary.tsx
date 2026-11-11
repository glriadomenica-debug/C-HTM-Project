import { useEffect, useMemo, useState } from "react";
import api from "../../../services/api";

interface Member {
  id: number;
  member_number: string;
  full_name: string;
  membership_status?: string;
}

interface Deposit {
  id: number;
  member_number?: string;
  amount: number | string;
  deposit_type: string;
  member?: {
    member_number?: string;
  } | null;
}

const getRows = <T,>(response: any): T[] => {
  const body = response?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;

  return [];
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const getAmount = (deposit: Deposit) => {
  const amount = Number(deposit.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const isWithdrawal = (deposit: Deposit) =>
  deposit.deposit_type?.trim().toLowerCase() === "withdrawal";

export default function MemberSavingsReport() {
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const [memberResponse, depositResponse] = await Promise.all([
          api.get("/members"),
          api.get("/deposits"),
        ]);

        setMembers(getRows<Member>(memberResponse));
        setDeposits(getRows<Deposit>(depositResponse));
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            "Failed to load member savings data. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate each member's savings using all recorded transactions.
  const memberSavings = useMemo(() => {
    const balances = new Map<string, number>();

    deposits.forEach((deposit) => {
      const memberNumber =
        deposit.member_number || deposit.member?.member_number;

      if (!memberNumber) return;

      const amount = getAmount(deposit);
      const currentBalance = balances.get(memberNumber) ?? 0;

      balances.set(
        memberNumber,
        currentBalance + (isWithdrawal(deposit) ? -amount : amount),
      );
    });

    return members
      .map((member) => ({
        ...member,
        savings: balances.get(member.member_number) ?? 0,
      }))
      .sort((a, b) => a.member_number.localeCompare(b.member_number));
  }, [members, deposits]);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return memberSavings;

    return memberSavings.filter(
      (member) =>
        member.member_number.toLowerCase().includes(keyword) ||
        member.full_name.toLowerCase().includes(keyword),
    );
  }, [memberSavings, search]);

  // Overall total remains based on all members, even when searching.
  const totalSavings = memberSavings.reduce(
    (total, member) => total + member.savings,
    0,
  );

  const totalPositiveSavings = memberSavings.reduce(
    (total, member) => total + Math.max(member.savings, 0),
    0,
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Member Savings Summary
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Current savings balance for every C-HTM member.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 print:hidden"
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
              d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 14h12v7H6z"
            />
          </svg>
          Print Report
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Total savings card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <p className="text-sm font-medium text-blue-700">
          Net Savings of All Members in C-HTM
        </p>

        <p className="mt-2 text-3xl font-bold tracking-tight text-blue-900">
          {formatMoney(totalSavings)}
        </p>

        <p className="mt-2 text-xs text-blue-700">
          Total recorded deposits minus withdrawals across all months.
        </p>
      </div>

      {/* Additional summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="mt-2 text-2xl font-bold text-gray-800">
            {members.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">
            Sum of Positive Member Balances
          </p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatMoney(totalPositiveSavings)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm print:hidden">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 4 4" />
        </svg>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search member number or name..."
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Member balances table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Individual Member Savings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Showing {filteredMembers.length} of {members.length} members.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading member savings...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Member balances are unavailable until the data loads successfully.
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No matching members found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">No.</th>
                  <th className="px-4 py-3 font-semibold">Member Number</th>
                  <th className="px-4 py-3 font-semibold">Member Name</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Total Savings
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((member, index) => (
                  <tr key={member.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{index + 1}</td>

                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                      {member.member_number}
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-800">
                      {member.full_name}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.membership_status?.toLowerCase() === "inactive"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {member.membership_status || "Active"}
                      </span>
                    </td>

                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                        member.savings < 0 ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {formatMoney(member.savings)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-right font-semibold text-gray-700"
                  >
                    Net Savings of All Members
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-blue-700">
                    {formatMoney(totalSavings)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          button, input {
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
