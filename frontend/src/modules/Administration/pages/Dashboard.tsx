import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";

interface User {
  id: number;
}

interface Member {
  id: number;
}

interface LoanPayment {
  id: number;
  amount: number | string;
  payment_date?: string;
  payment_method?: string;
  created_at?: string;
}

interface Borrower {
  full_name?: string | null;
}

interface Loan {
  id: number;
  member_number?: string | null;
  non_member_number?: string | null;
  loan_date?: string;
  loan_amount: number | string;
  interest_rate?: number | string | null;
  interest_amount?: number | string | null;
  total_amount?: number | string | null;
  created_at?: string;
  member?: Borrower | null;
  nonmember?: Borrower | null;
  payments?: LoanPayment[];
}

interface ActivityItem {
  id: string;
  type: "loan" | "payment";
  title: string;
  borrower: string;
  detail: string;
  amount: number;
  date?: string;
}

interface DashboardCounts {
  users: number;
  members: number;
  nonmembers: number;
  activeLoans: number;
  outstandingBalance: number;
}

const emptyCounts: DashboardCounts = {
  users: 0,
  members: 0,
  nonmembers: 0,
  activeLoans: 0,
  outstandingBalance: 0,
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

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const getLoanTotal = (loan: Loan): number => {
  const principal = toNumber(loan.loan_amount);
  const storedTotal = toNumber(loan.total_amount);

  if (storedTotal > principal) {
    return roundMoney(storedTotal);
  }

  let rate = toNumber(loan.interest_rate);
  if (rate <= 0) {
    const isMember = Boolean(loan.member_number);
    if (isMember) {
      if (principal < 1000) rate = 4;
      else if (principal < 3000) rate = 3.5;
      else if (principal < 5000) rate = 2.75;
      else if (principal < 7500) rate = 2;
      else if (principal < 10000) rate = 1.5;
      else rate = 1;
    } else if (principal < 5000) {
      rate = 5;
    } else if (principal < 10000) {
      rate = 4;
    } else {
      rate = 3.5;
    }
  }

  const savedInterest = toNumber(loan.interest_amount);
  const interest =
    savedInterest > 0 ? savedInterest : roundMoney((principal * rate) / 100);
  return roundMoney(principal + interest);
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const getBorrowerName = (loan: Loan): string => {
  if (loan.member?.full_name) return loan.member.full_name;
  if (loan.nonmember?.full_name) return loan.nonmember.full_name;
  if (loan.member_number) return `Member ${loan.member_number}`;
  if (loan.non_member_number) return `Non-member ${loan.non_member_number}`;
  return "Unknown borrower";
};

const getRecentActivities = (loans: Loan[]): ActivityItem[] =>
  loans
    .flatMap((loan) => {
      const borrower = getBorrowerName(loan);
      const loanActivity: ActivityItem = {
        id: `loan-${loan.id}`,
        type: "loan",
        title: "Rejistu Emprestimu",
        borrower,
        detail: `Loan #${loan.id}`,
        amount: toNumber(loan.loan_amount),
        date: loan.created_at || loan.loan_date,
      };
      const paymentActivities = (loan.payments ?? []).map((payment) => ({
        id: `payment-${payment.id}`,
        type: "payment" as const,
        title: "Simu Pagamentu",
        borrower,
        detail: [`Loan #${loan.id}`, payment.payment_method]
          .filter(Boolean)
          .join(" · "),
        amount: toNumber(payment.amount),
        date: payment.created_at || payment.payment_date,
      }));

      return [loanActivity, ...paymentActivities];
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 6);

const formatActivityDate = (value?: string): string => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getErrorMessage = (error: unknown): string => {
  const err = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return (
    err.response?.data?.message ||
    err.message ||
    "Unable to load dashboard statistics."
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState(emptyCounts);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [
          usersResponse,
          membersResponse,
          nonmembersResponse,
          loansResponse,
        ] = await Promise.all([
          api.get("/users"),
          api.get("/members"),
          api.get("/nonmembers"),
          api.get("/loans"),
        ]);

        const users = getResponseData<User[]>(usersResponse);
        const members = getResponseData<Member[]>(membersResponse);
        const nonmembers = getResponseData<Member[]>(nonmembersResponse);
        const loans = getResponseData<Loan[]>(loansResponse);

        if (
          !Array.isArray(users) ||
          !Array.isArray(members) ||
          !Array.isArray(nonmembers) ||
          !Array.isArray(loans)
        ) {
          throw new Error("Invalid dashboard data received from the server.");
        }

        let activeLoans = 0;
        let outstandingCents = 0;

        loans.forEach((loan) => {
          const paid = (loan.payments ?? []).reduce(
            (sum, payment) => sum + toNumber(payment.amount),
            0,
          );
          const balanceCents = Math.max(
            0,
            Math.round((getLoanTotal(loan) - paid) * 100),
          );

          if (balanceCents > 0) {
            activeLoans += 1;
            outstandingCents += balanceCents;
          }
        });

        setCounts({
          users: users.length,
          members: members.length,
          nonmembers: nonmembers.length,
          activeLoans,
          outstandingBalance: outstandingCents / 100,
        });
        setActivities(getRecentActivities(loans));
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const statistics = [
    {
      title: "Total Utilizador",
      value: counts.users.toLocaleString(),
      description: "",
      icon: "👥",
    },
    {
      title: "Total Membru",
      value: counts.members.toLocaleString(),
      description: "",
      icon: "🧑‍🤝‍🧑",
    },
    {
      title: "Total Non-Members",
      value: counts.nonmembers.toLocaleString(),
      description: "",
      icon: "👤",
    },
    {
      title: "Emprestimu Aktiva",
      value: counts.activeLoans.toLocaleString(),
      description: "",
      icon: "💰",
    },
    {
      title: "Outstanding Payments",
      value: formatCurrency(counts.outstandingBalance),
      description: `Husi emprestimu aktivu ${counts.activeLoans.toLocaleString()}`,
      icon: "🧾",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          Dashboard
        </h1>
        <h2 className="mt-1 text-lg text-gray-500">
          Bemvindu mai sistema manajementu C-HTM.
        </h2>
      </div>

      {/* Statistik responsif */}
      {errorMessage && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 sm:gap-5">
        {statistics.map((item) => (
          <div
            key={item.title}
            className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-500">{item.title}</p>
              <span className="text-2xl" aria-hidden="true">
                {item.icon}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:mt-4 sm:text-3xl">
              {loading ? "…" : errorMessage ? "—" : item.value}
            </h2>

            <p className="mt-2 text-xs text-gray-500">
              {errorMessage ? "Unavailable" : item.description}
            </p>
          </div>
        ))}
      </div>

      {/* Aktivitas terbaru */}
      <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
              Aktividade resente
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Aktividade resente husi rejistu emprestimu no pagamentu.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/administration/loan")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Haree Emprestimu
            </button>
            <button
              type="button"
              onClick={() => navigate("/administration/loanpayment")}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Haree Pagamentu
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500">
            Loading aktividade resente...
          </p>
        ) : errorMessage ? (
          <p className="mt-5 rounded-lg bg-red-50 p-5 text-center text-sm text-red-700">
            Aktividade resente la hetan.
          </p>
        ) : activities.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 sm:p-8">
            Seidauk iha atividade
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-gray-100">
            {activities.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                      activity.type === "payment"
                        ? "bg-emerald-100"
                        : "bg-blue-100"
                    }`}
                    aria-hidden="true"
                  >
                    {activity.type === "payment" ? "💵" : "💰"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {activity.title}
                    </p>
                    <p className="truncate text-sm text-gray-600">
                      {activity.borrower}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {activity.detail}
                    </p>
                  </div>
                </div>
                <div className="pl-[52px] sm:pl-0 sm:text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(activity.amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatActivityDate(activity.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
