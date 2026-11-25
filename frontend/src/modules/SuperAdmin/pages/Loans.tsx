import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import api from "../../../services/api";

type ModalType = "confirm" | "success" | "error" | "warning";
type OwnerType = "member" | "nonmember";

interface Member {
  id: number;
  member_number: string;
  full_name: string;
  membership_status?: string;
}

interface NonMember {
  id: number;
  non_member_number: string;
  full_name: string;
}

interface LoanPayment {
  id: number;
  amount: number | string;
  payment_date: string;
  payment_method?: string;
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
  member?: Member | null;
  nonmember?: NonMember | null;
  payments?: LoanPayment[];
}

interface LoanForm {
  owner_type: OwnerType;
  member_number: string;
  non_member_number: string;
  loan_date: string;
  loan_amount: string;
}

interface ApiError {
  message?: string;
  errors?: Record<string, string[]>;
  data?: {
    message?: string;
    errors?: Record<string, string[]>;
  };
}

const emptyForm: LoanForm = {
  owner_type: "member",
  member_number: "",
  non_member_number: "",
  loan_date: new Date().toISOString().slice(0, 10),
  loan_amount: "",
};

const toNumber = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const formatDate = (value?: string) => {
  if (!value) return "-";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const getErrorMessage = (error: unknown): string => {
  const err = error as {
    response?: {
      status?: number;
      data?: ApiError;
    };
    message?: string;
  };

  const responseData = err.response?.data;

  if (responseData?.errors) {
    return Object.values(responseData.errors).flat().join("\n");
  }

  if (responseData?.data?.errors) {
    return Object.values(responseData.data.errors).flat().join("\n");
  }

  if (responseData?.data?.message) {
    return responseData.data.message;
  }

  if (responseData?.message) {
    return responseData.message;
  }

  if (err.response?.status === 409) {
    return "Empréstimu ida-ne'e labele hamoos tanba iha pagamentu sira ne'ebé eziste ona.";
  }

  return err.message || "Akontese Erru ruma. Koko fila-fali!";
};

/**
 * Preview rate based on borrower type and principal.
 * Laravel remains responsible for calculating and saving the rate.
 */
const calculateInterestRate = (
  amount: number,
  ownerType: OwnerType,
): number => {
  if (amount < 1) return 0;

  if (ownerType === "member") {
    if (amount < 1000) return 4.0;
    if (amount < 3000) return 3.5;
    if (amount < 5000) return 2.75;
    if (amount < 7500) return 2.0;
    if (amount < 10000) return 1.5;
    return 1.0;
  }

  if (amount < 5000) return 5.0;
  if (amount < 10000) return 4.0;
  return 3.5;
};

/**
 * Determine the effective interest rate for a loan.
 */
const getLoanRate = (loan: Loan): number => {
  if (loan.interest_rate !== undefined && loan.interest_rate !== null) {
    return toNumber(loan.interest_rate);
  }

  return calculateInterestRate(
    toNumber(loan.loan_amount),
    loan.member_number ? "member" : "nonmember",
  );
};

/**
 * Calculate interest from principal and rate.
 */
const getLoanInterest = (loan: Loan): number => {
  const principal = toNumber(loan.loan_amount);
  const rate = getLoanRate(loan);
  const calculatedInterest = roundMoney((principal * rate) / 100);
  const savedInterest = toNumber(loan.interest_amount);

  if (
    loan.interest_amount === undefined ||
    loan.interest_amount === null ||
    Math.abs(savedInterest - calculatedInterest) >= 0.01
  ) {
    return calculatedInterest;
  }

  return roundMoney(savedInterest);
};

/**
 * Total loan = principal + interest.
 */
const getLoanTotal = (loan: Loan): number =>
  roundMoney(toNumber(loan.loan_amount) + getLoanInterest(loan));

/**
 * Sum all payment records belonging to a loan.
 */
const getPaidAmount = (loan: Loan): number =>
  roundMoney(
    (loan.payments || []).reduce(
      (total, payment) => total + toNumber(payment.amount),
      0,
    ),
  );

/**
 * Remaining balance = total loan - payments.
 */
const getLoanBalance = (loan: Loan): number =>
  roundMoney(Math.max(0, getLoanTotal(loan) - getPaidAmount(loan)));

export default function Loan() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [nonmembers, setNonmembers] = useState<NonMember[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [form, setForm] = useState<LoanForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const [modalType, setModalType] = useState<ModalType>("confirm");
  const [modalMessage, setModalMessage] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const fetchLoans = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/loans");
      const data = getResponseData<Loan[]>(response);

      setLoans(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoans([]);
      setModalType("error");
      setModalTitle("Labele atu karrega emprestimu sira");
      setModalMessage(getErrorMessage(error));
      setSelectedLoan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOwners = useCallback(async () => {
    setLoadingOwners(true);

    try {
      const [membersResponse, nonmembersResponse] = await Promise.all([
        api.get("/members"),
        api.get("/nonmembers"),
      ]);

      const membersData = getResponseData<Member[]>(membersResponse);
      const nonmembersData = getResponseData<NonMember[]>(nonmembersResponse);

      setMembers(Array.isArray(membersData) ? membersData : []);
      setNonmembers(Array.isArray(nonmembersData) ? nonmembersData : []);
    } catch (error) {
      setMembers([]);
      setNonmembers([]);
      setModalType("error");
      setModalTitle("Labela atu karrega lista emprestimu sira");
      setModalMessage(getErrorMessage(error));
      setSelectedLoan(null);
    } finally {
      setLoadingOwners(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoans();
    void fetchOwners();
  }, [fetchLoans, fetchOwners]);

  const preview = useMemo(() => {
    const principal = toNumber(form.loan_amount);

    const validPrincipal =
      form.loan_amount.trim() !== "" &&
      Number.isFinite(principal) &&
      principal >= 1;

    const rate = validPrincipal
      ? calculateInterestRate(principal, form.owner_type)
      : 0;

    const interest = roundMoney((principal * rate) / 100);

    return {
      rate,
      interest,
      total: roundMoney(principal + interest),
      valid: validPrincipal,
    };
  }, [form.loan_amount, form.owner_type]);

  const totalPrincipal = useMemo(
    () =>
      roundMoney(
        loans.reduce((sum, loan) => sum + toNumber(loan.loan_amount), 0),
      ),
    [loans],
  );

  const totalInterest = useMemo(
    () =>
      roundMoney(loans.reduce((sum, loan) => sum + getLoanInterest(loan), 0)),
    [loans],
  );

  const totalLoanAmount = useMemo(
    () => roundMoney(loans.reduce((sum, loan) => sum + getLoanTotal(loan), 0)),
    [loans],
  );

  const totalPaid = useMemo(
    () => roundMoney(loans.reduce((sum, loan) => sum + getPaidAmount(loan), 0)),
    [loans],
  );

  const totalBalance = useMemo(
    () =>
      roundMoney(loans.reduce((sum, loan) => sum + getLoanBalance(loan), 0)),
    [loans],
  );

  const filteredLoans = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return loans.filter((loan) => {
      const borrowerName =
        loan.member?.full_name || loan.nonmember?.full_name || "";

      const borrowerNumber = loan.member_number || loan.non_member_number || "";

      const matchesSearch =
        borrowerName.toLowerCase().includes(keyword) ||
        borrowerNumber.toLowerCase().includes(keyword) ||
        String(loan.id).includes(keyword) ||
        String(loan.loan_amount).includes(keyword) ||
        String(getLoanTotal(loan)).includes(keyword);

      const matchesOwner =
        ownerFilter === "all" ||
        (ownerFilter === "member" && Boolean(loan.member_number)) ||
        (ownerFilter === "nonmember" && Boolean(loan.non_member_number));

      return matchesSearch && matchesOwner;
    });
  }, [loans, search, ownerFilter]);

  const openCreateForm = () => {
    setEditingLoan(null);
    setForm({
      ...emptyForm,
      loan_date: new Date().toISOString().slice(0, 10),
    });
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (loan: Loan) => {
    setEditingLoan(loan);

    setForm({
      owner_type: loan.member_number ? "member" : "nonmember",
      member_number: loan.member_number || "",
      non_member_number: loan.non_member_number || "",
      loan_date: loan.loan_date?.slice(0, 10) || "",
      loan_amount: String(loan.loan_amount ?? ""),
    });

    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;

    setShowForm(false);
    setEditingLoan(null);
    setForm(emptyForm);
    setFormError("");
  };

  const handleOwnerTypeChange = (ownerType: OwnerType) => {
    setForm((current) => ({
      ...current,
      owner_type: ownerType,
      member_number: ownerType === "member" ? current.member_number : "",
      non_member_number:
        ownerType === "nonmember" ? current.non_member_number : "",
    }));

    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (form.owner_type === "member" && !form.member_number) {
      setFormError("Favor hili membru ida hanesan ema ne'ebe empresta.");
      return;
    }

    if (form.owner_type === "nonmember" && !form.non_member_number) {
      setFormError("Favor hili non-membru ida hanesan ema ne'ebe empresta.");
      return;
    }

    if (!form.loan_date) {
      setFormError("Data emprestimu tenki prienxe.");
      return;
    }

    const amount = Number(form.loan_amount);

    if (
      form.loan_amount.trim() === "" ||
      !Number.isFinite(amount) ||
      amount < 1
    ) {
      setFormError(
        "Montante prinsipal emprestimu tenke menus-liu ka hanesan ho $1.00.",
      );
      return;
    }

    const payload = {
      member_number: form.owner_type === "member" ? form.member_number : null,
      non_member_number:
        form.owner_type === "nonmember" ? form.non_member_number : null,
      loan_date: form.loan_date,
      loan_amount: amount,
    };

    setSubmitting(true);

    try {
      if (editingLoan) {
        await api.put(`/loans/${editingLoan.id}`, payload);
      } else {
        await api.post("/loans", payload);
      }

      setShowForm(false);
      setEditingLoan(null);
      setForm(emptyForm);
      setModalType("success");
      setModalTitle("Success");
      setModalMessage(
        editingLoan ? "Dadus hadia ho susesu." : "Dadus aumenta ho susesu.",
      );
      setSelectedLoan(null);

      await fetchLoans();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteConfirmation = (loan: Loan) => {
    if ((loan.payments || []).length > 0) {
      setModalType("warning");
      setModalTitle("Labele hamoos dadus ne'e");
      setModalMessage(
        "Empréstimu ida-ne’e iha ona pagamentu. Favór ida, haree uluk rejistu pagamentu sira antes hamoos empréstimu ne’e.",
      );
      setSelectedLoan(null);
      return;
    }

    setSelectedLoan(loan);
    setModalType("confirm");
    setModalTitle("Hamoos dadus emprestimu");
    setModalMessage(
      `Ita-boot hakarak duni atu hamoos dadus emprestimu ba ${
        loan.member?.full_name ||
        loan.nonmember?.full_name ||
        loan.member_number ||
        loan.non_member_number ||
        `#${loan.id}`
      }? Aksaun ida ne'e labele kansela ka fila-fali..`,
    );
  };

  const handleDelete = async () => {
    if (!selectedLoan) return;

    setDeleting(true);

    try {
      await api.delete(`/loans/${selectedLoan.id}`);

      setModalType("success");
      setModalTitle("Success");
      setModalMessage("Dadus ne'e hamoos ho susesu.");
      setSelectedLoan(null);

      await fetchLoans();
    } catch (error) {
      setModalType("error");
      setModalTitle("Labele atu hamoos dadus ne'e.");
      setModalMessage(getErrorMessage(error));
      setSelectedLoan(null);
    } finally {
      setDeleting(false);
    }
  };

  const closeMessageModal = () => {
    if (deleting) return;

    setSelectedLoan(null);
    setModalTitle("");
    setModalMessage("");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              C-HTM / Jestaun Finanseiru
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              Dadus Emprestimu
            </h1>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            disabled={loadingOwners}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-lg leading-none">+</span>
            Aumenta dadus
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Total Loans */}
          <div className="group relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">
                  Total Emprestimu
                </p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                  {loans.length}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
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
                    d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 4v5h4M8.5 13h6M8.5 16.5h6"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Principal */}
          <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">
                  Total Montante Emprestimu
                  <p>(exc. funan)</p>
                </p>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight text-emerald-700">
                  {formatCurrency(totalPrincipal)}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
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
                    d="M12 3v18m5-14H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">Total funan</p>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight text-amber-700">
                  {formatCurrency(totalInterest)}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-500 group-hover:text-white">
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
                    d="M7 17 17 7M8 7h.01M16 17h.01"
                  />
                  <circle cx="8" cy="7" r="2" />
                  <circle cx="16" cy="17" r="2" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Loan Amount */}
          <div className="group relative overflow-hidden rounded-2xl border border-violet-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-violet-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">
                  Total Montante Emprestimu
                  <p>(inc. funan) </p>
                </p>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight text-violet-700">
                  {formatCurrency(totalLoanAmount)}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 10h18M7 15h3"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Payments Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Payments Received */}
          <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">
                  Total Pagamentu
                </p>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight text-emerald-700">
                  {formatCurrency(totalPaid)}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
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
                    d="m5 12 4 4L19 6"
                  />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
            </div>
          </div>

          {/* Balansu Outstading */}
          <div className="group relative overflow-hidden rounded-2xl border border-rose-100 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-rose-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">
                  Total seidauk selu
                </p>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight text-rose-700">
                  {formatCurrency(totalBalance)}
                </p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-600 group-hover:text-white">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 7v5l3 2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </span>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buka naran, numeru, id ou montante empresta..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
              />
            </div>

            <select
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:w-52"
              aria-label="Filter by borrower type"
            >
              <option value="all">Ema hotu</option>
              <option value="member">Membru</option>
              <option value="nonmember">Non-Membru</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setOwnerFilter("all");
                void fetchLoans();
              }}
              className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Fila ba inisiu
            </button>
          </div>
        </div>

        {/* Lista Emprestimu Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-white px-5 py-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Lista emprestimu
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/superadmin/loanreport";
                }}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white"
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
                Relatoriu
              </button>

              <button
                type="button"
                onClick={() => void fetchLoans()}
                disabled={loading}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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

          {loading ? (
            <div className="flex flex-col items-center justify-center px-4 py-16">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
              <p className="mt-4 text-sm font-medium text-slate-600">
                Loading ...
              </p>
              <p className="mt-1 text-xs text-slate-400">Favor hein oituan.</p>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 4v5h4M8.5 13h6M8.5 16.5h6"
                  />
                </svg>
              </div>

              <h3 className="mt-4 text-base font-bold text-slate-800">
                Dadus Emprestimu la iha.
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search || ownerFilter !== "all"
                  ? "La hetan dadus emprestimu ne'ebe hanesan ho ita buka ka filtru. Koko muda kriteria buka nian."
                  : "Dadus emprestimu seidauk iha."}
              </p>

              {!search && ownerFilter === "all" && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  disabled={loadingOwners}
                  className="mt-5 cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  +Hatama emprestimu dahuluk
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1250px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {[
                        "Nu.",
                        "Data Empresta",
                        "Naran",
                        "Montante Empresta",
                        "Funan %",
                        "Funan iha $",
                        "Total Empresta (inc. funan)",
                        "Pagamentu",
                        "Montante seidauk selu",
                        "Aksaun",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`whitespace-nowrap px-4 py-4 text-xs font-semibold uppercase tracking-wider ${
                            heading === "Actions" ? "text-center" : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredLoans.map((loan, index) => {
                      const isMember = Boolean(loan.member_number);

                      const borrowerName =
                        loan.member?.full_name ||
                        loan.nonmember?.full_name ||
                        "Name unavailable";

                      const borrowerNumber =
                        loan.member_number || loan.non_member_number || "-";

                      const paymentCount = (loan.payments || []).length;
                      const paidAmount = getPaidAmount(loan);
                      const principal = toNumber(loan.loan_amount);
                      const rate = getLoanRate(loan);
                      const interest = getLoanInterest(loan);
                      const total = getLoanTotal(loan);
                      const balance = getLoanBalance(loan);

                      const isPaid = balance <= 0 && total > 0;
                      const hasPayments = paymentCount > 0;

                      return (
                        <tr
                          key={loan.id}
                          className={`transition-colors duration-150 hover:bg-blue-50/70 ${
                            index % 2 === 0 ? "bg-white" : "bg-slate-50/70"
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 px-2 text-sm font-semibold text-slate-600">
                              {index + 1}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <div className="text-sm font-medium text-slate-700">
                              {formatDate(loan.loan_date)}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex min-w-[190px] items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                                  isMember
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-violet-100 text-violet-700"
                                }`}
                              >
                                {borrowerName
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {borrowerName}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {borrowerNumber}
                                </p>
                                <span
                                  className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                    isMember
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-violet-100 text-violet-700"
                                  }`}
                                >
                                  {isMember ? "MEMBER" : "NON-MEMBER"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="text-sm font-semibold tabular-nums text-slate-800">
                              {formatCurrency(principal)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-700">
                              {rate.toFixed(2)}%
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="text-sm font-medium tabular-nums text-amber-700">
                              {formatCurrency(interest)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <span className="text-sm font-bold tabular-nums text-blue-700">
                              {formatCurrency(total)}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <div className="flex flex-col items-start gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                  hasPayments
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    hasPayments
                                      ? "bg-emerald-500"
                                      : "bg-slate-400"
                                  }`}
                                />
                                {paymentCount}{" "}
                                {paymentCount === 1 ? "payment" : "payments"}
                              </span>

                              <span className="text-xs font-medium tabular-nums text-emerald-700">
                                Paid: {formatCurrency(paidAmount)}
                              </span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <div className="flex flex-col items-start gap-1.5">
                              <span
                                className={`text-sm font-bold tabular-nums ${
                                  isPaid
                                    ? "text-emerald-700"
                                    : balance > 0
                                      ? "text-rose-600"
                                      : "text-slate-500"
                                }`}
                              >
                                {formatCurrency(balance)}
                              </span>

                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  isPaid
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-50 text-rose-600"
                                }`}
                              >
                                {isPaid ? "Paid" : "Outstanding"}
                              </span>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditForm(loan)}
                                title="Hadia dadus"
                                aria-label={`Edit loan for ${borrowerName}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-600 transition hover:border-blue-600 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  aria-hidden="true"
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
                                onClick={() => openDeleteConfirmation(loan)}
                                title={
                                  hasPayments
                                    ? "Emprestimu ne'e iha ona pagamentu"
                                    : "Hamoos dadus"
                                }
                                aria-label={`Delete loan for ${borrowerName}`}
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 cursor-pointer ${
                                  hasPayments
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                    : "border-rose-200 bg-white text-rose-600 hover:border-rose-600 hover:bg-rose-600 hover:text-white focus:ring-rose-200"
                                }`}
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  aria-hidden="true"
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

              <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredLoans.length}
                  </span>{" "}
                  {filteredLoans.length === 1 ? "record" : "records"}
                </p>

                <p className="text-xs text-slate-400"></p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Loan Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 3.75h7l4.25 4.5v12H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 4v5h4M8.5 13h6M8.5 16.5h4"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingLoan
                      ? "Hadia dadus emprestimu"
                      : "Aumenta dadus emprestimu"}
                  </h2>
                  {/* <p className="mt-0.5 text-xs text-slate-500">
                    Borrower information and loan details
                  </p> */}
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                aria-label="Close form"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              {/* Scrollable Form Content */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                {formError && (
                  <div
                    role="alert"
                    className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                  >
                    <div className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v5m0 3h.01" />
                      </svg>
                      <span>{formError}</span>
                    </div>
                  </div>
                )}

                {loadingOwners && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-3 text-sm text-blue-700">
                    <svg
                      className="h-4 w-4 shrink-0 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" />
                    </svg>
                    Loading informasaun emprestim...
                  </div>
                )}

                {/* Borrower Type */}
                <section>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Hili Membru / Non-Membru?{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleOwnerTypeChange("member")}
                      aria-pressed={form.owner_type === "member"}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        form.owner_type === "member"
                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="8" r="3.5" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 20v-1.5a7 7 0 0 1 14 0V20Z"
                        />
                      </svg>
                      Membru
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOwnerTypeChange("nonmember")}
                      aria-pressed={form.owner_type === "nonmember"}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                        form.owner_type === "nonmember"
                          ? "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500"
                          : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-slate-50"
                      }`}
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="8" r="3.5" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 20v-1.5a7 7 0 0 1 14 0V20Z"
                        />
                      </svg>
                      Non-Membru
                    </button>
                  </div>
                </section>

                {/* Borrower Selection */}
                {form.owner_type === "member" ? (
                  <div>
                    <label
                      htmlFor="loan-member"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Hili membru <span className="text-red-500">*</span>
                    </label>

                    <select
                      id="loan-member"
                      value={form.member_number}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          member_number: event.target.value,
                        }))
                      }
                      required
                      disabled={loadingOwners || submitting}
                      className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                    >
                      <option value="">-- Hili membru nia numeru --</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.member_number}>
                          {member.full_name} ({member.member_number})
                        </option>
                      ))}
                    </select>

                    {!loadingOwners && members.length === 0 && (
                      <p className="mt-1.5 text-xs text-amber-700">
                        Dadus membru laiha. Favor rejistu uluk dadus membru.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="loan-nonmember"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Hili non-membru <span className="text-red-500">*</span>
                    </label>

                    <select
                      id="loan-nonmember"
                      value={form.non_member_number}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          non_member_number: event.target.value,
                        }))
                      }
                      required
                      disabled={loadingOwners || submitting}
                      className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                    >
                      <option value="">-- Hili non-membru nia numeru --</option>
                      {nonmembers.map((nonmember) => (
                        <option
                          key={nonmember.id}
                          value={nonmember.non_member_number}
                        >
                          {nonmember.full_name} ({nonmember.non_member_number})
                        </option>
                      ))}
                    </select>

                    {!loadingOwners && nonmembers.length === 0 && (
                      <p className="mt-1.5 text-xs text-amber-700">
                        Dadus laiha. Favor rejistu uluk dadus non-membru.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="loan-date"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Data empresta <span className="text-red-500">*</span>
                    </label>

                    <input
                      id="loan-date"
                      type="date"
                      value={form.loan_date}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          loan_date: event.target.value,
                        }))
                      }
                      required
                      disabled={submitting}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="loan-amount"
                      className="mb-1.5 block text-sm font-semibold text-slate-700"
                    >
                      Montante Empresta (USD){" "}
                      <span className="text-red-500">*</span>
                    </label>

                    <input
                      id="loan-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.loan_amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          loan_amount: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                      required
                      disabled={submitting}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Minimu montante: $1.00
                    </p>
                  </div>
                </div>

                {/* Compact Loan Calculation Preview */}
                <section className="overflow-hidden rounded-xl border border-blue-100 bg-slate-50">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Sumariu Emprestimu
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Estimasaun pursentu husi funan empresta
                      </p>
                    </div>

                    <span className="shrink-0 rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {preview.rate.toFixed(2)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3">
                    <div className="bg-white p-3.5">
                      <p className="text-xs font-medium text-slate-500">
                        Montante Empresta
                      </p>
                      <p className="mt-1.5 break-words text-base font-bold tabular-nums text-slate-800">
                        {formatCurrency(
                          preview.valid ? toNumber(form.loan_amount) : 0,
                        )}
                      </p>
                    </div>

                    <div className="bg-white p-3.5">
                      <p className="text-xs font-medium text-slate-500">
                        Funan
                      </p>
                      <p className="mt-1.5 break-words text-base font-bold tabular-nums text-amber-700">
                        {formatCurrency(preview.valid ? preview.interest : 0)}
                      </p>
                    </div>

                    <div className="col-span-2 bg-blue-50 p-3.5 sm:col-span-1">
                      <p className="text-xs font-semibold text-blue-700">
                        Total Empresta
                      </p>
                      <p className="mt-1.5 break-words text-lg font-bold tabular-nums text-blue-800">
                        {formatCurrency(preview.valid ? preview.total : 0)}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Payment Information */}
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5m0 3h.01" />
                  </svg>

                  <p className="text-xs leading-5 text-amber-800">
                    Pagamentu sira aplika ba montante total empréstimu, inklui
                    funan.
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex shrink-0 flex-col-reverse gap-2.5 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Kansela
                </button>

                <button
                  type="submit"
                  disabled={submitting || loadingOwners}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                        <path d="M21 12a9 9 0 0 0-9-9" />
                      </svg>
                      Rai dadus...
                    </>
                  ) : (
                    <>
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
                          d="M5 12h14m-7-7 7 7-7 7"
                        />
                      </svg>
                      {editingLoan ? "Atualiza dadus" : "Rai dadus"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation and Feedback Modal */}
      {modalTitle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  modalType === "success"
                    ? "bg-green-100 text-green-700"
                    : modalType === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : modalType === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {modalType === "success" ? (
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 8v5m0 3h.01M10.3 3.9 2.8 17a2 2 0 0 1 1.7 3h15a2 2 0 0 1 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {modalTitle}
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                  {modalMessage}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              {modalType === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={closeMessageModal}
                    disabled={deleting}
                    className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Kansela
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 cursor-pointer px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Hamoos..." : "Sim, Hamoos"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeMessageModal}
                  className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Kansela
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
