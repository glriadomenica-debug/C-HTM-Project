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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");
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
    {
      key: "transfer_to_office",
      label: "Transfer ba Kas CHTM",
      side: "debit",
    },
    { key: "bank_charge", label: "Bank Charge", side: "debit" },
    { key: "cash_expense", label: "Despezas", side: "debit" },
  ],
  office: [
    { key: "bank", label: "Hosi Bank", side: "credit" },
    { key: "member_deposit", label: "Depositu membru", side: "credit" },
    { key: "liquidation", label: "Likuidasaun", side: "credit" },
    { key: "office_credit_other", label: "Total Kreditu", side: "credit" },
    {
      key: "other_transaction",
      label: "Transaksaun Seluk",
      side: "debit",
    },
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

  // Backward compatibility for transactions created before ledger_category.
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
      const response = await api.get("/transactions", {
        params: { month },
      });

      // Laravel returns { message, data: transactions, accounts, month }.
      const result = response.data;

      setTransactions(Array.isArray(result?.data) ? result.data : []);
      setAccounts(Array.isArray(result?.accounts) ? result.accounts : []);

      const returnedAccounts: Account[] = Array.isArray(result?.accounts)
        ? result.accounts
        : [];

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
        title: "Unable to load transactions",
        message:
          error?.response?.data?.message ??
          "Data transaksi gagal dimuat. Periksa koneksi API dan konfigurasi akun.",
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
    // The selected account and transaction type determine the options.
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
        if (typeFilter !== "all" && transaction.type !== typeFilter) {
          return false;
        }

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
        if (accountKind === "office") {
          mappedColumns.bank = amount;
        } else {
          mappedColumns[
            accountKind === "cash" ? "cash_income" : "bank_income"
          ] = amount;
        }
      } else if (isTransferOut) {
        if (accountKind === "cash") {
          mappedColumns.transfer_to_office = amount;
        } else if (accountKind === "bank") {
          mappedColumns.bank_withdrawal = amount;
        } else {
          mappedColumns.other_transaction = amount;
        }
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

    setForm({
      ...emptyForm(),
      account_id: selectedAccountId,
    });
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
        title: "Transaction saved",
        message: "Transaksi berhasil disimpan.",
      });

      await loadTransactions();
    } catch (error: any) {
      setNotice({
        type: "error",
        title: "Unable to save transaction",
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Cash Transaction Management
          </h1>
          {/* <p className="mt-1 text-sm text-gray-500">
            Cash ledger untuk Bank BNU, Brankas I Manleu, dan Office CHTM.
          </p> */}
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          + Add Transaction
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Month
          </label>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Search transactions
          </label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search description, category, account..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Transaction type
          </label>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 cursor-pointer"
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => setSelectedAccountId(String(account.id))}
            className={`rounded-t-lg border px-4 py-3 text-sm font-medium ${
              selectedAccountId === String(account.id)
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {account.name}
          </button>
        ))}
      </div>

      {!loading && accounts.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="font-semibold">No cash accounts found</h2>
          <p className="mt-1 text-sm">
            Konfigurasikan akun kas terlebih dahulu. Akun tidak dibuat otomatis
            dari halaman transaksi ini.
          </p>
        </div>
      )}

      {selectedAccount && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Opening Balance"
              value={
                openingBalance === null
                  ? "Not configured"
                  : money(openingBalance)
              }
            />
            <SummaryCard label="Total Credit" value={money(totalCredit)} />
            <SummaryCard label="Total Debit" value={money(totalDebit)} />
            <SummaryCard
              label="Closing Balance"
              value={
                closingBalance === null
                  ? "Not configured"
                  : money(closingBalance)
              }
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {/* <h2 className="font-semibold text-gray-900">
                  {selectedAccount.name} — Excel Ledger
                </h2> */}
                <h2 className="font-semibold text-gray-900">
                  {selectedAccount.name}
                </h2>
                {/* <p className="text-sm text-gray-500">
                  Month: {month} · Currency: USD
                </p> */}
              </div>

              <button
                type="button"
                onClick={() => void loadTransactions()}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-10 text-center text-gray-500">
                Loading transactions...
              </div>
            ) : openingBalance === null ? (
              <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Saldo awal akun belum dikonfigurasi untuk bulan ini. Atur
                opening balance dan opening date pada pengaturan akun sebelum
                menganggap saldo akhir sebagai nilai yang valid.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-max border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-left text-white">
                      <th className="border border-gray-300 px-3 py-3">No</th>
                      <th className="border border-gray-300 px-3 py-3">Data</th>
                      <th className="border border-gray-300 px-3 py-3">
                        Tipu transaksaun
                      </th>
                      <th className="border border-gray-300 px-3 py-3">
                        Jurus / Description
                      </th>
                      <th className="border border-gray-300 px-3 py-3 text-right">
                        Montante
                      </th>

                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className="border border-gray-300 px-3 py-3 text-right"
                        >
                          {column.label}
                        </th>
                      ))}

                      <th className="border border-gray-300 px-3 py-3 text-right">
                        {accountKind === "office"
                          ? "Total Debet"
                          : "Total Debitu"}
                      </th>
                      <th className="border border-gray-300 px-3 py-3 text-right">
                        Balansa
                      </th>
                      <th className="border border-gray-300 px-3 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {ledgerRows.map((row, index) => (
                      <tr
                        key={row.transaction?.id ?? "opening"}
                        className={
                          row.transaction
                            ? "hover:bg-blue-50"
                            : "bg-yellow-50 font-semibold"
                        }
                      >
                        <td className="border border-gray-300 px-3 py-2">
                          {row.transaction ? index : "—"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {row.transaction
                            ? formatDate(row.date)
                            : `01/${month.split("-")[1]}/${month.split("-")[0]}`}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {row.type}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {row.description}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {row.transaction ? money(row.amount) : "—"}
                        </td>

                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className="border border-gray-300 px-3 py-2 text-right"
                          >
                            {formatAmount(row.columns[column.key] ?? 0)}
                          </td>
                        ))}

                        <td className="border border-gray-300 px-3 py-2 text-right">
                          {row.transaction ? money(row.debit) : "—"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                          {row.balance === null ? "—" : money(row.balance)}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          {row.transaction && (
                            <button
                              type="button"
                              onClick={() => requestDelete(row.transaction!)}
                              className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50 cursor-pointer"
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
                          )}
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-gray-100 font-semibold">
                      <td
                        colSpan={5}
                        className="border border-gray-300 px-3 py-3 text-right"
                      >
                        MONTH TOTAL
                      </td>

                      {columns.map((column) => {
                        const sum = ledgerRows.reduce(
                          (total, row) =>
                            total + (row.columns[column.key] ?? 0),
                          0,
                        );

                        return (
                          <td
                            key={column.key}
                            className="border border-gray-300 px-3 py-3 text-right"
                          >
                            {money(sum)}
                          </td>
                        );
                      })}

                      <td className="border border-gray-300 px-3 py-3 text-right">
                        {money(totalDebit)}
                      </td>
                      <td className="border border-gray-300 px-3 py-3 text-right">
                        {closingBalance === null ? "—" : money(closingBalance)}
                      </td>
                      <td className="border border-gray-300 px-3 py-3">—</td>
                    </tr>
                  </tbody>
                </table>

                {ledgerRows.length <= 1 && (
                  <p className="p-5 text-center text-sm text-gray-500">
                    Belum ada transaksi pada bulan ini.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Add Transaction
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Isi detail transaksi dengan benar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Transaction Type *
                </label>
                <select
                  required
                  value={form.type}
                  onChange={(event) => {
                    const type = event.target.value as TransactionType;
                    setForm((previous) => ({
                      ...previous,
                      type,
                      ledger_category: "",
                    }));
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              {form.type === "transfer" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                    <label className="mb-1 block text-sm font-medium">
                      To Account *
                    </label>
                    <select
                      required
                      value={form.to_account_id}
                      onChange={(event) =>
                        updateForm("to_account_id", event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                  <label className="mb-1 block text-sm font-medium">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
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
                  <label className="mb-1 block text-sm font-medium">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.transaction_date}
                    onChange={(event) =>
                      updateForm("transaction_date", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Amount (USD) *
                  </label>
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Ledger Category *
                </label>
                <select
                  required
                  value={form.ledger_category}
                  onChange={(event) =>
                    updateForm("ledger_category", event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Select ledger category</option>
                  {formCategories.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Kategori ini menentukan kolom Excel tempat nilai transaksi
                  ditampilkan.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Reference / Category
                </label>
                <input
                  value={form.category}
                  onChange={(event) =>
                    updateForm("category", event.target.value)
                  }
                  placeholder="e.g. Monthly bank maintenance"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateForm("description", event.target.value)
                  }
                  rows={3}
                  placeholder="Additional transaction details..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full text-xl ${
                notice.type === "error"
                  ? "bg-red-100 text-red-700"
                  : notice.type === "warning"
                    ? "bg-amber-100 text-amber-700"
                    : notice.type === "confirm"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
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

            <h2 className="text-lg font-semibold text-gray-900">
              {notice.title}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {notice.message}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              {notice.type === "confirm" && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setNotice(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}

              {notice.type === "confirm" ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => notice.confirmAction?.()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 break-words text-xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
