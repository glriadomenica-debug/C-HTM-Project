import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../services/api";

interface Payment {
  id: number;
  loan_id?: number;
  amount: number | string;
  payment_date: string;
  method?: string;
  payment_method?: string;
  description?: string;
}

interface Loan {
  id: number;
  member_number: string | null;
  non_member_number: string | null;
  loan_date: string;
  loan_amount: number | string;
  interest_rate?: number | string | null;
  interest_amount?: number | string | null;
  total_amount?: number | string | null;
  member?: { full_name: string } | null;
  nonmember?: { full_name: string } | null;
  payments?: Payment[];
}

const number = (value: number | string | null | undefined) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const date = (value?: string) => {
  if (!value) return "-";

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const round = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const getRate = (loan: Loan) => {
  if (loan.interest_rate != null) {
    return number(loan.interest_rate);
  }

  const amount = number(loan.loan_amount);

  if (loan.member_number) {
    if (amount < 1000) return 4;
    if (amount < 3000) return 3.5;
    if (amount < 5000) return 2.75;
    if (amount < 7500) return 2;
    if (amount < 10000) return 1.5;
    return 1;
  }

  if (amount < 5000) return 5;
  if (amount < 10000) return 4;
  return 3.5;
};

const getInterest = (loan: Loan) => {
  if (loan.interest_amount != null) {
    return number(loan.interest_amount);
  }

  return round((number(loan.loan_amount) * getRate(loan)) / 100);
};

const getTotal = (loan: Loan) => {
  if (loan.total_amount != null) {
    return number(loan.total_amount);
  }

  return round(number(loan.loan_amount) + getInterest(loan));
};

const getPaid = (loan: Loan) =>
  round(
    (loan.payments ?? []).reduce(
      (sum, payment) => sum + number(payment.amount),
      0,
    ),
  );

const getBalance = (loan: Loan) =>
  round(Math.max(0, getTotal(loan) - getPaid(loan)));

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export default function LoanReport() {
  const currentYear = new Date().getFullYear();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");

  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const [expanded, setExpanded] = useState<number[]>([]);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/loans");
      const body = response.data;
      const data = body?.data ?? body;

      if (!Array.isArray(data)) {
        throw new Error("Data invalidu");
      }

      setLoans(data as Loan[]);
    } catch {
      setError(
        "Labele atu karrega relatóriu empréstimu nian. Favor ida koko fali",
      );
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoans();
  }, [fetchLoans]);

  const availableYears = useMemo(() => {
    const years = loans
      .map((loan) => Number(loan.loan_date?.slice(0, 4)))
      .filter((year) => Number.isFinite(year) && year > 0);

    return [...new Set([currentYear, ...years])].sort((a, b) => b - a);
  }, [loans, currentYear]);

  const filteredLoans = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return loans.filter((loan) => {
      const name =
        loan.member?.full_name ??
        loan.nonmember?.full_name ??
        "Mutuariu deskonesidu";

      const borrowerNumber = loan.member_number ?? loan.non_member_number ?? "";

      const isMember = Boolean(loan.member_number);
      const paid = getPaid(loan);
      const balance = getBalance(loan);
      const total = getTotal(loan);

      const loanDate = loan.loan_date?.slice(0, 10) ?? "";
      const [loanYear, loanMonth] = loanDate.split("-");

      const matchesMonth =
        selectedMonth === "all" || loanMonth === selectedMonth;

      const matchesYear = selectedYear === "all" || loanYear === selectedYear;

      const matchesSearch =
        name.toLowerCase().includes(keyword) ||
        borrowerNumber.toLowerCase().includes(keyword) ||
        String(loan.id).includes(keyword);

      const matchesOwner =
        owner === "all" ||
        (owner === "member" && isMember) ||
        (owner === "nonmember" && !isMember);

      const matchesStatus =
        status === "all" ||
        (status === "paid" && total > 0 && balance <= 0) ||
        (status === "partial" && paid > 0 && balance > 0) ||
        (status === "unpaid" && paid <= 0 && balance > 0);

      return (
        matchesMonth &&
        matchesYear &&
        matchesSearch &&
        matchesOwner &&
        matchesStatus
      );
    });
  }, [loans, search, owner, status, selectedMonth, selectedYear]);

  const summary = useMemo(
    () =>
      filteredLoans.reduce(
        (result, loan) => {
          result.principal += number(loan.loan_amount);
          result.interest += getInterest(loan);
          result.total += getTotal(loan);
          result.paid += getPaid(loan);
          result.balance += getBalance(loan);
          result.payments += (loan.payments ?? []).length;

          return result;
        },
        {
          principal: 0,
          interest: 0,
          total: 0,
          paid: 0,
          balance: 0,
          payments: 0,
        },
      ),
    [filteredLoans],
  );

  const toggleExpanded = (id: number) => {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const resetFilters = () => {
    setSearch("");
    setSelectedMonth("all");
    setSelectedYear("all");
    setOwner("all");
    setStatus("all");
  };

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      [
        "Loan ID",
        "Borrower",
        "Borrower Number",
        "Loan Date",
        "Principal",
        "Interest Rate (%)",
        "Interest",
        "Total Loan",
        "Total Paid",
        "Outstanding",
        "Payment Date",
        "Payment Amount",
        "Payment Method",
        "Description",
      ],
    ];

    filteredLoans.forEach((loan) => {
      const name =
        loan.member?.full_name ??
        loan.nonmember?.full_name ??
        "Mutuariu deskonesidu";

      const borrowerNumber = loan.member_number ?? loan.non_member_number ?? "";

      const payments = loan.payments ?? [];

      if (payments.length === 0) {
        rows.push([
          loan.id,
          name,
          borrowerNumber,
          loan.loan_date,
          number(loan.loan_amount),
          getRate(loan),
          getInterest(loan),
          getTotal(loan),
          0,
          getBalance(loan),
          "",
          "",
          "",
          "",
        ]);
      } else {
        payments.forEach((payment) => {
          rows.push([
            loan.id,
            name,
            borrowerNumber,
            loan.loan_date,
            number(loan.loan_amount),
            getRate(loan),
            getInterest(loan),
            getTotal(loan),
            getPaid(loan),
            getBalance(loan),
            payment.payment_date,
            number(payment.amount),
            payment.method ?? payment.payment_method ?? "",
            payment.description ?? "",
          ]);
        });
      }
    });

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `chtm-loan-report-${selectedYear}-${selectedMonth}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const selectedMonthLabel =
    selectedMonth === "all"
      ? "Fulan hotu-hotu"
      : (MONTHS.find((month) => month.value === selectedMonth)?.label ??
        "Fulan hotu-hotu");

  const reportPeriod =
    selectedMonth === "all" && selectedYear === "all"
      ? "All periods"
      : `${selectedMonthLabel} ${selectedYear === "all" ? "" : selectedYear}`.trim();

  const summaryCards = [
    {
      label: "Lista Emprestimu",
      value: String(filteredLoans.length),
      description: "",
      icon: "▤",
      accent: "bg-blue-500",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      valueColor: "text-gray-900",
    },
    {
      label: "Total Montante Emprestimu (exc. funan)",
      value: money(summary.principal),
      description: "",
      icon: "$",
      accent: "bg-emerald-500",
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
    {
      label: "Total Montante Emprestimu (incl. funan)",
      value: money(summary.total),
      description: "",
      icon: "↗",
      accent: "bg-blue-600",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-700",
      valueColor: "text-blue-700",
    },
    {
      label: "Total Pagamentu",
      value: money(summary.paid),
      description: "",
      icon: "✓",
      accent: "bg-violet-500",
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      valueColor: "text-violet-700",
    },
    {
      label: "Balansu Outstading",
      value: money(summary.balance),
      description: "",
      icon: "!",
      accent: "bg-rose-500",
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      valueColor: "text-rose-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Relatoriu Emprestimu
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Relatoriu iha {reportPeriod}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void fetchLoans()}
              disabled={loading}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || filteredLoans.length === 0}
              className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || filteredLoans.length === 0}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Print Relatoriu
            </button>
          </div>
        </div>

        {/* Print Heading */}
        <div className="hidden print:block">
          <h1 className="text-2xl font-bold text-gray-900">
            C-HTM Relatoriu Emprestimu
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Peridu Relatoriu: {reportPeriod}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((item) => (
            <div
              key={item.label}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${item.accent}`} />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500">
                    {item.label}
                  </p>

                  <p
                    className={`mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl ${item.valueColor}`}
                  >
                    {item.value}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${item.iconBg} ${item.iconColor}`}
                  aria-hidden="true"
                >
                  {item.icon}
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
          <div className="mb-3">
            <h2 className="font-semibold text-gray-800">Filtru relatoriu</h2>
            {/* <p className="mt-1 text-xs text-gray-500">
              Filter by loan date, borrower type and payment status.
            </p> */}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ema nebe empresta, numeru..."
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <select
              aria-label="Filter by month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">Fulan hotu-hotu</option>
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by year"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">Tinan hotu-hotu</option>
              {availableYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by borrower type"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">Tipu membru</option>
              <option value="member">Membru</option>
              <option value="nonmember">Non-Membru</option>
            </select>

            <select
              aria-label="Filter by payment status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg cursor-pointer border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">Status hotu-hotu</option>
              <option value="paid">Selu kompletu</option>
              <option value="partial">Selu sorin</option>
              <option value="unpaid">Seidauk selu</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Fila ba inisiu
            </button>
          </div>
        </div>

        {/* Report Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              Loading relatoriu emprestimu...
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-rose-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void fetchLoans()}
                className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"
              >
                Koko fila-fali!
              </button>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="font-semibold text-gray-800">
                Dadus Emprestimu la iha.
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                La hetan dadus emprestimu ba {reportPeriod} ne'ebe hanesan ho
                filtru atual.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 print:hidden"
              >
                Fila ba inisiu
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-left">
                <thead>
                  <tr className="bg-slate-800 text-xs uppercase tracking-wide text-white">
                    {[
                      "",
                      "Nu.",
                      "Data Empresta",
                      "Naran",
                      "Montante Empresta",
                      "Funan",
                      "Total Empresta (inc. interest)",
                      "Total selu ona",
                      "Montante seidauk selu",
                      "Status",
                    ].map((heading, index) => (
                      <th
                        key={`${heading}-${index}`}
                        className="whitespace-nowrap px-4 py-4"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLoans.map((loan, index) => {
                    const name =
                      loan.member?.full_name ??
                      loan.nonmember?.full_name ??
                      "Mutuariu deskonesidu";

                    const borrowerNumber =
                      loan.member_number ?? loan.non_member_number ?? "-";

                    const paid = getPaid(loan);
                    const total = getTotal(loan);
                    const balance = getBalance(loan);
                    const isExpanded = expanded.includes(loan.id);
                    const fullyPaid = total > 0 && balance <= 0;
                    const payments = loan.payments ?? [];

                    return (
                      <Fragment key={loan.id}>
                        <tr className="transition-colors hover:bg-blue-50/60">
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(loan.id)}
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? `Hide payments for ${name}`
                                  : `Show payments for ${name}`
                              }
                              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50 print:hidden"
                            >
                              {isExpanded ? "−" : "+"}
                            </button>
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-500">
                            {index + 1}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                            {date(loan.loan_date)}
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-800">
                              {name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {borrowerNumber}
                            </p>
                            <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {loan.member_number ? "MEMBER" : "NON-MEMBER"}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums">
                            {money(number(loan.loan_amount))}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-amber-700">
                            {money(getInterest(loan))}
                            <p className="mt-1 text-xs text-gray-500">
                              {getRate(loan).toFixed(2)}%
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm font-bold tabular-nums text-blue-700">
                            {money(total)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold tabular-nums text-emerald-700">
                            {money(paid)}
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 text-sm font-bold tabular-nums text-rose-600">
                            {money(balance)}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                                fullyPaid
                                  ? "bg-emerald-50 text-emerald-700"
                                  : paid > 0
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {fullyPaid
                                ? "Paid"
                                : paid > 0
                                  ? "Partial"
                                  : "Unpaid"}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="bg-slate-50 px-5 py-5">
                              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-200 px-4 py-3">
                                  <h3 className="font-semibold text-slate-800">
                                    Istoria Pagamentu — {name}
                                  </h3>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {payments.length} Transaksaun pagamentu
                                  </p>
                                </div>

                                {payments.length === 0 ? (
                                  <p className="p-5 text-sm text-gray-500">
                                    Seidauk iha dadus pagamentu ba empréstimu
                                    ida-ne’e.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[650px] text-left">
                                      <thead>
                                        <tr className="bg-slate-100 text-xs uppercase text-slate-600">
                                          <th className="px-4 py-3">Nu.</th>
                                          <th className="px-4 py-3">
                                            Data pagamentu
                                          </th>
                                          <th className="px-4 py-3">
                                            Metodu pagamentu
                                          </th>
                                          <th className="px-4 py-3 text-right">
                                            Montante
                                          </th>
                                          <th className="px-4 py-3">
                                            Deskrisaun
                                          </th>
                                        </tr>
                                      </thead>

                                      <tbody className="divide-y divide-slate-100">
                                        {[...payments]
                                          .sort((a, b) =>
                                            (
                                              a.payment_date ?? ""
                                            ).localeCompare(
                                              b.payment_date ?? "",
                                            ),
                                          )
                                          .map((payment, paymentIndex) => (
                                            <tr key={payment.id}>
                                              <td className="px-4 py-3 text-sm text-gray-500">
                                                {paymentIndex + 1}
                                              </td>
                                              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                                {date(payment.payment_date)}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-gray-700">
                                                {payment.method ??
                                                  payment.payment_method ??
                                                  "-"}
                                              </td>
                                              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-emerald-700">
                                                {money(number(payment.amount))}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-gray-600">
                                                {payment.description || "-"}
                                              </td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredLoans.length}
              </span>{" "}
              loan record{filteredLoans.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-slate-400">{reportPeriod}</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background: white !important;
          }

          button,
          input,
          select {
            display: none !important;
          }

          .min-h-screen {
            min-height: auto !important;
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
          }

          th,
          td {
            padding: 6px !important;
            font-size: 10px !important;
          }

          tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
