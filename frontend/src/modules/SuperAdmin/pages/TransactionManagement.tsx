import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import api from "../../../services/api";

type TransactionType = "income" | "expense" | "transfer";
type AccountKind = "bank" | "cash" | "office";
type ModalType = "success" | "error" | "confirm" | "warning";

interface Account {
  id: number;
  name: string;
  opening_balance: number | string | null;
  opening_date?: string | null;
  balance?: number | string | null;
  closing_balance?: number | string | null;
  income_total?: number | string;
  expense_total?: number | string;
  transfer_in_total?: number | string;
  transfer_out_total?: number | string;
  is_active?: boolean | number;
}

interface Transaction {
  id: number;
  type: TransactionType;
  account_id: number | null;
  from_account_id: number | null;
  to_account_id: number | null;
  transaction_date: string;
  amount: number | string;
  category: string | null;
  ledger_category: string | null;
  description: string | null;
  account?: { id: number; name: string };
  from_account?: { id: number; name: string };
  to_account?: { id: number; name: string };
  fromAccount?: { id: number; name: string };
  toAccount?: { id: number; name: string };
}

interface TransactionForm {
  type: TransactionType;
  account_id: string;
  from_account_id: string;
  to_account_id: string;
  transaction_date: string;
  amount: string;
  ledger_category: string;
  category: string;
  description: string;
}

interface LedgerColumn {
  key: string;
  label: string;
  side: "credit" | "debit" | "info";
}

interface LedgerRow {
  transaction: Transaction | null;
  date: string;
  description: string;
  type: string;
  amount: number;
  columns: Record<string, number>;
  credit: number;
  debit: number;
  balance: number | null;
}

interface Notice {
  type: ModalType;
  title: string;
  message: string;
  confirmAction?: () => void;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const currentMonth = () => today().slice(0, 7);

const numeric = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric(value));

const formatDate = (value: string) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const emptyForm = (): TransactionForm => ({
  type: "income",
  account_id: "",
  from_account_id: "",
  to_account_id: "",
  transaction_date: today(),
  amount: "",
  ledger_category: "",
  category: "",
  description: "",
});

const ACCOUNT_COLUMNS: Record<AccountKind, LedgerColumn[]> = {
  bank: [
    { key: "bank_income", label: "Total Kreditu", side: "credit" },
    {
      key: "bank_withdrawal",
      label: "Levantamento / Cash withdrawal",
      side: "debit",
    },
    { key: "bank_charge", label: "Bank Charge", side: "debit" },
    { key: "bank_expense", label: "Despezas", side: "debit" },
  ],
  cash: [
    { key: "cash_income", label: "Total Kreditu", side: "credit" },
    { key: "transfer_to_office", label: "Transfer ba Kas CHTM", side: "debit" },
    { key: "bank_charge", label: "Bank Charge", side: "debit" },
    { key: "cash_expense", label: "Despezas", side: "debit" },
  ],
  office: [
    { key: "bank", label: "Hosi Bank", side: "credit" },
    { key: "member_deposit", label: "Depositu membru", side: "credit" },
    { key: "liquidation", label: "Likuidasaun", side: "credit" },
    { key: "office_credit_other", label: "Total Kreditu", side: "credit" },
    { key: "other_transaction", label: "Transaksaun Seluk", side: "debit" },
    { key: "loan_disbursement", label: "Emprestimu", side: "debit" },
    { key: "expense", label: "Despeza", side: "debit" },
  ],
};

const CATEGORY_OPTIONS: Record<
  AccountKind,
  { value: string; label: string; types: TransactionType[] }[]
> = {
  bank: [
    {
      value: "bank_income",
      label: "Bank income / Total Kreditu",
      types: ["income"],
    },
    {
      value: "bank_withdrawal",
      label: "Cash withdrawal / Levantamento",
      types: ["expense"],
    },
    { value: "bank_charge", label: "Bank Charge", types: ["expense"] },
    { value: "bank_expense", label: "Despezas", types: ["expense"] },
    {
      value: "transfer",
      label: "Transfer to another account",
      types: ["transfer"],
    },
  ],
  cash: [
    {
      value: "cash_income",
      label: "Cash income / Total Kreditu",
      types: ["income"],
    },
    {
      value: "transfer_to_office",
      label: "Transfer ba Kas CHTM",
      types: ["transfer"],
    },
    { value: "bank_charge", label: "Bank Charge", types: ["expense"] },
    { value: "cash_expense", label: "Despezas", types: ["expense"] },
    {
      value: "transfer",
      label: "Transfer to another account",
      types: ["transfer"],
    },
  ],
  office: [
    { value: "bank", label: "Hosi Bank", types: ["income", "transfer"] },
    { value: "member_deposit", label: "Depositu membru", types: ["income"] },
    { value: "liquidation", label: "Likuidasaun", types: ["income"] },
    {
      value: "other_transaction",
      label: "Transaksaun Seluk",
      types: ["income", "expense"],
    },
    { value: "loan_disbursement", label: "Emprestimu", types: ["expense"] },
    { value: "expense", label: "Despeza", types: ["expense"] },
  ],
};

