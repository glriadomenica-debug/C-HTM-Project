import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Printer,
  Download,
  Search,
  ReceiptText,
  Wallet,
  Landmark,
  CreditCard,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import api from "../../../services/api";

type PaymentMethod = "Cash" | "Bank Transfer";
type BorrowerType = "Member" | "Non-Member";
type PaymentStatus = "Fully Paid" | "Outstanding";

interface Borrower {
  id: number;
  full_name: string;
  member_number?: string | null;
  non_member_number?: string | null;
}

interface Loan {
  id: number;
  member_number?: string | null;
  non_member_number?: string | null;
  loan_date?: string;
  loan_amount: number | string;
  interest_rate?: number | string | null;
  interest_percentage?: number | string | null;
  interest?: number | string | null;
  interest_amount?: number | string | null;
  total_amount?: number | string | null;
  total_loan_amount?: number | string | null;
  member?: Borrower | null;
  nonmember?: Borrower | null;
}

interface LoanPayment {
  id: number;
  loan_id: number;
  amount: number | string;
  payment_date: string;
  payment_method?: PaymentMethod;
  method?: PaymentMethod;
  description?: string | null;
  loan?: Loan | null;
}

interface PaymentReportRow {
  payment: LoanPayment;
  loan: Loan | null;
  borrowerName: string;
  borrowerNumber: string;
  borrowerType: BorrowerType;
  loanTotal: number;
  cumulativePaid: number;
  balanceAfterPayment: number;
  currentBalance: number;
  statusAfterPayment: PaymentStatus;
}

interface ApiError {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
}

const getResponseData = <T,>(response: unknown): T => {
  const result = response as {
    data?: {
      data?: T;
    } & T;
  };

  const body = result?.data;

  if (body && typeof body === "object" && "data" in body) {
    return body.data as T;
  }

  return body as T;
};

const toNumber = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getPaymentMethod = (payment: LoanPayment): PaymentMethod | "-" =>
  payment.payment_method || payment.method || "-";

const getBorrowerName = (loan: Loan | null): string => {
  if (!loan) return "Borrower unavailable";

  return (
    loan.member?.full_name ||
    loan.nonmember?.full_name ||
    (loan.member_number
      ? `Member ${loan.member_number}`
      : loan.non_member_number
        ? `Non-Member ${loan.non_member_number}`
        : "Mutuariu deskonesidu")
  );
};

const getBorrowerNumber = (loan: Loan | null): string => {
  return loan?.member_number || loan?.non_member_number || "-";
};

const getBorrowerType = (loan: Loan | null): BorrowerType => {
  return loan?.member_number ? "Member" : "Non-Member";
};

/**
 * Use the saved total amount including interest when available.
 * Otherwise calculate using the same interest tiers as Loan Management.
 */
const getLoanTotal = (loan: Loan | null): number => {
  if (!loan) return 0;

  const principal = toNumber(loan.loan_amount);
  const storedTotal = toNumber(loan.total_amount ?? loan.total_loan_amount);

  if (storedTotal > principal) {
    return roundMoney(storedTotal);
  }

  const savedInterest = toNumber(loan.interest_amount ?? loan.interest);

  if (savedInterest > 0) {
    return roundMoney(principal + savedInterest);
  }

  let rate = toNumber(loan.interest_rate ?? loan.interest_percentage);

  if (rate <= 0) {
    if (loan.member_number) {
      if (principal < 1000) rate = 4;
      else if (principal < 3000) rate = 3.5;
      else if (principal < 5000) rate = 2.75;
      else if (principal < 7500) rate = 2;
      else if (principal < 10000) rate = 1.5;
      else rate = 1;
    } else {
      if (principal < 5000) rate = 5;
      else if (principal < 10000) rate = 4;
      else rate = 3.5;
    }
  }

  return roundMoney(principal + (principal * rate) / 100);
};

const getErrorMessage = (error: unknown) => {
  const err = error as ApiError;

  return (
    err.response?.data?.message ||
    err.message ||
    "Unable to load payment report."
  );
};

