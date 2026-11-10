import { useCallback, useEffect, useMemo, useState } from "react";
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

  // Prefer the saved total when it includes interest.
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

const getLoanPaid = (loan: Loan): number =>
  roundMoney(
    loan.reportPayments.reduce(
      (sum, payment) => sum + toNumber(payment.amount),
      0,
    ),
  );

const getLoanBalance = (loan: Loan) =>
  roundMoney(Math.max(0, getLoanTotal(loan) - getLoanPaid(loan)));

const isFullyPaid = (loan: Loan) => getLoanBalance(loan) <= 0.009;

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
        // Use /loanpayments as the primary source of payment records.
        const listedPayments = paymentList.filter(
          (payment) => Number(payment.loan_id) === Number(loan.id),
        );

        // Use nested payments only when /loanpayments did not return
        // payments for this loan. This avoids double-counting.
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
    "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Loan Payment Report
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View all loans, payments received, and outstanding balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={loading}
            className={buttonClass}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Print Report
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total Loans" value={String(filteredLoans.length)} />
        <SummaryCard
          title="Total Loan Amount"
          value={formatCurrency(summary.principal)}
        />
        <SummaryCard
          title="Total Loan Amount (incl. Interest)"
          value={formatCurrency(summary.totalLoan)}
        />
        <SummaryCard
          title="Total Payments"
          value={formatCurrency(summary.totalPaid)}
        />
        <SummaryCard
          title="Outstanding Balance"
          value={formatCurrency(summary.balance)}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">
            All Loan Records
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="loan-report-search"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Search
              </label>
              <input
                id="loan-report-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Borrower, number, or loan ID..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="All">All Statuses</option>
                <option value="Outstanding">Outstanding</option>
                <option value="Fully Paid">Fully Paid</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-gray-500">
            Loading loan report...
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="font-semibold text-gray-900">
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
                  <th className="px-4 py-3.5">No.</th>
                  <th className="px-4 py-3.5">Loan Date</th>
                  <th className="px-4 py-3.5">Borrower</th>
                  <th className="px-4 py-3.5 text-right">Principal</th>
                  <th className="px-4 py-3.5 text-right">
                    Total Loan (incl. Interest)
                  </th>
                  <th className="px-4 py-3.5 text-right">Total Paid</th>
                  <th className="px-4 py-3.5 text-right">Balance</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center">Payments</th>
                  <th className="px-4 py-3.5 print:hidden">Details</th>
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
                    <>
                      <tr
                        key={`loan-${loan.id}`}
                        className="transition hover:bg-gray-50"
                      >
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
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          {formatCurrency(toNumber(loan.loan_amount))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(total)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-green-700">
                          {formatCurrency(paid)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-amber-700">
                          {formatCurrency(balance)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              fullyPaid
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {fullyPaid ? "Fully Paid" : "Outstanding"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {loan.reportPayments.length}
                          </span>
                        </td>
                        <td className="px-4 py-4 print:hidden">
                          <button
                            type="button"
                            onClick={() => toggleLoan(loan.id)}
                            aria-expanded={expanded}
                            className="whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 cursor-pointer"
                          >
                            {expanded ? "Hide Payments ↑" : "View Payments ↓"}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr key={`payments-${loan.id}`}>
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
                              <p className="text-sm font-semibold text-green-700">
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
                                      <th className="px-4 py-3 ">No.</th>
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
                                        <tr key={payment.id}>
                                          <td className="px-4 py-3 text-gray-500">
                                            {paymentIndex + 1}
                                          </td>
                                          <td className="whitespace-nowrap px-4 py-3">
                                            {formatDate(payment.payment_date)}
                                          </td>
                                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-green-700">
                                            {formatCurrency(
                                              toNumber(payment.amount),
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            {getPaymentMethod(payment)}
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
                                      <td className="px-4 py-3 text-right font-bold text-green-700">
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
                    </>
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
                  <td className="whitespace-nowrap px-4 py-4 text-right text-green-700">
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

      <style>{`
        @media print {
          body {
            background: white !important;
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
          tr {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 break-words text-xl font-bold tracking-tight text-gray-900">
        {value}
      </p>
    </div>
  );
}
