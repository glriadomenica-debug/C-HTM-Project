import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import api from "../../../services/api";

type ModalType = "confirm" | "success" | "error" | "warning";
type PaymentMethod = "Cash" | "Bank Transfer";
type BorrowerType = "member" | "nonmember";

interface Borrower {
  id: number;
  full_name: string;
  member_number?: string | null;
  non_member_number?: string | null;
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
  balance?: number | string | null;
  status?: string;
  member?: Borrower | null;
  nonmember?: Borrower | null;
  payments?: LoanPayment[];
}

interface LoanPayment {
  id: number;
  loan_id: number;
  amount: number | string;
  payment_date: string;
  payment_method: PaymentMethod;
  description: string | null;
  loan?: Loan | null;
}

interface PaymentForm {
  borrower_type: BorrowerType | "";
  borrower_number: string;
  loan_id: string;
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  description: string;
}

interface ApiError {
  message?: string;
  errors?: Record<string, string[]>;
  data?: {
    message?: string;
    errors?: Record<string, string[]>;
  };
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: PaymentForm = {
  borrower_type: "",
  borrower_number: "",
  loan_id: "",
  amount: "",
  payment_date: today(),
  payment_method: "Cash",
  description: "",
};

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
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const formatDate = (value: string) => {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getErrorMessage = (error: unknown): string => {
  const err = error as ApiError & {
    response?: { data?: ApiError };
    message?: string;
  };

  const data = err?.response?.data;

  if (data?.errors) {
    const firstError = Object.values(data.errors).flat()[0];
    if (firstError) return firstError;
  }

  if (data?.message) return data.message;

  if (err?.data?.errors) {
    const firstError = Object.values(err.data.errors).flat()[0];
    if (firstError) return firstError;
  }

  return (
    err?.data?.message ||
    err?.message ||
    "Something went wrong. Please try again."
  );
};

const getBorrowerName = (loan: Loan): string => {
  if (loan.member?.full_name) return loan.member.full_name;
  if (loan.nonmember?.full_name) return loan.nonmember.full_name;

  if (loan.member_number) return `Member ${loan.member_number}`;

  if (loan.non_member_number) {
    return `Non-Member ${loan.non_member_number}`;
  }

  return "Unknown borrower";
};

const getBorrowerNumber = (loan: Loan): string =>
  loan.member_number || loan.non_member_number || "-";

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const getLoanTotal = (loan: Loan): number => {
  const principal = toNumber(loan.loan_amount);

  const storedTotal = toNumber(loan.total_amount ?? loan.total_loan_amount);

  // If the API already provides the correct total including interest,
  // use that total.
  if (storedTotal > principal) {
    return roundMoney(storedTotal);
  }

  // Determine borrower type and interest rate, matching loan.tsx.
  const isMember = Boolean(loan.member_number);
  const savedRate = toNumber(loan.interest_rate ?? loan.interest_percentage);

  let rate = savedRate;

  if (rate <= 0) {
    if (isMember) {
      if (principal < 1000) rate = 4.0;
      else if (principal < 3000) rate = 3.5;
      else if (principal < 5000) rate = 2.75;
      else if (principal < 7500) rate = 2.0;
      else if (principal < 10000) rate = 1.5;
      else rate = 1.0;
    } else {
      if (principal < 5000) rate = 5.0;
      else if (principal < 10000) rate = 4.0;
      else rate = 3.5;
    }
  }

  const calculatedInterest = roundMoney((principal * rate) / 100);

  const savedInterest = toNumber(loan.interest_amount ?? loan.interest);

  const interest = savedInterest > 0 ? savedInterest : calculatedInterest;

  return roundMoney(principal + interest);
};

const getPaymentLoan = (payment: LoanPayment, loans: Loan[]): Loan | null => {
  const listedLoan = loans.find(
    (item) => Number(item.id) === Number(payment.loan_id),
  );
  const relatedLoan = payment.loan;

  if (!listedLoan) return relatedLoan || null;
  if (!relatedLoan) return listedLoan;

  // Merge both sources so an incomplete /loans response does not overwrite
  // interest and total fields available through the payment's loan relation.
  return {
    ...relatedLoan,
    ...listedLoan,
    interest_rate: listedLoan.interest_rate ?? relatedLoan.interest_rate,
    interest_percentage:
      listedLoan.interest_percentage ?? relatedLoan.interest_percentage,
    interest_amount: listedLoan.interest_amount ?? relatedLoan.interest_amount,
    interest: listedLoan.interest ?? relatedLoan.interest,
    total_amount: listedLoan.total_amount ?? relatedLoan.total_amount,
    total_loan_amount:
      listedLoan.total_loan_amount ?? relatedLoan.total_loan_amount,
    member: listedLoan.member ?? relatedLoan.member,
    nonmember: listedLoan.nonmember ?? relatedLoan.nonmember,
  };
};

const getLoanPaid = (loan: Loan, payments: LoanPayment[]): number => {
  const loanPayments = payments.filter(
    (payment) => Number(payment.loan_id) === Number(loan.id),
  );

  if (loanPayments.length > 0) {
    return loanPayments.reduce(
      (sum, payment) => sum + toNumber(payment.amount),
      0,
    );
  }

  return (loan.payments || []).reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
};

const getLoanBalance = (loan: Loan, paid: number): number =>
  Math.max(0, getLoanTotal(loan) - paid);

const isFullyPaid = (loan: Loan, paid: number): boolean =>
  getLoanBalance(loan, paid) <= 0.009;

export default function LoanPayment() {
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Borrower[]>([]);
  const [nonmembers, setNonmembers] = useState<Borrower[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingBorrowers, setLoadingBorrowers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<LoanPayment | null>(
    null,
  );
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<LoanPayment | null>(
    null,
  );

  const [notice, setNotice] = useState("");

  const showMessage = (type: ModalType, title: string, message: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
  };

  const closeMessageModal = () => {
    setModalType(null);
    setModalTitle("");
    setModalMessage("");
    setSelectedPayment(null);
  };

  const fetchPayments = useCallback(async () => {
    try {
      const response = await api.get("/loanpayments");
      const data = getResponseData<LoanPayment[]>(response);
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      showMessage("error", "Unable to Load Payments", getErrorMessage(error));
    }
  }, []);

  const fetchLoans = useCallback(async () => {
    try {
      const response = await api.get("/loans");
      const data = getResponseData<Loan[]>(response);
      setLoans(Array.isArray(data) ? data : []);
    } catch (error) {
      showMessage("error", "Unable to Load Loans", getErrorMessage(error));
    }
  }, []);

  const fetchBorrowers = useCallback(async () => {
    setLoadingBorrowers(true);

    try {
      const [memberResponse, nonmemberResponse] = await Promise.all([
        api.get("/members"),
        api.get("/nonmembers"),
      ]);

      const memberData = getResponseData<Borrower[]>(memberResponse);
      const nonmemberData = getResponseData<Borrower[]>(nonmemberResponse);

      setMembers(Array.isArray(memberData) ? memberData : []);
      setNonmembers(Array.isArray(nonmemberData) ? nonmemberData : []);
    } catch (error) {
      showMessage("error", "Unable to Load Borrowers", getErrorMessage(error));
    } finally {
      setLoadingBorrowers(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPayments(), fetchLoans()]);
    setLoading(false);
  }, [fetchPayments, fetchLoans]);

  useEffect(() => {
    void refreshData();
    void fetchBorrowers();
  }, [refreshData, fetchBorrowers]);

  const paymentTotals = useMemo(() => {
    const cash = payments
      .filter((payment) => payment.payment_method === "Cash")
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

    const bankTransfer = payments
      .filter((payment) => payment.payment_method === "Bank Transfer")
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

    return {
      count: payments.length,
      total: payments.reduce(
        (sum, payment) => sum + toNumber(payment.amount),
        0,
      ),
      cash,
      bankTransfer,
    };
  }, [payments]);

  const loanProgress = useMemo(() => {
    const result: Record<
      number,
      { paid: number; balance: number; total: number }
    > = {};

    loans.forEach((loan) => {
      const paid = getLoanPaid(loan, payments);
      const total = getLoanTotal(loan);

      result[loan.id] = {
        paid,
        total,
        balance: getLoanBalance(loan, paid),
      };
    });

    return result;
  }, [loans, payments]);

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const loan = getPaymentLoan(payment, loans);

      const borrowerName = loan ? getBorrowerName(loan) : "";
      const borrowerNumber = loan ? getBorrowerNumber(loan) : "";

      const matchesSearch =
        !keyword ||
        borrowerName.toLowerCase().includes(keyword) ||
        borrowerNumber.toLowerCase().includes(keyword) ||
        String(payment.id).includes(keyword) ||
        String(payment.loan_id).includes(keyword) ||
        String(payment.amount).includes(keyword) ||
        (payment.description || "").toLowerCase().includes(keyword);

      const matchesMethod =
        methodFilter === "All" || payment.payment_method === methodFilter;

      const loanPaid = loan ? getLoanPaid(loan, payments) : 0;
      const fullyPaid = loan ? isFullyPaid(loan, loanPaid) : false;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Fully Paid" && fullyPaid) ||
        (statusFilter === "Outstanding" && !fullyPaid);

      return matchesSearch && matchesMethod && matchesStatus;
    });
  }, [payments, loans, search, methodFilter, statusFilter]);

  const borrowerOptions = useMemo(() => {
    if (form.borrower_type === "member") {
      return members
        .filter((member) => Boolean(member.member_number))
        .map((member) => ({
          number: String(member.member_number),
          name: member.full_name,
        }));
    }

    if (form.borrower_type === "nonmember") {
      return nonmembers
        .filter((member) => Boolean(member.non_member_number))
        .map((member) => ({
          number: String(member.non_member_number),
          name: member.full_name,
        }));
    }

    return [];
  }, [form.borrower_type, members, nonmembers]);

  // Keep fully paid loans visible, but prevent additional payments.
  const availableLoans = useMemo(() => {
    if (!form.borrower_type || !form.borrower_number) return [];

    return loans.filter((loan) => {
      if (form.borrower_type === "member") {
        return loan.member_number === form.borrower_number;
      }

      return loan.non_member_number === form.borrower_number;
    });
  }, [loans, form.borrower_type, form.borrower_number]);

  const selectedLoan = useMemo(
    () =>
      loans.find((loan) => Number(loan.id) === Number(form.loan_id)) || null,
    [loans, form.loan_id],
  );

  const selectedLoanProgress = useMemo(() => {
    if (!selectedLoan) {
      return { paid: 0, balance: 0, total: 0, fullyPaid: false };
    }

    const paid = getLoanPaid(selectedLoan, payments);
    const total = getLoanTotal(selectedLoan);
    const balance = getLoanBalance(selectedLoan, paid);

    return {
      paid,
      total,
      balance,
      fullyPaid: isFullyPaid(selectedLoan, paid),
    };
  }, [selectedLoan, payments]);

  // When editing, add the existing payment amount back to the balance because
  // that payment is already included in the total paid amount.
  const previousPaymentAmount = editingPayment
    ? toNumber(editingPayment.amount)
    : 0;

  const maximumAllowedPayment = roundMoney(
    selectedLoanProgress.balance + previousPaymentAmount,
  );

  const enteredPaymentAmount = Number(form.amount);

  // Compare cents to avoid floating-point issues such as 0.76 vs 0.75.
  const paymentExceedsBalance =
    Boolean(selectedLoan) &&
    form.amount.trim() !== "" &&
    Number.isFinite(enteredPaymentAmount) &&
    Math.round(enteredPaymentAmount * 100) >
      Math.round(maximumAllowedPayment * 100);

  const setField = <K extends keyof PaymentForm>(
    field: K,
    value: PaymentForm[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormError("");
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFormError("");
    setEditingPayment(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, payment_date: today() });
    setEditingPayment(null);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (payment: LoanPayment) => {
    const loan =
      loans.find((item) => Number(item.id) === Number(payment.loan_id)) ||
      payment.loan;

    let borrowerType: BorrowerType | "" = "";
    let borrowerNumber = "";

    if (loan?.member_number) {
      borrowerType = "member";
      borrowerNumber = loan.member_number;
    } else if (loan?.non_member_number) {
      borrowerType = "nonmember";
      borrowerNumber = loan.non_member_number;
    }

    setEditingPayment(payment);
    setForm({
      borrower_type: borrowerType,
      borrower_number: borrowerNumber,
      loan_id: String(payment.loan_id),
      amount: String(payment.amount),
      payment_date: payment.payment_date?.slice(0, 10) || today(),
      payment_method: payment.payment_method,
      description: payment.description || "",
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    resetForm();
  };

  const handleBorrowerTypeChange = (value: BorrowerType | "") => {
    setForm((previous) => ({
      ...previous,
      borrower_type: value,
      borrower_number: "",
      loan_id: "",
      amount: "",
    }));
    setFormError("");
  };

  const handleBorrowerChange = (value: string) => {
    setForm((previous) => ({
      ...previous,
      borrower_number: value,
      loan_id: "",
      amount: "",
    }));
    setFormError("");
  };

  const handleLoanChange = (value: string) => {
    const loan = loans.find((item) => String(item.id) === value);

    setForm((previous) => ({
      ...previous,
      loan_id: value,
      amount:
        loan && !isFullyPaid(loan, getLoanPaid(loan, payments))
          ? String(getLoanBalance(loan, getLoanPaid(loan, payments)).toFixed(2))
          : "",
    }));

    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!form.borrower_type) {
      setFormError("Please select a borrower type.");
      return;
    }

    if (!form.borrower_number) {
      setFormError("Please select a borrower.");
      return;
    }

    if (!form.loan_id) {
      setFormError("Please select a loan.");
      return;
    }

    const amount = Number(form.amount);

    if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a valid payment amount greater than zero.");
      return;
    }

    if (!form.payment_date) {
      setFormError("Please select a payment date.");
      return;
    }

    if (!selectedLoan) {
      setFormError(
        "The selected loan could not be found. Please select it again.",
      );
      return;
    }

    const paid = getLoanPaid(selectedLoan, payments);
    const remaining = getLoanBalance(selectedLoan, paid);

    // Use the same maximum shown below the amount field and used to disable
    // Record Payment, so the live validation and submit validation agree.
    const maximumAllowed = maximumAllowedPayment;

    if (!editingPayment && remaining <= 0.009) {
      setFormError(
        "This loan is already fully paid. You can still view the borrower, but another payment cannot be added.",
      );
      return;
    }

    if (Math.round(amount * 100) > Math.round(maximumAllowed * 100)) {
      setFormError(
        `Payment amount cannot exceed the remaining balance of ${formatCurrency(maximumAllowed)}.`,
      );
      return;
    }

    const payload = {
      loan_id: Number(form.loan_id),
      amount,
      payment_date: form.payment_date,
      payment_method: form.payment_method,
      description: form.description.trim() || null,
    };

    setSubmitting(true);

    try {
      if (editingPayment) {
        await api.put(`/loanpayments/${editingPayment.id}`, payload);
        setNotice("Payment updated successfully.");
      } else {
        await api.post("/loanpayments", payload);
        setNotice("Payment recorded successfully.");
      }

      resetForm();
      await refreshData();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteConfirmation = (payment: LoanPayment) => {
    setSelectedPayment(payment);
    showMessage(
      "confirm",
      "Delete Payment?",
      `Are you sure you want to delete payment #${payment.id}? This action cannot be undone.`,
    );
  };

  const handleDelete = async () => {
    if (!selectedPayment) return;

    setDeleting(true);

    try {
      await api.delete(`/loanpayments/${selectedPayment.id}`);

      closeMessageModal();
      setNotice("Payment deleted successfully.");
      await refreshData();
    } catch (error) {
      showMessage("error", "Unable to Delete Payment", getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const selectedBorrowerName = borrowerOptions.find(
    (item) => item.number === form.borrower_number,
  )?.name;

  const buttonClass =
    "rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

  const secondaryButtonClass =
    "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Loan Payments
          </h1>
          {/* <p className="mt-1 text-sm text-gray-500">
            Record repayments and track outstanding loan balances.
          </p> */}
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className={`${buttonClass} cursor-pointer`}
        >
          + Add Payment
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="font-semibold"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Payment Transactions"
          value={String(paymentTotals.count)}
          description=""
        />
        <SummaryCard
          title="Total Collected"
          value={formatCurrency(paymentTotals.total)}
          description=""
        />
        <SummaryCard
          title="Cash Payments"
          value={formatCurrency(paymentTotals.cash)}
          description=""
        />
        <SummaryCard
          title="Bank Transfers"
          value={formatCurrency(paymentTotals.bankTransfer)}
          description=""
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Payment Records
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/superadmin/loanpayreport";
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white cursor-pointer"
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
                    d="M8 3h7l4 4v14H5V3h3Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 3v5h4M8 13h8M8 17h8"
                  />
                </svg>
                Loan Payment Report
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => void fetchLoans()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2"
                  />
                </svg>

                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="payment-search"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Search
              </label>
              <input
                id="payment-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Borrower, payment ID, loan ID..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="payment-method-filter"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Payment Method
              </label>
              <select
                id="payment-method-filter"
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="payment-status-filter"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Loan Status
              </label>
              <select
                id="payment-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
              >
                <option value="All">All Loan Statuses</option>
                <option value="Outstanding">Outstanding</option>
                <option value="Fully Paid">Fully Paid</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="mt-3 text-sm text-gray-500">
              Loading payment records...
            </p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500">
              $
            </div>
            <h3 className="mt-3 text-base font-semibold text-gray-900">
              No payment records found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search || methodFilter !== "All" || statusFilter !== "All"
                ? "Try changing your search or filters."
                : "Add a payment to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr className="bg-slate-800 text-white">
                  <th className="px-5 py-3.5 font-semibold">No.</th>
                  <th className="px-5 py-3.5 font-semibold">Borrower</th>
                  <th className="px-5 py-3.5 font-semibold">Payment Date</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Loan Amount
                  </th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Total Paid
                  </th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Remaining Balance
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Method</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredPayments.map((payment, index) => {
                  const loan = getPaymentLoan(payment, loans);

                  const progress = loan
                    ? loanProgress[loan.id] || {
                        total: getLoanTotal(loan),
                        paid: getLoanPaid(loan, payments),
                        balance: getLoanBalance(
                          loan,
                          getLoanPaid(loan, payments),
                        ),
                      }
                    : null;

                  const fullyPaid = progress
                    ? progress.balance <= 0.009
                    : false;

                  return (
                    <tr
                      key={payment.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {index + 1}
                        </div>
                        {/* <div className="mt-1 text-xs text-gray-500">
                          Loan #{payment.loan_id}
                        </div> */}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {loan ? getBorrowerName(loan) : "Unknown borrower"}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {loan ? getBorrowerNumber(loan) : "-"}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                        {formatDate(payment.payment_date)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-gray-900">
                        {progress ? formatCurrency(progress.total) : "-"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-green-700">
                        {progress ? formatCurrency(progress.paid) : "-"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-gray-900">
                        {progress ? formatCurrency(progress.balance) : "-"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {payment.payment_method}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {fullyPaid ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                            Fully Paid
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Outstanding
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(payment)}
                            className="px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                          >
                            <svg
                              className="h-7 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.8"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteConfirmation(payment)}
                            className="px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            <svg
                              className="h-7 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.8"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredPayments.length > 0 && (
          <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
            Showing {filteredPayments.length} of {payments.length} payment
            records
          </div>
        )}
      </section>

      {/* Add / Edit Payment Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-gray-950/50 p-3 sm:p-6">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPayment ? "Edit Payment" : "Add Loan Payment"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {editingPayment
                    ? "Update the repayment details below."
                    : "Select a borrower and loan, then enter the payment details."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Close form"
                className="rounded-lg p-2 text-xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    <p className="font-semibold">Please check the following</p>
                    <p className="mt-1">{formError}</p>
                  </div>
                )}

                {/* Borrower Type Cards */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">
                    1. Borrower Type <span className="text-red-500">*</span>
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleBorrowerTypeChange("member")}
                      disabled={Boolean(editingPayment)}
                      aria-pressed={form.borrower_type === "member"}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        form.borrower_type === "member"
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                            form.borrower_type === "member"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-6 w-6"
                          >
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21a8 8 0 0 1 16 0" />
                          </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">Member</p>
                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            Select a registered member as the borrower.
                          </p>
                        </div>

                        {form.borrower_type === "member" && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleBorrowerTypeChange("nonmember")}
                      disabled={Boolean(editingPayment)}
                      aria-pressed={form.borrower_type === "nonmember"}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        form.borrower_type === "nonmember"
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                            form.borrower_type === "nonmember"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-6 w-6"
                          >
                            <circle cx="9" cy="8" r="3.5" />
                            <path d="M2 20a7 7 0 0 1 14 0" />
                            <path d="M16 5.5a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 4 5.7" />
                          </svg>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">
                            Non-Member
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            Select a borrower who is not a registered member.
                          </p>
                        </div>

                        {form.borrower_type === "nonmember" && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Borrower selection */}
                <div>
                  <label
                    htmlFor="borrower"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    2. Select Borrower <span className="text-red-500">*</span>
                  </label>

                  <select
                    id="borrower"
                    value={form.borrower_number}
                    onChange={(event) =>
                      handleBorrowerChange(event.target.value)
                    }
                    disabled={
                      !form.borrower_type ||
                      loadingBorrowers ||
                      Boolean(editingPayment)
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                  >
                    <option value="">
                      {loadingBorrowers
                        ? "Loading borrowers..."
                        : !form.borrower_type
                          ? "Select a borrower type first"
                          : borrowerOptions.length === 0
                            ? "No borrowers available"
                            : "Choose a borrower"}
                    </option>

                    {borrowerOptions.map((borrower) => (
                      <option key={borrower.number} value={borrower.number}>
                        {borrower.name} ({borrower.number})
                      </option>
                    ))}
                  </select>

                  {form.borrower_type && !loadingBorrowers && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {borrowerOptions.length}{" "}
                      {form.borrower_type === "member"
                        ? "members"
                        : "non-members"}{" "}
                      available. Borrowers remain visible even when their loans
                      are fully paid.
                    </p>
                  )}
                </div>

                {/* Loan selection */}
                <div>
                  <label
                    htmlFor="loan"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    3. Select Loan <span className="text-red-500">*</span>
                  </label>

                  <select
                    id="loan"
                    value={form.loan_id}
                    onChange={(event) => handleLoanChange(event.target.value)}
                    disabled={
                      !form.borrower_type ||
                      !form.borrower_number ||
                      Boolean(editingPayment)
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                  >
                    <option value="">
                      {!form.borrower_number
                        ? "Select a borrower first"
                        : availableLoans.length === 0
                          ? "No loans found for this borrower"
                          : "Choose a loan"}
                    </option>

                    {availableLoans.map((loan) => {
                      const paid = getLoanPaid(loan, payments);
                      const total = getLoanTotal(loan);
                      const remaining = getLoanBalance(loan, paid);
                      const fullyPaid = isFullyPaid(loan, paid);

                      return (
                        <option key={loan.id} value={loan.id}>
                          {`Loan #${loan.id} · ${formatCurrency(total)} · ${
                            fullyPaid
                              ? "Fully Paid"
                              : `Remaining ${formatCurrency(remaining)}`
                          }`}
                        </option>
                      );
                    })}
                  </select>

                  {form.borrower_number && availableLoans.length === 0 && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                      No loans were found for this borrower. Select another
                      borrower or check the loan records.
                    </div>
                  )}

                  {selectedLoan && (
                    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Loan #{selectedLoan.id}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Borrower:{" "}
                            {selectedBorrowerName ||
                              getBorrowerName(selectedLoan)}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            selectedLoanProgress.fullyPaid
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {selectedLoanProgress.fullyPaid
                            ? "Fully Paid"
                            : "Outstanding"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <ProgressItem
                          label="Loan Amount"
                          value={formatCurrency(selectedLoanProgress.total)}
                        />
                        <ProgressItem
                          label="Total Paid"
                          value={formatCurrency(selectedLoanProgress.paid)}
                          green
                        />
                        <ProgressItem
                          label="Remaining Balance"
                          value={formatCurrency(selectedLoanProgress.balance)}
                          highlight={!selectedLoanProgress.fullyPaid}
                        />
                      </div>

                      {selectedLoanProgress.fullyPaid && (
                        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
                          This loan has been fully paid. It remains visible for
                          reference, but no additional payment can be recorded.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment amount and date */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="payment-amount"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Payment Amount (USD){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        $
                      </span>
                      <input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount}
                        onChange={(event) =>
                          setField("amount", event.target.value)
                        }
                        disabled={
                          !selectedLoan ||
                          selectedLoanProgress.fullyPaid ||
                          submitting
                        }
                        required
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-300 py-3 pl-7 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                      />
                    </div>

                    {selectedLoan && !selectedLoanProgress.fullyPaid && (
                      <p className="mt-1.5 text-xs text-gray-500">
                        Maximum payment: {formatCurrency(maximumAllowedPayment)}
                      </p>
                    )}

                    {paymentExceedsBalance && (
                      <p
                        role="alert"
                        className="mt-1.5 text-sm font-medium text-red-600"
                      >
                        Payment amount cannot exceed the remaining balance of{" "}
                        {formatCurrency(maximumAllowedPayment)}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="payment-date"
                      className="mb-1.5 block text-sm font-semibold text-gray-800"
                    >
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="payment-date"
                      type="date"
                      value={form.payment_date}
                      onChange={(event) =>
                        setField("payment_date", event.target.value)
                      }
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="payment-method"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="payment-method"
                    value={form.payment_method}
                    onChange={(event) =>
                      setField(
                        "payment_method",
                        event.target.value as PaymentMethod,
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="payment-description"
                    className="mb-1.5 block text-sm font-semibold text-gray-800"
                  >
                    Description{" "}
                    <span className="font-normal text-gray-400">
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    id="payment-description"
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setField("description", event.target.value)
                    }
                    placeholder="Add a note about this payment..."
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    paymentExceedsBalance ||
                    (!editingPayment &&
                      Boolean(selectedLoan && selectedLoanProgress.fullyPaid))
                  }
                  className={buttonClass}
                >
                  {submitting
                    ? "Saving..."
                    : editingPayment
                      ? "Save Changes"
                      : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation and message modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${
                modalType === "error"
                  ? "bg-red-100 text-red-600"
                  : modalType === "warning" || modalType === "confirm"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-green-100 text-green-600"
              }`}
            >
              {modalType === "error"
                ? "!"
                : modalType === "confirm"
                  ? "?"
                  : modalType === "warning"
                    ? "!"
                    : "✓"}
            </div>

            <h3 className="mt-4 text-lg font-bold text-gray-900">
              {modalTitle}
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {modalMessage}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              {modalType === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={closeMessageModal}
                    disabled={deleting}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Payment"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeMessageModal}
                  className={buttonClass}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  description: string;
}

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 break-words text-2xl font-bold tracking-tight text-gray-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
}

interface ProgressItemProps {
  label: string;
  value: string;
  green?: boolean;
  highlight?: boolean;
}

function ProgressItem({
  label,
  value,
  green = false,
  highlight = false,
}: ProgressItemProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`mt-1 break-words text-sm font-bold ${
          green
            ? "text-green-700"
            : highlight
              ? "text-amber-700"
              : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
