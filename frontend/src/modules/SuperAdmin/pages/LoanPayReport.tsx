import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import api from "../../../services/api";

type PaymentMethod = "Cash" | "Bank Transfer";

interface Borrower {
  id: number;
  full_name: string;
  member_number?: string | null;
  non_member_number?: string | null;
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

interface Loan {
  id: number;
  member_number: string | null;
  non_member_number: string | null;
  loan_date: string;
  loan_amount: number | string;
  interest_rate?: number | string | null;
  interest_percentage?: number | string | null;
  interest?: number | string | null;
  interest_amount?: number | string | null;
  total_amount?: number | string | null;
  total_loan_amount?: number | string | null;
  member?: Borrower | null;
  nonmember?: Borrower | null;
  payments?: LoanPayment[];
}

interface ReportLoan extends Loan {
  reportPayments: LoanPayment[];
}

const getResponseData = <T,>(response: unknown): T => {
  const result = response as {
    data?: { data?: T } & T;
  };

  const body = result?.data;

  if (body && typeof body === "object" && "data" in body) {
    return body.data as T;
  }

  return body as T;
};

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

const getBorrowerName = (loan: Loan) =>
  loan.member?.full_name ||
  loan.nonmember?.full_name ||
  (loan.member_number
    ? `Member ${loan.member_number}`
    : loan.non_member_number
      ? `Non-Member ${loan.non_member_number}`
      : "Unknown borrower");

const getBorrowerNumber = (loan: Loan) =>
  loan.member_number || loan.non_member_number || "-";

const getBorrowerType = (loan: Loan): "Member" | "Non-Member" =>
  loan.member_number ? "Member" : "Non-Member";

const getLoanTotal = (loan: Loan): number => {
  const principal = toNumber(loan.loan_amount);
  const storedTotal = toNumber(loan.total_amount ?? loan.total_loan_amount);

  // Use the saved total when it includes interest.
  if (storedTotal >= principal && storedTotal > 0) {
    return roundMoney(storedTotal);
  }

  const savedRate = toNumber(loan.interest_rate ?? loan.interest_percentage);

  let rate = savedRate;

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

  const savedInterest = toNumber(loan.interest_amount ?? loan.interest);

  const interest =
    savedInterest > 0 ? savedInterest : roundMoney((principal * rate) / 100);

  return roundMoney(principal + interest);
};

const getLoanPaid = (loan: ReportLoan): number =>
  roundMoney(
    loan.reportPayments.reduce(
      (sum, payment) => sum + toNumber(payment.amount),
      0,
    ),
  );

const getLoanBalance = (loan: ReportLoan) =>
  roundMoney(Math.max(0, getLoanTotal(loan) - getLoanPaid(loan)));

const isFullyPaid = (loan: ReportLoan) => getLoanBalance(loan) <= 0.009;

const getPaymentMethod = (payment: LoanPayment) =>
  payment.payment_method || payment.method || "-";

export default function LoanPayReport() {
  const [loans, setLoans] = useState<ReportLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [borrowerFilter, setBorrowerFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedLoans, setExpandedLoans] = useState<Record<number, boolean>>(
    {},
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [loanResult, paymentResult] = await Promise.allSettled([
        api.get("/loans"),
        api.get("/loanpayments"),
      ]);

      if (loanResult.status === "rejected") {
        throw loanResult.reason;
      }

      const loanData = getResponseData<Loan[]>(loanResult.value);

      const paymentData =
        paymentResult.status === "fulfilled"
          ? getResponseData<LoanPayment[]>(paymentResult.value)
          : [];

      const loanList = Array.isArray(loanData) ? loanData : [];
      const paymentList = Array.isArray(paymentData) ? paymentData : [];

      const reportLoans: ReportLoan[] = loanList.map((loan) => {
        const listedPayments = paymentList.filter(
          (payment) => Number(payment.loan_id) === Number(loan.id),
        );

        // Prefer the payment endpoint. Fall back to nested payments
        // only when the endpoint has no records for this loan.
        const loanPayments =
          listedPayments.length > 0 ? listedPayments : loan.payments || [];

        return {
          ...loan,
          reportPayments: [...loanPayments].sort(
            (a, b) =>
              new Date(b.payment_date).getTime() -
              new Date(a.payment_date).getTime(),
          ),
        };
      });

      setLoans(reportLoans);

      if (paymentResult.status === "rejected") {
        setErrorMessage(
          "Payment records could not be loaded. The report may show only payments included in the loan records.",
        );
      }
    } catch (error) {
      const err = error as {
        response?: { data?: { message?: string } };
        message?: string;
      };

      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          "Unable to load the loan report.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const filteredLoans = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return loans.filter((loan) => {
      const matchesSearch =
        !keyword ||
        getBorrowerName(loan).toLowerCase().includes(keyword) ||
        getBorrowerNumber(loan).toLowerCase().includes(keyword) ||
        String(loan.id).includes(keyword);

      const matchesBorrower =
        borrowerFilter === "All" || getBorrowerType(loan) === borrowerFilter;

      const fullyPaid = isFullyPaid(loan);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Fully Paid" && fullyPaid) ||
        (statusFilter === "Outstanding" && !fullyPaid);

      return matchesSearch && matchesBorrower && matchesStatus;
    });
  }, [loans, search, borrowerFilter, statusFilter]);

  const summary = useMemo(
    () =>
      filteredLoans.reduce(
        (result, loan) => {
          result.principal += toNumber(loan.loan_amount);
          result.totalLoan += getLoanTotal(loan);
          result.totalPaid += getLoanPaid(loan);
          result.balance += getLoanBalance(loan);
          result.paymentCount += loan.reportPayments.length;

          return result;
        },
        {
          principal: 0,
          totalLoan: 0,
          totalPaid: 0,
          balance: 0,
          paymentCount: 0,
        },
      ),
    [filteredLoans],
  );

  const toggleLoan = (loanId: number) => {
    setExpandedLoans((previous) => ({
      ...previous,
      [loanId]: !previous[loanId],
    }));
  };

  const buttonClass =
    "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Loan Payment Report
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={loading}
            className={buttonClass} 
          >
            <span className="inline-flex items-center gap-2">
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
                  d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"
                />
              </svg>
              {loading ? "Refreshing..." : "Refresh"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
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
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold">
            !
          </span>
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Loans"
          value={String(filteredLoans.length)}
          description=""
          icon="▤"
          accent="bg-blue-500"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          valueColor="text-gray-900"
        />

        <SummaryCard
          title="Total Loan Amount (excl. interest)"
          value={formatCurrency(summary.principal)}
          description=""
          icon="$"
          accent="bg-indigo-500"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          valueColor="text-indigo-700"
        />

        <SummaryCard
          title="Total Loan Amount (incl. interest)"
          value={formatCurrency(summary.totalLoan)}
          description=""
          icon="↗"
          accent="bg-violet-500"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          valueColor="text-violet-700"
        />

        <SummaryCard
          title="Total Payments"
          value={formatCurrency(summary.totalPaid)}
          description=""
          icon="✓"
          accent="bg-emerald-500"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          valueColor="text-emerald-700"
        />

        <SummaryCard
          title="Outstanding Balance"
          value={formatCurrency(summary.balance)}
          description=""
          icon="◷"
          accent="bg-amber-500"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          valueColor="text-amber-700"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5 print:hidden">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              All Loan Records
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="loan-report-search"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Search
              </label>
              <div className="relative">
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
                    d="m20 20-4-4"
                  />
                </svg>
                <input
                  id="loan-report-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Borrower, number, or loan ID..."
                  className="w-full cursor-pointer rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="loan-report-borrower"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Borrower Type
              </label>
              <select
                id="loan-report-borrower"
                value={borrowerFilter}
                onChange={(event) => setBorrowerFilter(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Borrowers</option>
                <option value="Member">Members</option>
                <option value="Non-Member">Non-Members</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="loan-report-status"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Loan Status
              </label>
              <select
                id="loan-report-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="All">All Statuses</option>
                <option value="Outstanding">Outstanding</option>
                <option value="Fully Paid">Fully Paid</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="mt-3 text-sm text-gray-500">Loading loan report...</p>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500">
              $
            </div>
            <h3 className="mt-3 font-semibold text-gray-900">
              No loan records found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try changing the search or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">No.</th>
                  <th className="px-4 py-3.5 font-semibold">Loan Date</th>
                  <th className="px-4 py-3.5 font-semibold">Borrower</th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Loan Amount
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Loan Amount
                    <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-slate-300">
                      Incl. interest
                    </span>
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Total Paid
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold">
                    Balance
                  </th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-center font-semibold">
                    Payments
                  </th>
                  <th className="px-4 py-3.5 font-semibold print:hidden">
                    Details
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredLoans.map((loan, index) => {
                  const paid = getLoanPaid(loan);
                  const total = getLoanTotal(loan);
                  const balance = getLoanBalance(loan);
                  const fullyPaid = isFullyPaid(loan);
                  const expanded = Boolean(expandedLoans[loan.id]);

                  return (
                    <Fragment key={loan.id}>
                      <tr className="transition hover:bg-blue-50/40">
                        <td className="px-4 py-4 font-semibold text-gray-900">
                          {index + 1}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                          {formatDate(loan.loan_date)}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">
                            {getBorrowerName(loan)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {getBorrowerType(loan)} · {getBorrowerNumber(loan)}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            Loan #{loan.id}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-gray-700">
                          {formatCurrency(toNumber(loan.loan_amount))}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(total)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-emerald-700">
                          {formatCurrency(paid)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-amber-700">
                          {formatCurrency(balance)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              fullyPaid
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                fullyPaid ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            {fullyPaid ? "Fully Paid" : "Outstanding"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {loan.reportPayments.length}
                          </span>
                        </td>

                        <td className="px-4 py-4 print:hidden">
                          <button
                            type="button"
                            onClick={() => toggleLoan(loan.id)}
                            aria-expanded={expanded}
                            className="whitespace-nowrap rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-500 hover:bg-blue-50 cursor-pointer"
                          >
                            {expanded ? "Hide Payments ↑" : "View Payments ↓"}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr>
                          <td colSpan={10} className="bg-gray-50 px-4 py-5">
                            <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                              <div>
                                <h3 className="font-semibold text-gray-900">
                                  Payment History — Loan #{loan.id}
                                </h3>
                                <p className="mt-1 text-xs text-gray-500">
                                  {getBorrowerName(loan)} ·{" "}
                                  {loan.reportPayments.length} payment(s)
                                </p>
                              </div>

                              <p className="text-sm font-semibold text-emerald-700">
                                Total received: {formatCurrency(paid)}
                              </p>
                            </div>

                            {loan.reportPayments.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
                                No payments recorded for this loan yet.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <table className="w-full min-w-[700px] text-left text-sm">
                                  <thead className="bg-gray-100 text-xs uppercase text-gray-500">
                                    <tr className="border-b border-gray-200">
                                      <th className="px-4 py-3">No.</th>
                                      <th className="px-4 py-3">
                                        Payment Date
                                      </th>
                                      <th className="px-4 py-3 text-right">
                                        Amount
                                      </th>
                                      <th className="px-4 py-3">Method</th>
                                      <th className="px-4 py-3">Description</th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y divide-gray-100">
                                    {loan.reportPayments.map(
                                      (payment, paymentIndex) => (
                                        <tr
                                          key={`${loan.id}-${payment.id}`}
                                          className="transition hover:bg-gray-50"
                                        >
                                          <td className="px-4 py-3 text-gray-500">
                                            {paymentIndex + 1}
                                          </td>

                                          <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {formatDate(payment.payment_date)}
                                          </td>

                                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-700">
                                            {formatCurrency(
                                              toNumber(payment.amount),
                                            )}
                                          </td>

                                          <td className="px-4 py-3">
                                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                              {getPaymentMethod(payment)}
                                            </span>
                                          </td>

                                          <td className="px-4 py-3 text-gray-600">
                                            {payment.description || "-"}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>

                                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                                    <tr>
                                      <td
                                        colSpan={2}
                                        className="px-4 py-3 font-semibold text-gray-800"
                                      >
                                        Total Payments
                                      </td>
                                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                        {formatCurrency(paid)}
                                      </td>
                                      <td colSpan={2} />
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}

                            <div className="mt-3 flex flex-wrap justify-end gap-4 text-sm">
                              <span className="text-gray-600">
                                Total loan:{" "}
                                <strong>{formatCurrency(total)}</strong>
                              </span>
                              <span className="text-amber-700">
                                Remaining:{" "}
                                <strong>{formatCurrency(balance)}</strong>
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>

              <tfoot className="border-t-2 border-gray-200 bg-gray-100 font-bold text-gray-900">
                <tr>
                  <td colSpan={3} className="px-4 py-4">
                    TOTAL
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    {formatCurrency(summary.principal)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    {formatCurrency(summary.totalLoan)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-right text-emerald-700">
                    {formatCurrency(summary.totalPaid)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-right text-amber-700">
                    {formatCurrency(summary.balance)}
                  </td>

                  <td colSpan={3} className="px-4 py-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!loading && (
          <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
            Showing {filteredLoans.length} of {loans.length} loan records ·{" "}
            {summary.paymentCount} payment transactions
          </div>
        )}
      </section>

      {/* Print Styling */}
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

          .print\\:hidden {
            display: none !important;
          }

          section {
            box-shadow: none !important;
            overflow: visible !important;
          }

          table {
            font-size: 10px !important;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-row-group;
          }

          tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
  icon: string;
  accent: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  accent,
  iconBg,
  iconColor,
  valueColor,
}: SummaryCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <p
            className={`mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl ${valueColor}`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${iconBg} ${iconColor}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs leading-5 text-gray-500">{description}</p>
      </div>
    </div>
  );
}