function identifyAccount(account: Account): AccountKind {
  const name = account.name.toLowerCase();
  if (name.includes("bnu") || name.includes("bank")) return "bank";
  if (name.includes("brankas") || name.includes("manleu")) return "cash";
  return "office";
}

function getTransferSource(transaction: Transaction) {
  return transaction.from_account ?? transaction.fromAccount;
}

function getTransferDestination(transaction: Transaction) {
  return transaction.to_account ?? transaction.toAccount;
}

function getTransactionAccountId(transaction: Transaction) {
  return transaction.account_id;
}

function getEffectiveCategory(transaction: Transaction, kind: AccountKind) {
  if (transaction.ledger_category) return transaction.ledger_category;

  if (transaction.type === "transfer") {
    return kind === "office"
      ? "bank"
      : kind === "cash"
        ? "transfer_to_office"
        : "bank_withdrawal";
  }

  if (transaction.type === "income") {
    return kind === "office"
      ? "other_transaction"
      : kind === "cash"
        ? "cash_income"
        : "bank_income";
  }

  return kind === "office"
    ? "expense"
    : kind === "cash"
      ? "cash_expense"
      : "bank_expense";
}

function transactionBadge(type: string) {
  switch (type.toLowerCase()) {
    case "income":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "expense":
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    case "transfer":
      return "bg-sky-50 text-sky-700 ring-sky-600/20";
    default:
      return "bg-amber-50 text-amber-800 ring-amber-600/20";
  }
}

function ColumnAmount({
  column,
  value,
}: {
  column: LedgerColumn;
  value: number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs leading-5 text-gray-500">{column.label}</p>
      <p
        className={`mt-0.5 break-words text-sm font-semibold ${
          value === 0
            ? "text-gray-300"
            : column.side === "credit"
              ? "text-emerald-700"
              : column.side === "debit"
                ? "text-rose-700"
                : "text-gray-800"
        }`}
      >
        {formatAmountStatic(value)}
      </p>
    </div>
  );
}

function formatAmountStatic(value: number) {
  return value ? money(value) : "—";
}