const currentYear = String(new Date().getFullYear());

const monthOptions = [
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

export default function LoanPayReport() {
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [loanWarning, setLoanWarning] = useState("");

  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [borrowerFilter, setBorrowerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    setLoanWarning("");

    try {
      // Payment records are the primary data for this report.
      // Loans are only supplementary borrower/loan information.
      const [paymentResult, loanResult] = await Promise.allSettled([
        api.get("/loanpayments"),
        api.get("/loans"),
      ]);

      if (paymentResult.status === "rejected") {
        throw paymentResult.reason;
      }

      const paymentData = getResponseData<LoanPayment[]>(paymentResult.value);

      setPayments(Array.isArray(paymentData) ? paymentData : []);

      if (loanResult.status === "fulfilled") {
        const loanData = getResponseData<Loan[]>(loanResult.value);
        setLoans(Array.isArray(loanData) ? loanData : []);
      } else {
        // Payment records remain visible if supplementary loan data fails.
        setLoans([]);
        setLoanWarning(
          "Loan details could not be loaded. Some borrower names or loan totals may be unavailable.",
        );
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const loanById = useMemo(() => {
    const result = new Map<number, Loan>();

    loans.forEach((loan) => {
      result.set(Number(loan.id), loan);
    });

    return result;
  }, [loans]);

  /**
   * Resolve each payment to its loan.
   * Calculate cumulative paid in payment-date order so the report
   * shows the balance after each individual payment.
   */
  const allPaymentRows = useMemo(() => {
    const orderedPayments = [...payments].sort((a, b) => {
      const dateCompare = (a.payment_date || "").localeCompare(
        b.payment_date || "",
      );

      if (dateCompare !== 0) return dateCompare;

      return Number(a.id) - Number(b.id);
    });

    const cumulativeByLoan = new Map<number, number>();
    const rows: PaymentReportRow[] = [];

    for (const payment of orderedPayments) {
      const loan =
        loanById.get(Number(payment.loan_id)) || payment.loan || null;

      const loanId = Number(payment.loan_id);
      const previousPaid = cumulativeByLoan.get(loanId) || 0;
      const cumulativePaid = roundMoney(
        previousPaid + toNumber(payment.amount),
      );

      cumulativeByLoan.set(loanId, cumulativePaid);

      const loanTotal = getLoanTotal(loan);
      const balanceAfterPayment = roundMoney(
        Math.max(0, loanTotal - cumulativePaid),
      );

      rows.push({
        payment,
        loan,
        borrowerName: getBorrowerName(loan),
        borrowerNumber: getBorrowerNumber(loan),
        borrowerType: getBorrowerType(loan),
        loanTotal,
        cumulativePaid,
        balanceAfterPayment,
        currentBalance: 0,
        statusAfterPayment:
          balanceAfterPayment <= 0.009 ? "Fully Paid" : "Outstanding",
      });
    }

    // Current balance/status use all payments, not only the selected month.
    const totalPaidByLoan = new Map<number, number>();

    payments.forEach((payment) => {
      const loanId = Number(payment.loan_id);
      totalPaidByLoan.set(
        loanId,
        roundMoney(
          (totalPaidByLoan.get(loanId) || 0) + toNumber(payment.amount),
        ),
      );
    });

    return rows
      .map((row) => {
        const loanId = Number(row.payment.loan_id);
        const totalPaid = totalPaidByLoan.get(loanId) || 0;
        const currentBalance = roundMoney(
          Math.max(0, row.loanTotal - totalPaid),
        );

        return {
          ...row,
          currentBalance,
        };
      })
      .reverse();
  }, [payments, loanById]);

  const availableYears = useMemo(() => {
    const years = new Set(
      payments
        .map((payment) => payment.payment_date?.slice(0, 4))
        .filter((year): year is string => Boolean(year)),
    );

    years.add(currentYear);

    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [payments]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return allPaymentRows.filter((row) => {
      const payment = row.payment;
      const paymentDate = payment.payment_date || "";
      const paymentMonth = paymentDate.slice(5, 7);
      const paymentYear = paymentDate.slice(0, 4);
      const method = getPaymentMethod(payment);

      const matchesSearch =
        !keyword ||
        row.borrowerName.toLowerCase().includes(keyword) ||
        row.borrowerNumber.toLowerCase().includes(keyword) ||
        String(payment.id).includes(keyword) ||
        String(payment.loan_id).includes(keyword) ||
        String(payment.amount).includes(keyword) ||
        (payment.description || "").toLowerCase().includes(keyword);

      const matchesMonth =
        selectedMonth === "All" || paymentMonth === selectedMonth;

      const matchesYear =
        selectedYear === "All" || paymentYear === selectedYear;

      const matchesMethod = methodFilter === "All" || method === methodFilter;

      const matchesBorrower =
        borrowerFilter === "All" || row.borrowerType === borrowerFilter;

      const matchesStatus =
        statusFilter === "All" || row.statusAfterPayment === statusFilter;

      return (
        matchesSearch &&
        matchesMonth &&
        matchesYear &&
        matchesMethod &&
        matchesBorrower &&
        matchesStatus
      );
    });
  }, [
    allPaymentRows,
    search,
    selectedMonth,
    selectedYear,
    methodFilter,
    borrowerFilter,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const cash = filteredRows.reduce(
      (sum, row) =>
        sum +
        (getPaymentMethod(row.payment) === "Cash"
          ? toNumber(row.payment.amount)
          : 0),
      0,
    );

    const bankTransfer = filteredRows.reduce(
      (sum, row) =>
        sum +
        (getPaymentMethod(row.payment) === "Bank Transfer"
          ? toNumber(row.payment.amount)
          : 0),
      0,
    );

    return {
      transactionCount: filteredRows.length,
      totalCollected: roundMoney(
        filteredRows.reduce(
          (sum, row) => sum + toNumber(row.payment.amount),
          0,
        ),
      ),
      cash: roundMoney(cash),
      bankTransfer: roundMoney(bankTransfer),
      loanCount: new Set(filteredRows.map((row) => Number(row.payment.loan_id)))
        .size,
    };
  }, [filteredRows]);

  const exportCsv = () => {
    const headers = [
      "ID Pagamentu",
      "Data Pagamentu",
      "Naran Mutuariu",
      "Tipu Mutuariu",
      "Numeru Mutuariu",
      "ID Empresta",
      "Total Empresta (inc. funan)",
      "Montante Pagamentu",
      "Pagamentu ne'ebe simu ona",
      "Montante tenki selu",
      "Metodu Pagamentu",
      "Status",
      "Deskrisaun",
    ];

    const csvRows = filteredRows.map((row) => [
      row.payment.id,
      row.payment.payment_date,
      row.borrowerName,
      row.borrowerType,
      row.borrowerNumber,
      row.payment.loan_id,
      row.loan ? row.loanTotal.toFixed(2) : "",
      toNumber(row.payment.amount).toFixed(2),
      row.cumulativePaid.toFixed(2),
      row.loan ? row.balanceAfterPayment.toFixed(2) : "",
      getPaymentMethod(row.payment),
      row.loan ? row.statusAfterPayment : "Dadus  emprestimu la disponivel",
      row.payment.description || "",
    ]);

    const escapeCsv = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csv = [headers, ...csvRows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `loan-payment-report-${selectedYear}-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const inputClass =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const resetFilters = () => {
    setSearch("");
    setSelectedMonth("All");
    setSelectedYear("All");
    setMethodFilter("All");
    setBorrowerFilter("All");
    setStatusFilter("All");
  };

  return (
    <div className="min-w-0 space-y-5 p-3 sm:p-5 lg:p-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
            C-HTM / Jestaun Finanseiru
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Relatoriu Pagamentu
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || filteredRows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Errors and warnings */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Labele atu karrega rejistu pagamentu sira
            </p>
            <p className="mt-1">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void fetchReport()}
              className="mt-2 font-semibold underline"
            >
              Koko fila-fali
            </button>
          </div>
        </div>
      )}

      {loanWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loanWarning}
        </div>
      )}

      {/* Payment-focused summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Transaksaun pagamentu"
          value={String(summary.transactionCount)}
          subtitle=""
          icon={<ReceiptText size={21} />}
          color="blue"
        />

        <SummaryCard
          title="Total Pagamentu"
          value={formatCurrency(summary.totalCollected)}
          subtitle=""
          icon={<Wallet size={21} />}
          color="green"
        />

        <SummaryCard
          title="Pagamentu Kas"
          value={formatCurrency(summary.cash)}
          subtitle=""
          icon={<CreditCard size={21} />}
          color="violet"
        />

        <SummaryCard
          title="Pagamentu husi Bank"
          value={formatCurrency(summary.bankTransfer)}
          subtitle=""
          icon={<Landmark size={21} />}
          color="amber"
        />
      </div>

      {/* Filters */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5 print:hidden">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-slate-900">
              Lista Pagamentu
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="sm:col-span-2 xl:col-span-2">
              <label
                htmlFor="payment-report-search"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Search
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="payment-report-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder=""
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="payment-report-month"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Fulan Pagamentu
              </label>
              <select
                id="payment-report-month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className={inputClass}
              >
                <option value="All">Hili-Fulan</option>
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="payment-report-year"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Tinan Pagamentu
              </label>
              <select
                id="payment-report-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
                className={inputClass}
              >
                <option value="All">Hili Tinan</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="payment-report-method"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Metodu Pagamentu
              </label>
              <select
                id="payment-report-method"
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value)}
                className={inputClass}
              >
                <option value="All">Hili Metodu Pagamentu</option>
                <option value="Cash">Kas</option>
                <option value="Bank Transfer">Transfer husi Bank</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="payment-report-borrower"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Tipu empresta
              </label>
              <select
                id="payment-report-borrower"
                value={borrowerFilter}
                onChange={(event) => setBorrowerFilter(event.target.value)}
                className={inputClass}
              >
                <option value="All">Hili</option>
                <option value="Member">Membru</option>
                <option value="Non-Member">Non-Membru</option>
              </select>
            </div>

            <div className="sm:col-span-2 xl:col-span-1">
              <label
                htmlFor="payment-report-status"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Status pagamentu
              </label>
              <select
                id="payment-report-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass}
              >
                <option value="All">Hili status</option>
                <option value="Outstanding">Seidauk selu</option>
                <option value="Fully Paid">Selu kompletu</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900"
            >
              Fila ba inisiu
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Loading transaksaun pagamentu...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            Relatóriu pagamentu seidauk disponivel tanba sistema seidauk bele
            karrega rejistu pagamentu sira.{" "}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <CalendarDays size={22} />
            </div>
            <h3 className="mt-3 font-semibold text-slate-900">
              La iha dadus pagamentu.
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Koko fila-fali filtru seluk
            </p>
          </div>
        ) : (
          <>
            {/* Mobile transaction cards */}
            <div className="space-y-3 p-3 md:hidden">
              {filteredRows.map((row) => (
                <article
                  key={row.payment.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {row.borrowerName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.borrowerType} · {row.borrowerNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Pagamentu #{row.payment.id} · Emprestimu #
                        {row.payment.loan_id}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                        row.statusAfterPayment === "Fully Paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.statusAfterPayment}
                    </span>
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        Data Pagamentu
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {formatDate(row.payment.payment_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        Total Emprestimu incl. funan
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {row.loan ? formatCurrency(row.loanTotal) : "-"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2.5">
                      <span className="text-xs font-medium text-emerald-800">
                        Montante Pagamentu
                      </span>
                      <span className="text-base font-bold text-emerald-700">
                        {formatCurrency(toNumber(row.payment.amount))}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[11px] text-slate-500">
                          Pagamentu ne'ebe simu ona
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                          {formatCurrency(row.cumulativePaid)}
                        </p>
                      </div>

                      <div className="rounded-lg bg-amber-50 p-2.5">
                        <p className="text-[11px] text-amber-700">
                          Balansu depoisde pagamentu
                        </p>
                        <p className="mt-1 break-words text-sm font-semibold text-amber-800">
                          {row.loan
                            ? formatCurrency(row.balanceAfterPayment)
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          getPaymentMethod(row.payment) === "Cash"
                            ? "bg-violet-50 text-violet-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {getPaymentMethod(row.payment)}
                      </span>

                      <span className="max-w-[60%] truncate text-right text-xs text-slate-500">
                        {row.payment.description || "No description"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop/tablet transaction table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="bg-slate-800 text-xs uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-4 py-3.5">Nu.</th>
                    <th className="px-4 py-3.5">Data Pagamentu</th>
                    <th className="px-4 py-3.5">Naran</th>
                    <th className="px-4 py-3.5 text-right">
                      Total Emprestimu
                      <span className="mt-1 block text-[10px] font-normal normal-case text-slate-300">
                        Incl. funan
                      </span>
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      Montante Pagamentu
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      Pagamentu ne'ebe simu ona
                    </th>
                    <th className="px-4 py-3.5 text-right">
                      Montante tenki selu
                    </th>
                    <th className="px-4 py-3.5">Metodu Pagamentu</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Deskrisaun</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row, index) => (
                    <tr
                      key={row.payment.id}
                      className="transition hover:bg-blue-50/40"
                    >
                      <td className="px-4 py-4 text-slate-500">{index + 1}</td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {formatDate(row.payment.payment_date)}
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {row.borrowerName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.borrowerType} · {row.borrowerNumber}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-slate-800">
                        {row.loan ? formatCurrency(row.loanTotal) : "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-emerald-700">
                        {formatCurrency(toNumber(row.payment.amount))}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                        {formatCurrency(row.cumulativePaid)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-amber-700">
                        {row.loan
                          ? formatCurrency(row.balanceAfterPayment)
                          : "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            getPaymentMethod(row.payment) === "Cash"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {getPaymentMethod(row.payment)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {row.loan ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              row.statusAfterPayment === "Fully Paid"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {row.statusAfterPayment}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Dadus emprestimu la disponivel
                          </span>
                        )}
                      </td>

                      <td className="max-w-56 px-4 py-4 text-slate-600">
                        <span className="block truncate">
                          {row.payment.description || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                  <tr>
                    <td colSpan={5} className="px-4 py-4">
                      TOTAL BAZEIA BA FILTER PAGAMENTU
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                      {formatCurrency(summary.totalCollected)}
                    </td>
                    <td
                      colSpan={5}
                      className="px-4 py-4 text-xs font-medium text-slate-500"
                    >
                      {summary.transactionCount} Transaksaun pagamentu
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:px-5">
              Showing {filteredRows.length} of {payments.length} payment
              transactions.
            </div>
          </>
        )}
      </section>

      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }

          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print\\\\:hidden {
            display: none !important;
          }

          section {
            box-shadow: none !important;
            overflow: visible !important;
          }

          table {
            font-size: 9px !important;
          }

          thead {
            display: table-header-group;
          }

          tr {
            break-inside: avoid;
          }

          .md\\\\:hidden {
            display: none !important;
          }

          .md\\\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "violet" | "amber";
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: SummaryCardProps) {
  const colors = {
    blue: {
      accent: "bg-blue-500",
      icon: "bg-blue-50 text-blue-600",
      value: "text-slate-900",
    },
    green: {
      accent: "bg-emerald-500",
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-emerald-700",
    },
    violet: {
      accent: "bg-violet-500",
      icon: "bg-violet-50 text-violet-600",
      value: "text-violet-700",
    },
    amber: {
      accent: "bg-amber-500",
      icon: "bg-amber-50 text-amber-600",
      value: "text-amber-700",
    },
  };

  const style = colors[color];

  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p
            className={`mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl ${style.value}`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
        {subtitle}
      </p>
    </article>
  );
}
