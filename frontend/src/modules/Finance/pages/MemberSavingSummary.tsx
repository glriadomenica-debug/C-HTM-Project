import { useCallback, useEffect, useMemo, useState } from "react";
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

interface MemberSaving extends Member {
  savings: number;
}

type MembershipFilter = "All" | "Active" | "Inactive";

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

const getAmount = (deposit: Deposit): number => {
  const amount = Number(deposit.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const isWithdrawal = (deposit: Deposit): boolean =>
  deposit.deposit_type?.trim().toLowerCase() === "withdrawal";

const isInactive = (member: Member): boolean =>
  member.membership_status?.trim().toLowerCase() === "inactive";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

function SummaryCard({
  title,
  value,
  description,
  color,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  color: "blue" | "green" | "purple";
  icon: React.ReactNode;
}) {
  const styles = {
    blue: {
      iconBox: "bg-blue-100 text-blue-700",
      amount: "text-blue-700",
      border: "border-blue-100",
      accent: "bg-blue-500",
    },
    green: {
      iconBox: "bg-emerald-100 text-emerald-700",
      amount: "text-emerald-700",
      border: "border-emerald-100",
      accent: "bg-emerald-500",
    },
    purple: {
      iconBox: "bg-purple-100 text-purple-700",
      amount: "text-purple-700",
      border: "border-purple-100",
      accent: "bg-purple-500",
    },
  }[color];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${styles.border} bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <p
            className={`mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl ${styles.amount}`}
          >
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.iconBox}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const inactive = status?.trim().toLowerCase() === "inactive";
  const label = status || "Active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        inactive
          ? "bg-gray-100 text-gray-600"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          inactive ? "bg-gray-400" : "bg-emerald-500"
        }`}
      />
      {label}
    </span>
  );
}

function SavingsAmount({ amount }: { amount: number }) {
  return (
    <span
      className={`font-bold tabular-nums ${
        amount < 0 ? "text-red-600" : "text-gray-900"
      }`}
    >
      {formatMoney(amount)}
    </span>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "M";

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
      {initials}
    </div>
  );
}

export default function MemberSavingsReport() {
  const [members, setMembers] = useState<Member[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MembershipFilter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
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
          "Labele atu karrega membru savings. Favor cek ita-nia koneksaun internet no koko fila-fali.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const memberSavings = useMemo<MemberSaving[]>(() => {
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
      .sort((a, b) =>
        a.member_number.localeCompare(b.member_number, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [members, deposits]);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return memberSavings.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.member_number.toLowerCase().includes(keyword) ||
        member.full_name.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && !isInactive(member)) ||
        (statusFilter === "Inactive" && isInactive(member));

      return matchesSearch && matchesStatus;
    });
  }, [memberSavings, search, statusFilter]);

  const totalSavings = useMemo(
    () => memberSavings.reduce((total, member) => total + member.savings, 0),
    [memberSavings],
  );

  const totalPositiveSavings = useMemo(
    () =>
      memberSavings.reduce(
        (total, member) => total + Math.max(member.savings, 0),
        0,
      ),
    [memberSavings],
  );
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
  };

  return (
    <div
      id="member-savings-report"
      className="min-h-screen space-y-6 bg-gray-50/70 p-4 sm:p-6 lg:p-8"
    >
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
            <span>finansas</span>
            <span>/</span>
            <span>Relatoriu</span>
            <span>/</span>
            <span className="text-blue-700">Membru Savings</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Membru Saving
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row print:hidden">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 cursor-pointer"
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
                d="m15 18-6-6 6-6M9 12h12"
              />
            </svg>
            Back
          </button>

          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed cursor-pointer disabled:opacity-50"
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

          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
            Print Relatoriu
          </button>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-red-600">
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
                  d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                />
              </svg>
            </div>

            <div>
              <p className="font-semibold text-red-800">
                Labele karrega relatoriu
              </p>
              <p className="mt-1 text-sm leading-5 text-red-700">{error}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            Koko fila-fali.
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {/* <h2 className="text-base font-bold text-gray-900 sm:text-lg">
            Member Savings Summary
          </h2> */}

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
            {members.length} membru
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Total saving husi membru sira"
            value={formatMoney(totalSavings)}
            description=""
            color={totalSavings < 0 ? "purple" : "blue"}
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
            title="Total Membru"
            value={members.length.toLocaleString("en-US")}
            description=""
            color="purple"
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

          <SummaryCard
            title="Balansu positivu "
            value={formatMoney(totalPositiveSavings)}
            description=""
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
                <circle cx="12" cy="12" r="10" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m5 12 4 4L19 6"
                />
              </svg>
            }
          />
        </div>
      </section>

      {/* Report note */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 11v5m0-8h.01"
            />
          </svg>
        </div>

        <div>
          <p className="text-sm font-semibold text-blue-900">
            Kona-ba relatoriu
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            Saldo ida-idak kalkula bazeia ba transaksaun ne'ebé rejista ba
            membru. Levantamentu osan hasai husi total saving. Total rezumu
            inklui membru hotu-hotu no la muda bainhira ita buka ka filtra
            lista.
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  Membru Savings
                </h2>

                {/* {!loading && !error && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    {filteredMembers.length} results
                  </span>
                )} */}
              </div>
              {/* 
              <p className="mt-1 text-sm text-gray-500">
                {loading
                  ? "Retrieving member records..."
                  : `Showing ${filteredMembers.length} of ${members.length} members`}
              </p> */}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row print:hidden">
              <div className="relative sm:min-w-72">
                <svg
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
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
                  placeholder="Search numeru membru ka naran.."
                  aria-label="Search members"
                  className={`${inputClass} pl-10`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as MembershipFilter)
                }
                aria-label="Filter by membership status"
                className={`${inputClass} sm:w-40`}
              >
                <option value="All">Hili Status</option>
                <option value="Active">Aktiva</option>
                <option value="Inactive">La Aktiva</option>
              </select>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!search && statusFilter === "All"}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Fila ba inisiu
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
            <p className="text-sm font-medium text-gray-700">
              Loading membru saving...
            </p>
            <p className="text-xs text-gray-400">
              Favor hein, sei halo kalkulasaun ba balansu sira.
            </p>
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Tabela saving sei mosu depois de dadus sira karrega ho susesu.
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16 16 4 4"
                />
              </svg>
            </div>

            <h3 className="mt-4 font-bold text-gray-900">
              {members.length === 0
                ? "La hetan membru ida."
                : "La iha membru ne'ebé koresponde."}
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
              {members.length === 0
                ? "Rejistu membru sira sei mosu iha-ne'e bainhira aumenta ona."
                : "Koko buka ho naran ka númeru membru seluk, ka hamoos filtru sira."}
            </p>

            {(search || statusFilter !== "All") && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Hamoos filtru
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {filteredMembers.map((member, index) => (
                <article
                  key={member.id}
                  className="rounded-xl border border-gray-100 p-4 transition hover:border-blue-100 hover:bg-blue-50/30"
                >
                  <div className="flex items-start gap-3">
                    <MemberAvatar name={member.full_name} />

                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-gray-900">
                        {member.full_name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Numeru Membru. {member.member_number}
                      </p>
                    </div>

                    <span className="text-xs text-gray-400">#{index + 1}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Status</p>
                      <StatusBadge status={member.membership_status} />
                    </div>

                    <div className="text-right">
                      <p className="mb-1 text-xs text-gray-500">Total Saving</p>
                      <SavingsAmount amount={member.savings} />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop and tablet table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-800 text-xs uppercase tracking-wide text-gray-100">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Nu.</th>
                    <th className="px-5 py-4 font-semibold">Numeru Membru</th>
                    <th className="px-5 py-4 font-semibold">Naran</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 text-right font-semibold">
                      Total Saving
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredMembers.map((member, index) => (
                    <tr
                      key={member.id}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="px-5 py-4 text-gray-400">{index + 1}</td>

                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-gray-700">
                        {member.member_number}
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {member.full_name}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={member.membership_status} />
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <SavingsAmount amount={member.savings} />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-4 text-right font-semibold text-gray-700"
                    >
                      Total Saving husi membru hotu-hotu
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <SavingsAmount amount={totalSavings} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Totals on mobile */}
            <div className="border-t border-gray-100 bg-gray-50 p-4 md:hidden">
              <p className="text-xs font-medium text-gray-500">
                Total Saving husi membru hotu-hotu
              </p>
              <p
                className={`mt-1 text-xl font-bold ${
                  totalSavings < 0 ? "text-red-600" : "text-blue-700"
                }`}
              >
                {formatMoney(totalSavings)}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Total ida-ne'e inklui membru hotu-hotu, la'ós de'it membru sira
                ne'ebé mosu depois aplika filtru.
              </p>
            </div>
          </>
        )}

        {!loading && !error && filteredMembers.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredMembers.length} of {members.length} membru
            </span>
            <span>
              Saldo sira inklui data transasaun hotu-hotu ne'ebé rejista ona.
            </span>
          </div>
        )}
      </section>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 12mm;
          }

          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          #member-savings-report,
          #member-savings-report * {
            visibility: visible !important;
          }

          #member-savings-report {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          #member-savings-report button,
          #member-savings-report input,
          #member-savings-report select,
          #member-savings-report .print\\:hidden {
            display: none !important;
          }

          #member-savings-report .shadow-sm,
          #member-savings-report .shadow-md {
            box-shadow: none !important;
          }

          #member-savings-report section {
            break-inside: auto !important;
          }

          #member-savings-report .overflow-x-auto {
            overflow: visible !important;
          }

          #member-savings-report table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 9pt !important;
          }

          #member-savings-report th,
          #member-savings-report td {
            padding: 7px !important;
          }

          #member-savings-report .md\\:hidden {
            display: none !important;
          }

          #member-savings-report .hidden.md\\:block {
            display: block !important;
          }

          #member-savings-report thead {
            display: table-header-group;
          }

          #member-savings-report tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