export default function TransactionManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TransactionForm>(emptyForm());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/transactions", { params: { month } });
      const result = response.data;

      setTransactions(Array.isArray(result?.data) ? result.data : []);
      const returnedAccounts: Account[] = Array.isArray(result?.accounts)
        ? result.accounts
        : [];
      setAccounts(returnedAccounts);

      setSelectedAccountId((previous) => {
        if (
          previous &&
          returnedAccounts.some((account) => String(account.id) === previous)
        ) {
          return previous;
        }

        const active = returnedAccounts.find(
          (account) => account.is_active !== false && account.is_active !== 0,
        );

        return active ? String(active.id) : "";
      });
    } catch (error: any) {
      setTransactions([]);
      setAccounts([]);
      setNotice({
        type: "error",
        title: "Labele atu karrega dadus transaksaun",
        message:
          error?.response?.data?.message ??
          "Dadus transaksaun labela karrega. Favor verifika koneksaun API no konfigurasaun konta.",
      });
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_active !== false && account.is_active !== 0,
      ),
    [accounts],
  );

  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => String(account.id) === selectedAccountId) ??
      null,
    [accounts, selectedAccountId],
  );

  const accountKind = selectedAccount
    ? identifyAccount(selectedAccount)
    : "office";
  const columns = ACCOUNT_COLUMNS[accountKind];

  const availableCategories = CATEGORY_OPTIONS[accountKind].filter((option) =>
    option.types.includes(form.type),
  );

  useEffect(() => {
    if (availableCategories.length > 0) {
      const stillValid = availableCategories.some(
        (option) => option.value === form.ledger_category,
      );

      if (!stillValid) {
        setForm((previous) => ({
          ...previous,
          ledger_category: availableCategories[0].value,
        }));
      }
    } else if (form.ledger_category) {
      setForm((previous) => ({ ...previous, ledger_category: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, form.type, showForm]);

  const selectedAccountTransactions = useMemo(() => {
    if (!selectedAccount) return [];

    const selectedId = selectedAccount.id;

    return transactions
      .filter((transaction) => {
        if (transaction.type === "transfer") {
          return (
            transaction.from_account_id === selectedId ||
            transaction.to_account_id === selectedId
          );
        }

        return getTransactionAccountId(transaction) === selectedId;
      })
      .filter((transaction) => {
        if (typeFilter !== "all" && transaction.type !== typeFilter)
          return false;
        if (!search.trim()) return true;

        const query = search.toLowerCase();
        const source = getTransferSource(transaction);
        const destination = getTransferDestination(transaction);

        return [
          transaction.description,
          transaction.category,
          transaction.ledger_category,
          transaction.type,
          transaction.transaction_date,
          transaction.account?.name,
          source?.name,
          destination?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const dateCompare = a.transaction_date.localeCompare(
          b.transaction_date,
        );
        return dateCompare || a.id - b.id;
      });
  }, [transactions, selectedAccount, search, typeFilter]);

  const openingBalance = selectedAccount
    ? selectedAccount.opening_balance === null ||
      selectedAccount.opening_balance === undefined
      ? null
      : numeric(selectedAccount.opening_balance)
    : null;

  const ledgerRows = useMemo(() => {
    let balance: number | null = openingBalance;
    const rows: LedgerRow[] = [];

    if (selectedAccount) {
      rows.push({
        transaction: null,
        date: `${month}-01`,
        description: "Opening Balance / Saldo Anterior",
        type: "OPENING BALANCE",
        amount: 0,
        columns: {},
        credit: 0,
        debit: 0,
        balance,
      });
    }

    for (const transaction of selectedAccountTransactions) {
      if (!selectedAccount) continue;

      const amount = numeric(transaction.amount);
      const isTransfer = transaction.type === "transfer";
      const isTransferOut =
        isTransfer && transaction.from_account_id === selectedAccount.id;
      const isTransferIn =
        isTransfer && transaction.to_account_id === selectedAccount.id;

      const credit = isTransfer
        ? isTransferIn
          ? amount
          : 0
        : transaction.type === "income"
          ? amount
          : 0;

      const debit = isTransfer
        ? isTransferOut
          ? amount
          : 0
        : transaction.type === "expense"
          ? amount
          : 0;

      if (balance !== null) balance += credit - debit;

      const effectiveCategory = getEffectiveCategory(transaction, accountKind);
      const mappedColumns: Record<string, number> = {};

      if (isTransferIn) {
        mappedColumns[
          accountKind === "office"
            ? "bank"
            : accountKind === "cash"
              ? "cash_income"
              : "bank_income"
        ] = amount;
      } else if (isTransferOut) {
        mappedColumns[
          accountKind === "cash"
            ? "transfer_to_office"
            : accountKind === "bank"
              ? "bank_withdrawal"
              : "other_transaction"
        ] = amount;
      } else {
        mappedColumns[effectiveCategory] = amount;
      }

      const description =
        transaction.description ||
        transaction.category ||
        transaction.ledger_category ||
        (isTransfer
          ? isTransferOut
            ? `Transfer to ${getTransferDestination(transaction)?.name ?? "another account"}`
            : `Transfer from ${getTransferSource(transaction)?.name ?? "another account"}`
          : transaction.type);

      rows.push({
        transaction,
        date: transaction.transaction_date,
        description,
        type: transaction.type.toUpperCase(),
        amount,
        columns: mappedColumns,
        credit,
        debit,
        balance,
      });
    }

    return rows;
  }, [
    selectedAccount,
    selectedAccountTransactions,
    openingBalance,
    accountKind,
    month,
  ]);

  const totalCredit = ledgerRows.reduce((sum, row) => sum + row.credit, 0);
  const totalDebit = ledgerRows.reduce((sum, row) => sum + row.debit, 0);

  const closingBalance =
    openingBalance === null ? null : openingBalance + totalCredit - totalDebit;

  const formatAmount = (value: number) => (value ? money(value) : "—");

  const columnTotals = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          ledgerRows.reduce(
            (sum, row) => sum + (row.columns[column.key] ?? 0),
            0,
          ),
        ]),
      ),
    [columns, ledgerRows],
  );

  const updateForm = <K extends keyof TransactionForm>(
    key: K,
    value: TransactionForm[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const openAddForm = () => {
    if (activeAccounts.length === 0) {
      setNotice({
        type: "warning",
        title: "Cash account not configured",
        message:
          "Tambahkan dan aktifkan akun kas terlebih dahulu melalui pengaturan Cash Accounts.",
      });
      return;
    }

    setForm({ ...emptyForm(), account_id: selectedAccountId });
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({
        type: "warning",
        title: "Invalid amount",
        message: "Masukkan jumlah transaksi yang lebih besar dari nol.",
      });
      return;
    }

    if (!form.transaction_date) {
      setNotice({
        type: "warning",
        title: "Date required",
        message: "Tanggal transaksi wajib diisi.",
      });
      return;
    }

    if (!form.ledger_category) {
      setNotice({
        type: "warning",
        title: "Category required",
        message: "Pilih kategori ledger untuk menentukan kolom Excel.",
      });
      return;
    }

    if (
      form.type === "transfer" &&
      (!form.from_account_id ||
        !form.to_account_id ||
        form.from_account_id === form.to_account_id)
    ) {
      setNotice({
        type: "warning",
        title: "Invalid transfer",
        message: "Pilih akun asal dan akun tujuan yang berbeda untuk transfer.",
      });
      return;
    }

    if (form.type !== "transfer" && !form.account_id) {
      setNotice({
        type: "warning",
        title: "Account required",
        message: "Pilih akun untuk transaksi ini.",
      });
      return;
    }

    const payload = {
      type: form.type,
      account_id: form.type === "transfer" ? null : Number(form.account_id),
      from_account_id:
        form.type === "transfer" ? Number(form.from_account_id) : null,
      to_account_id:
        form.type === "transfer" ? Number(form.to_account_id) : null,
      transaction_date: form.transaction_date,
      amount,
      ledger_category: form.ledger_category,
      category: form.category.trim() || form.ledger_category,
      description: form.description.trim() || null,
    };

    setSaving(true);

    try {
      await api.post("/transactions", payload);
      setShowForm(false);
      setForm(emptyForm());
      setNotice({
        type: "success",
        title: "Transaksaun rai ona",
        message: "Transaksaun rai ona ho susesu.",
      });
      await loadTransactions();
    } catch (error: any) {
      setNotice({
        type: "error",
        title: "Labele atu rai dadus transaksaun",
        message:
          (error?.response?.data?.message ??
            Object.values(error?.response?.data?.errors ?? {})
              .flat()
              .join(" ")) ||
          "Transaksi gagal disimpan. Periksa kembali data yang dimasukkan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    setDeleting(true);

    try {
      await api.delete(`/transactions/${transaction.id}`);
      setNotice({
        type: "success",
        title: "Transaction deleted",
        message: "Transaksi berhasil dihapus.",
      });
      await loadTransactions();
    } catch (error: any) {
      setNotice({
        type: "error",
        title: "Unable to delete transaction",
        message:
          error?.response?.data?.message ??
          "Transaksi gagal dihapus. Silakan coba kembali.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const requestDelete = (transaction: Transaction) => {
    setNotice({
      type: "confirm",
      title: "Delete this transaction?",
      message:
        "Transaksi ini akan dihapus dan saldo akun akan dihitung ulang. Tindakan ini tidak dapat dibatalkan.",
      confirmAction: () => {
        setNotice(null);
        void handleDelete(transaction);
      },
    });
  };

  const selectedFormAccount = accounts.find(
    (account) => String(account.id) === form.account_id,
  );

  const formAccountKind = selectedFormAccount
    ? identifyAccount(selectedFormAccount)
    : accountKind;

  const formCategories = CATEGORY_OPTIONS[formAccountKind].filter((option) =>
    option.types.includes(form.type),
  );

  const inputClass =
    "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

  return (
    <div className="min-h-screen space-y-5 bg-slate-50/70 p-3 sm:space-y-6 sm:p-5 lg:p-7">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              C-HTM / Jestaun Finanseiru
            </p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Cash Transactions
          </h1>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex cursor-pointer w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 5v14m-7-7h14"
            />
          </svg>
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4h18M6 10h12m-9 6h6"
            />
          </svg>
          <h2 className="text-sm font-semibold text-gray-800">
            Find transactions
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[180px_minmax(200px,1fr)_190px]">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">
              Month
            </label>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={`${inputClass} cursor-pointer`}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">
              Search
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m16 16 4 4" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Description, category, account..."
                className={`${inputClass} cursor-pointer pl-10`}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-gray-500">
              Transaction type
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </div>
      </section>

      {/* Account selector */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-800">Cash accounts</h2>
          <span className="text-xs text-gray-500">
            {activeAccounts.length} active account(s)
          </span>
        </div>

        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-3">
            {accounts.map((account) => {
              const selected = selectedAccountId === String(account.id);
              const active =
                account.is_active !== false && account.is_active !== 0;
              const kind = identifyAccount(account);

              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccountId(String(account.id))}
                  className={`group flex min-w-[210px] items-center gap-3 rounded-2xl border p-3.5 text-left transition sm:min-w-[230px] ${
                    selected
                      ? "border-blue-500 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/10"
                      : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      kind === "bank"
                        ? "bg-violet-100 text-violet-700"
                        : kind === "cash"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {kind === "bank" ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m3 9 9-6 9 6M4 10h16M5 10v9m4-9v9m6-9v9m4-9v9M3 21h18M3 19h18"
                        />
                      </svg>
                    ) : kind === "cash" ? (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <rect x="3" y="6" width="18" height="13" rx="2" />
                        <circle cx="12" cy="12.5" r="3" />
                        <path strokeLinecap="round" d="M6 9h.01M18 16h.01" />
                      </svg>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4"
                        />
                      </svg>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${selected ? "text-blue-900" : "text-gray-800"}`}
                    >
                      {account.name}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`}
                      />
                      {active ? "Active account" : "Inactive account"}
                    </span>
                  </span>

                  {selected && (
                    <svg
                      className="h-5 w-5 shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m5 12 4 4L19 6"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!loading && accounts.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                />
              </svg>
            </span>
            <div>
              <h2 className="font-semibold">No cash accounts found</h2>
              <p className="mt-1 text-sm leading-6">
                Konfigurasikan akun kas terlebih dahulu. Akun tidak dibuat
                otomatis dari halaman transaksi ini.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedAccount && (
        <>
          {/* Summary cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Opening Balance"
              value={
                openingBalance === null
                  ? "Not configured"
                  : money(openingBalance)
              }
              subtitle="Saldo anterior"
              theme="blue"
              icon="wallet"
            />
            <SummaryCard
              label="Total Credit"
              value={money(totalCredit)}
              subtitle="Money received"
              theme="green"
              icon="arrow-down"
            />
            <SummaryCard
              label="Total Debit"
              value={money(totalDebit)}
              subtitle="Money spent or transferred out"
              theme="rose"
              icon="arrow-up"
            />
            <SummaryCard
              label="Closing Balance"
              value={
                closingBalance === null
                  ? "Not configured"
                  : money(closingBalance)
              }
              subtitle="Current calculated balance"
              theme="violet"
              icon="chart"
            />
          </section>

          {/* Ledger */}
          <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 5h16M4 10h16M4 15h10M4 20h10M18 15v5m-2.5-2.5h5"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900">
                    {selectedAccount.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadTransactions()}
                disabled={loading}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
              >
                <svg
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7v5h-5M4 17v-5h5m11-3a8 8 0 0 0-14-2L4 12m0 0a8 8 0 0 0 14 2l1-2"
                  />
                </svg>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-gray-500">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
                <p className="text-sm">Loading transactions...</p>
              </div>
            ) : openingBalance === null ? (
              <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:m-5">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    !
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900">
                      Opening balance is not configured
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Atur opening balance dan opening date pada pengaturan akun
                      sebelum menganggap saldo akhir sebagai nilai yang valid.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop ledger table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-max border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-100">
                        <th className="whitespace-nowrap px-4 py-4">No.</th>
                        <th className="whitespace-nowrap px-4 py-4">Date</th>
                        <th className="whitespace-nowrap px-4 py-4">Type</th>
                        <th className="min-w-[220px] px-4 py-4">Description</th>
                        <th className="whitespace-nowrap px-4 py-4 text-right">
                          Amount
                        </th>
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            className={`min-w-[150px] whitespace-nowrap px-4 py-4 text-right ${
                              column.side === "credit"
                                ? "text-emerald-200"
                                : column.side === "debit"
                                  ? "text-rose-200"
                                  : ""
                            }`}
                          >
                            {column.label}
                          </th>
                        ))}
                        <th className="whitespace-nowrap px-4 py-4 text-right">
                          Total Debit
                        </th>
                        <th className="whitespace-nowrap px-4 py-4 text-right">
                          Balance
                        </th>
                        <th className="px-4 py-4 text-center">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {ledgerRows.map((row, index) => (
                        <tr
                          key={row.transaction?.id ?? "opening"}
                          className={`transition-colors ${
                            !row.transaction
                              ? "bg-amber-50/80 font-semibold"
                              : "hover:bg-blue-50/50"
                          }`}
                        >
                          <td className="px-4 py-3.5 text-gray-500">
                            {row.transaction ? index : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">
                            {row.transaction
                              ? formatDate(row.date)
                              : `01/${month.split("-")[1]}/${month.split("-")[0]}`}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ring-1 ring-inset ${
                                row.transaction
                                  ? transactionBadge(row.type)
                                  : "bg-amber-100 text-amber-800 ring-amber-600/20"
                              }`}
                            >
                              {row.type}
                            </span>
                          </td>
                          <td className="max-w-[360px] px-4 py-3.5">
                            <p className="break-words font-medium text-gray-800">
                              {row.description}
                            </p>
                            {row.transaction?.category && (
                              <p className="mt-1 break-words text-xs text-gray-400">
                                {row.transaction.category}
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-gray-800">
                            {row.transaction ? money(row.amount) : "—"}
                          </td>
                          {columns.map((column) => {
                            const value = row.columns[column.key] ?? 0;
                            return (
                              <td
                                key={column.key}
                                className={`whitespace-nowrap px-4 py-3.5 text-right font-medium ${
                                  !value
                                    ? "text-gray-300"
                                    : column.side === "credit"
                                      ? "text-emerald-700"
                                      : column.side === "debit"
                                        ? "text-rose-700"
                                        : "text-gray-700"
                                }`}
                              >
                                {formatAmount(value)}
                              </td>
                            );
                          })}
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-medium text-rose-700">
                            {row.transaction ? money(row.debit) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900">
                            {row.balance === null ? "—" : money(row.balance)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {row.transaction && (
                              <button
                                type="button"
                                onClick={() => requestDelete(row.transaction!)}
                                aria-label="Delete transaction"
                                title="Delete transaction"
                                className="inline-flex cursor-pointer h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}

                      <tr className="bg-slate-100 font-bold text-gray-800">
                        <td colSpan={5} className="px-4 py-4 text-right">
                          MONTH TOTAL
                        </td>
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className="whitespace-nowrap px-4 py-4 text-right"
                          >
                            {money(columnTotals[column.key] ?? 0)}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-4 py-4 text-right text-rose-700">
                          {money(totalDebit)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right">
                          {closingBalance === null
                            ? "—"
                            : money(closingBalance)}
                        </td>
                        <td className="px-4 py-4 text-center">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile ledger cards */}
                <div className="space-y-3 bg-slate-50/70 p-3 md:hidden">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Transaction history
                    </p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                      {selectedAccountTransactions.length} record(s)
                    </span>
                  </div>

                  {ledgerRows.map((row, index) => {
                    const isOpening = !row.transaction;
                    const isTransferOut =
                      row.transaction?.type === "transfer" &&
                      row.transaction.from_account_id === selectedAccount?.id;
                    const isCredit = row.credit > 0;

                    return (
                      <article
                        key={row.transaction?.id ?? "opening-mobile"}
                        className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                          isOpening ? "border-amber-200" : "border-gray-200/80"
                        }`}
                      >
                        {isOpening ? (
                          <div className="flex items-center gap-3 bg-amber-50 px-4 py-3.5">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-amber-900">
                                Opening Balance
                              </p>
                              <p className="mt-0.5 text-xs text-amber-800">
                                Saldo anterior · {formatDate(row.date)}
                              </p>
                            </div>
                            <span className="shrink-0 text-right text-sm font-bold text-amber-900">
                              {row.balance === null ? "—" : money(row.balance)}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-3 p-4">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                  row.type === "INCOME"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : row.type === "EXPENSE"
                                      ? "bg-rose-50 text-rose-700"
                                      : "bg-sky-50 text-sky-700"
                                }`}
                              >
                                {row.type === "INCOME" ? (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 19V5m-7 7 7-7 7 7"
                                    />
                                  </svg>
                                ) : row.type === "EXPENSE" ? (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M12 5v14m-7-7 7 7 7-7"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M7 7h13l-4-4m4 4-4 4M17 17H4l4 4m-4-4 4-4"
                                    />
                                  </svg>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ring-1 ring-inset ${transactionBadge(row.type)}`}
                                  >
                                    {row.type}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    #{index}
                                  </span>
                                </div>
                                <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-gray-900">
                                  {row.description}
                                </h3>
                                <p className="mt-1.5 text-xs text-gray-500">
                                  {formatDate(row.date)}
                                </p>
                                {row.transaction?.category && (
                                  <p className="mt-1 break-words text-xs text-gray-400">
                                    Ref: {row.transaction.category}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  row.transaction &&
                                  requestDelete(row.transaction)
                                }
                                aria-label="Delete transaction"
                                title="Delete transaction"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <TrashIcon />
                              </button>
                            </div>

                            <div className="border-t border-gray-100 px-4 py-3">
                              <div className="flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500">
                                    {isTransferOut
                                      ? "Transferred out"
                                      : isCredit
                                        ? "Credit received"
                                        : row.debit > 0
                                          ? "Debit / money out"
                                          : "Transaction amount"}
                                  </p>
                                  <p
                                    className={`mt-1 break-words text-lg font-bold ${
                                      isCredit
                                        ? "text-emerald-700"
                                        : row.debit > 0
                                          ? "text-rose-700"
                                          : "text-gray-900"
                                    }`}
                                  >
                                    {money(row.amount)}
                                  </p>
                                </div>
                                <div className="min-w-0 text-right">
                                  <p className="text-xs text-gray-500">
                                    Running balance
                                  </p>
                                  <p className="mt-1 break-words text-sm font-bold text-gray-900">
                                    {row.balance === null
                                      ? "—"
                                      : money(row.balance)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 bg-gray-50/70 px-4 py-3 sm:grid-cols-3">
                              {columns.map((column) => (
                                <ColumnAmount
                                  key={column.key}
                                  column={column}
                                  value={row.columns[column.key] ?? 0}
                                />
                              ))}
                              <div>
                                <p className="text-xs leading-5 text-gray-500">
                                  Total Debit
                                </p>
                                <p
                                  className={`mt-0.5 text-sm font-semibold ${row.debit ? "text-rose-700" : "text-gray-300"}`}
                                >
                                  {formatAmount(row.debit)}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}

                  {selectedAccountTransactions.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 7h8m-8 4h8m-8 4h5M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                          />
                        </svg>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-gray-800">
                        No transactions found
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        No records match your selected month and filters.
                      </p>
                    </div>
                  )}

                  {/* Mobile month summary */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="mb-3 text-sm font-bold text-gray-900">
                      Monthly summary
                    </h3>
                    <div className="space-y-3">
                      {columns.map((column) => (
                        <div
                          key={column.key}
                          className="flex items-start justify-between gap-3"
                        >
                          <span className="min-w-0 text-xs leading-5 text-gray-500">
                            {column.label}
                          </span>
                          <span
                            className={`shrink-0 text-right text-sm font-semibold ${
                              column.side === "credit"
                                ? "text-emerald-700"
                                : column.side === "debit"
                                  ? "text-rose-700"
                                  : "text-gray-800"
                            }`}
                          >
                            {money(columnTotals[column.key] ?? 0)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                        <span className="text-sm text-gray-500">
                          Total Credit
                        </span>
                        <span className="text-sm font-bold text-emerald-700">
                          {money(totalCredit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-500">
                          Total Debit
                        </span>
                        <span className="text-sm font-bold text-rose-700">
                          {money(totalDebit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3 py-3">
                        <span className="text-sm font-semibold text-blue-900">
                          Closing Balance
                        </span>
                        <span className="break-words text-right text-base font-bold text-blue-900">
                          {closingBalance === null
                            ? "—"
                            : money(closingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedAccountTransactions.length === 0 && (
                  <div className="hidden px-5 py-12 text-center md:block">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                      <svg
                        className="h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7h8m-8 4h8m-8 4h5M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                        />
                      </svg>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-gray-800">
                      No transactions found
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No records match your selected month and filters.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="my-auto max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 p-4 backdrop-blur sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                  Add Transaction
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition hover:bg-gray-200"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Transaction Type *
                </label>
                <div className="grid grid-cols-3 gap-2 ">
                  {(
                    [
                      { value: "income", label: "Income", color: "emerald" },
                      { value: "expense", label: "Expense", color: "rose" },
                      { value: "transfer", label: "Transfer", color: "sky" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          type: option.value,
                          ledger_category: "",
                        }))
                      }
                      className={`rounded-xl cursor-pointer border px-2 py-3 text-sm font-semibold transition ${
                        form.type === option.value
                          ? option.color === "emerald"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10"
                            : option.color === "rose"
                              ? "border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-500/10"
                              : "border-sky-300 bg-sky-50 text-sky-800 ring-2 ring-sky-500/10"
                          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.type === "transfer" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      From Account *
                    </label>
                    <select
                      required
                      value={form.from_account_id}
                      onChange={(event) => {
                        const fromId = event.target.value;
                        const source = accounts.find(
                          (account) => String(account.id) === fromId,
                        );
                        const kind = source
                          ? identifyAccount(source)
                          : "office";
                        const firstCategory = CATEGORY_OPTIONS[kind].find(
                          (option) => option.types.includes("transfer"),
                        );

                        setForm((previous) => ({
                          ...previous,
                          from_account_id: fromId,
                          ledger_category: firstCategory?.value ?? "transfer",
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="">Select source account</option>
                      {activeAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      To Account *
                    </label>
                    <select
                      required
                      value={form.to_account_id}
                      onChange={(event) =>
                        updateForm("to_account_id", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select destination account</option>
                      {activeAccounts
                        .filter(
                          (account) =>
                            String(account.id) !== form.from_account_id,
                        )
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Cash Account *
                  </label>
                  <select
                    required
                    value={form.account_id}
                    onChange={(event) => {
                      const accountId = event.target.value;
                      const account = accounts.find(
                        (item) => String(item.id) === accountId,
                      );
                      const kind = account
                        ? identifyAccount(account)
                        : "office";
                      const firstCategory = CATEGORY_OPTIONS[kind].find(
                        (option) => option.types.includes(form.type),
                      );

                      setForm((previous) => ({
                        ...previous,
                        account_id: accountId,
                        ledger_category: firstCategory?.value ?? "",
                      }));
                    }}
                    className={inputClass}
                  >
                    <option value="">Select account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.transaction_date}
                    onChange={(event) =>
                      updateForm("transaction_date", event.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Amount (USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(event) =>
                        updateForm("amount", event.target.value)
                      }
                      placeholder="0.00"
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Ledger Category *
                </label>
                <select
                  required
                  value={form.ledger_category}
                  onChange={(event) =>
                    updateForm("ledger_category", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select ledger category</option>
                  {formCategories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs leading-5 text-gray-500">
                  This category determines which ledger column records the
                  transaction.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Reference / Category
                </label>
                <input
                  value={form.category}
                  onChange={(event) =>
                    updateForm("category", event.target.value)
                  }
                  placeholder="e.g. Monthly bank maintenance"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  rows={3}
                  placeholder="Additional transaction details..."
                  className={`${inputClass} resize-y`}
                />
              </div>

              <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white/95 p-4 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:p-0 sm:pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl cursor-pointer border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 sm:py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5"
                >
                  {saving && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {saving ? "Rai dadus..." : "Rai dadus transaksaun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Friendly confirmation and status modal */}
      {notice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl">
            <div className="p-5 sm:p-6">
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold ${
                  notice.type === "error"
                    ? "bg-rose-100 text-rose-700"
                    : notice.type === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : notice.type === "confirm"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {notice.type === "error"
                  ? "!"
                  : notice.type === "warning"
                    ? "!"
                    : notice.type === "confirm"
                      ? "?"
                      : "✓"}
              </div>

              <h2 className="text-lg font-bold text-gray-900">
                {notice.title}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                {notice.message}
              </p>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {notice.type === "confirm" && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setNotice(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}

                {notice.type === "confirm" ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => notice.confirmAction?.()}
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deleting ? "Hamoos..." : "Sim, Hamoos"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  theme,
  icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  theme: "blue" | "green" | "rose" | "violet";
  icon: "wallet" | "arrow-down" | "arrow-up" | "chart";
}) {
  const styles = {
    blue: {
      icon: "bg-blue-100 text-blue-700",
      bar: "bg-blue-500",
      label: "text-blue-700",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700",
      bar: "bg-emerald-500",
      label: "text-emerald-700",
    },
    rose: {
      icon: "bg-rose-100 text-rose-700",
      bar: "bg-rose-500",
      label: "text-rose-700",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700",
      bar: "bg-violet-500",
      label: "text-violet-700",
    },
  }[theme];

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.bar}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 break-words text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
        >
          {icon === "wallet" && (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <rect x="3" y="5" width="18" height="15" rx="2" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9h18m-5 5h2"
              />
            </svg>
          )}
          {icon === "arrow-down" && (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m-7-7 7 7 7-7"
              />
            </svg>
          )}
          {icon === "arrow-up" && (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 20V4m-7 7 7-7 7 7"
              />
            </svg>
          )}
          {icon === "chart" && (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 19V5m0 14h16M8 15l4-4 3 3 5-7"
              />
            </svg>
          )}
        </div>
      </div>

      <p className={`mt-3 text-xs font-medium ${styles.label}`}>{subtitle}</p>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"
      />
    </svg>
  );
}
