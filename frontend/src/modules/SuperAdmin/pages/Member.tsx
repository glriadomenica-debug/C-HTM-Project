import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import * as XLSX from "xlsx";
import api from "../../../services/api";

type Gender = "Male" | "Female";
type MembershipStatus = "Active" | "Inactive";
type ModalType = "success" | "error" | "confirm";

interface Member {
  id: number;
  member_number: string;
  full_name: string;
  gender: Gender;
  id_card_number: string;
  phone_number: string;
  address: string;
  employer: string;
  work_location: string;
  membership_status: MembershipStatus;
  deposits_count?: number;
  loans_count?: number;
  deposits?: unknown[];
  loans?: unknown[];
}

interface MemberForm {
  full_name: string;
  gender: Gender;
  id_card_number: string;
  phone_number: string;
  address: string;
  employer: string;
  work_location: string;
  membership_status: MembershipStatus;
}

const emptyForm: MemberForm = {
  full_name: "",
  gender: "Male",
  id_card_number: "",
  phone_number: "",
  address: "",
  employer: "",
  work_location: "",
  membership_status: "Active",
};

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

const labelClass = "block text-sm font-semibold text-slate-700";

const reportHeaders = [
  "No.",
  "Member Number",
  "Full Name",
  "Gender",
  "ID Card Number",
  "Phone Number",
  "Address",
  "Employer",
  "Work Location",
  "Membership Status",
  "Total Deposits",
  "Total Loans",
] as const;

type ReportHeader = (typeof reportHeaders)[number];

interface MemberReportRow {
  "No.": number;
  "Member Number": string;
  "Full Name": string;
  Gender: string;
  "ID Card Number": string;
  "Phone Number": string;
  Address: string;
  Employer: string;
  "Work Location": string;
  "Membership Status": string;
  "Total Deposits": number;
  "Total Loans": number;
}

function getErrorMessage(error: unknown): string {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Record<string, unknown>;
        data?: Record<string, unknown>;
      };
    };
    message?: string;
  };

  const response = err?.response?.data;
  const errors = response?.errors ?? response?.data;

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    for (const value of Object.values(errors)) {
      const first = Array.isArray(value) ? value[0] : value;

      if (typeof first === "string") {
        return first;
      }
    }
  }

  return (
    response?.message ||
    err?.message ||
    "An unexpected error occurred. Please try again."
  );
}

function getResponseData<T>(response: unknown): T[] | null {
  const payload = (response as { data?: unknown })?.data;

  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;

    if (Array.isArray(data)) {
      return data as T[];
    }

    if (data && typeof data === "object") {
      const nested = (data as { data?: unknown }).data;

      if (Array.isArray(nested)) {
        return nested as T[];
      }
    }
  }

  return null;
}

function dateStamp(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDepositCount(member: Member): number {
  return member.deposits_count ?? member.deposits?.length ?? 0;
}

function getLoanCount(member: Member): number {
  return member.loans_count ?? member.loans?.length ?? 0;
}

function reportRows(members: Member[]): MemberReportRow[] {
  return members.map((member, index) => ({
    "No.": index + 1,
    "Member Number": member.member_number || "",
    "Full Name": member.full_name || "",
    Gender: member.gender || "",
    "ID Card Number": member.id_card_number || "",
    "Phone Number": member.phone_number || "",
    Address: member.address || "",
    Employer: member.employer || "",
    "Work Location": member.work_location || "",
    "Membership Status": member.membership_status || "Inactive",
    "Total Deposits": getDepositCount(member),
    "Total Loans": getLoanCount(member),
  }));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Member() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>({ ...emptyForm });

  const [modal, setModal] = useState<ModalType | null>(null);
  const [message, setMessage] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/members");
      const rows = getResponseData<Member>(response);

      if (!rows) {
        throw new Error("Invalid member data received from the server.");
      }

      setMembers(rows);
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) {
      return members;
    }

    return members.filter((member) =>
      [
        member.member_number,
        member.full_name,
        member.gender,
        member.id_card_number,
        member.phone_number,
        member.employer,
        member.work_location,
        member.address,
        member.membership_status,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      ),
    );
  }, [members, search]);

  const activeMembers = useMemo(
    () =>
      members.filter((member) => member.membership_status === "Active").length,
    [members],
  );

  const inactiveMembers = useMemo(
    () =>
      members.filter((member) => member.membership_status === "Inactive")
        .length,
    [members],
  );

  
const openCreateForm = () => {
  setEditingMember(null);
  setForm({ ...emptyForm });
  setShowForm(true);
};

const openEditForm = (member: Member) => {
  setEditingMember(member);

  setForm({
    full_name: member.full_name ?? "",
    gender: member.gender ?? "Male",
    id_card_number: member.id_card_number ?? "",
    phone_number: member.phone_number ?? "",
    address: member.address ?? "",
    employer: member.employer ?? "",
    work_location: member.work_location ?? "",
    membership_status: member.membership_status ?? "Active",
  });

  setShowForm(true);
};

const closeForm = () => {
  if (saving) return;

  setShowForm(false);
  setEditingMember(null);
  setForm({ ...emptyForm });
};

const updateField = <K extends keyof MemberForm>(
  field: K,
  value: MemberForm[K],
) => {
  setForm((previous) => ({
    ...previous,
    [field]: value,
  }));
};

const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (saving) return;

  setSaving(true);

  try {
    const payload: MemberForm = { ...form };

    const response = editingMember
      ? await api.put(`/members/${editingMember.id}`, payload)
      : await api.post("/members", payload);

    setMessage(
      response.data?.message ||
        (editingMember
          ? "Member updated successfully."
          : "Member created successfully."),
    );

    setShowForm(false);
    setEditingMember(null);
    setForm({ ...emptyForm });
    setModal("success");

    await fetchMembers();
  } catch (error) {
    setMessage(getErrorMessage(error));
    setModal("error");
  } finally {
    setSaving(false);
  }
};

  const confirmDelete = (member: Member) => {
    setSelectedMember(member);

    setMessage(
      `Are you sure you want to delete "${member.full_name}"? This action cannot be undone.`,
    );

    setModal("confirm");
  };

  const handleDelete = async () => {
    if (!selectedMember || deleting) return;

    setDeleting(true);

    try {
      const response = await api.delete(`/members/${selectedMember.id}`);

      setMessage(response.data?.message || "Member deleted successfully.");
      setModal("success");
      setSelectedMember(null);

      await fetchMembers();
    } catch (error) {
      setMessage(getErrorMessage(error));
      setModal("error");
      setSelectedMember(null);
    } finally {
      setDeleting(false);
    }
  };

const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(10);

const totalPages = Math.max(
  1,
  Math.ceil(filteredMembers.length / pageSize),
);

const paginatedMembers = useMemo(() => {
  const startIndex = (currentPage - 1) * pageSize;

  return filteredMembers.slice(startIndex, startIndex + pageSize);
}, [filteredMembers, currentPage, pageSize]);

const startItem =
  filteredMembers.length === 0
    ? 0
    : (currentPage - 1) * pageSize + 1;

const endItem = Math.min(
  currentPage * pageSize,
  filteredMembers.length,
);

useEffect(() => {
  setCurrentPage(1);
}, [search, pageSize]);

useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages]);

  const closeModal = () => {
    if (deleting) return;

    setModal(null);
    setMessage("");
    setSelectedMember(null);
  };

  const closeExportMenu = () => {
    setExportOpen(false);
  };

  const exportExcel = () => {
    if (filteredMembers.length === 0) return;

    const rows = reportRows(filteredMembers);
    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 7 },
      { wch: 18 },
      { wch: 28 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 32 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
    ];

    // Row 0 is the header. The last data row is filteredMembers.length.
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: filteredMembers.length, c: reportHeaders.length - 1 },
      }),
    };

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Members");

    XLSX.writeFile(workbook, `CHTM_Member_Report_${dateStamp()}.xlsx`);

    closeExportMenu();
  };

  const exportCSV = () => {
    if (filteredMembers.length === 0) return;

    const rows = reportRows(filteredMembers);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    downloadBlob(
      new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      }),
      `CHTM_Member_Report_${dateStamp()}.csv`,
    );

    closeExportMenu();
  };

  const exportWord = () => {
    if (filteredMembers.length === 0) return;

    const rows = reportRows(filteredMembers);

    const tableHeader = reportHeaders
      .map((header) => `<th>${escapeHtml(header)}</th>`)
      .join("");

    const tableRows = rows
      .map(
        (row) =>
          `<tr>${reportHeaders
            .map(
              (header: ReportHeader) => `<td>${escapeHtml(row[header])}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CHTM Member Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1e293b;
          }

          h1 {
            color: #1e3a8a;
            margin-bottom: 5px;
          }

          p {
            color: #64748b;
            font-size: 10pt;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
          }

          th {
            background: #1e293b;
            color: white;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px;
            text-align: left;
          }

          tr:nth-child(even) {
            background: #f1f5f9;
          }

          @page {
            size: landscape;
            margin: 1.2cm;
          }
        </style>
      </head>
      <body>
        <h1>C-HTM Member Report</h1>
        <p>Generated on: ${escapeHtml(dateStamp())}</p>
        <p>Total members in this report: ${filteredMembers.length}</p>
        <table>
          <thead>
            <tr>${tableHeader}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    downloadBlob(
      new Blob(["\uFEFF", html], {
        type: "application/msword;charset=utf-8;",
      }),
      `CHTM_Member_Report_${dateStamp()}.doc`,
    );

    closeExportMenu();
  };

  const printReport = () => {
    closeExportMenu();
    window.print();
  };

  return (
    <div className="member-report-print min-h-full space-y-5 bg-slate-50/80 p-3 sm:space-y-6 sm:p-5 lg:p-6">
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            C-HTM / Member Management
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Members
          </h1>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200 active:scale-[0.98] cursor-pointer"
        >
          <Icon name="plus" />
          Add Member
        </button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
        <SummaryCard
          title="Total Members"
          value={members.length}
          color="blue"
          icon="users"
        />

        <SummaryCard
          title="Active Members"
          value={activeMembers}
          color="green"
          icon="check"
        />

        <SummaryCard
          title="Inactive Members"
          value={inactiveMembers}
          color="gray"
          icon="users"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5 print:hidden">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Member List
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
                  {filteredMembers.length}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Icon name="search" />
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search members..."
                  aria-label="Search members"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 cursor-pointer"
                />
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportOpen((open) => !open)}
                  disabled={loading || filteredMembers.length === 0}
                  aria-expanded={exportOpen}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed cursor-pointer disabled:opacity-50 sm:w-auto"
                >
                  <Icon name="download" />
                  Export
                  <Icon name="chevron" />
                </button>

                {exportOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close export menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={closeExportMenu}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <ExportOption
                        icon="print"
                        title="Print"
                        description="Print-ready report"
                        color="slate"
                        onClick={printReport}
                      />
                      <ExportOption
                        icon="excel"
                        title="Excel"
                        description="Download .xlsx file"
                        color="green"
                        onClick={exportExcel}
                      />
                      <ExportOption
                        icon="word"
                        title="Word"
                        description="Download .doc file"
                        color="blue"
                        onClick={exportWord}
                      />
                      <ExportOption
                        icon="csv"
                        title="CSV"
                        description="Download .csv file"
                        color="purple"
                        onClick={exportCSV}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick status indicators */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Active:{" "}
              <strong className="text-slate-800">{activeMembers}</strong>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Inactive:{" "}
              <strong className="text-slate-800">{inactiveMembers}</strong>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Showing:{" "}
              <strong className="text-slate-800">
                {filteredMembers.length}
              </strong>{" "}
              of {members.length}
            </span>
          </div>
        </div>

        {/* Print heading */}
        <div className="hidden px-5 py-4 print:block">
          <h1 className="text-xl font-bold text-slate-900">
            C-HTM Member Report
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Generated on {dateStamp()} · {filteredMembers.length} members
          </p>
          {search.trim() && (
            <p className="mt-1 text-sm text-slate-600">
              Search filter: {search}
            </p>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              Loading members...
            </p>
          </div>
        ) : filteredMembers.length === 0 ? (
          /* Empty state */
          <div className="px-4 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Icon name="users" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">
              {search.trim() ? "No matching members" : "No members registered"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
              {search.trim()
                ? "No members match your search. Try a different name, member number, or phone number."
                : "Add a member to start building your member registry."}
            </p>
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 md:hidden print:hidden">
              {paginatedMembers.map((member) => (
                <article
                  key={member.id}
                  className="p-4 transition hover:bg-blue-50/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base font-bold text-blue-700">
                      {member.full_name?.trim().charAt(0).toUpperCase() || "M"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-slate-900">
                            {member.full_name || "-"}
                          </h3>
                          <p className="mt-1 text-xs font-medium text-blue-700">
                            {member.member_number || "-"}
                          </p>
                        </div>
                        <StatusBadge status={member.membership_status} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl bg-slate-50 p-3">
                    <MobileField
                      label="Phone number"
                      value={member.phone_number}
                    />
                    <MobileField label="Gender" value={member.gender} />
                    <MobileField
                      label="ID card number"
                      value={member.id_card_number}
                    />
                    <MobileField label="Employer" value={member.employer} />
                    <MobileField
                      label="Work location"
                      value={member.work_location}
                    />
                    <MobileField label="Address" value={member.address} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700">
                        Deposits: {getDepositCount(member)}
                      </span>
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">
                        Loans: {getLoanCount(member)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(member)}
                        aria-label={`Edit ${member.full_name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 cursor-pointer"
                      >
                        <Icon name="edit" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(member)}
                        aria-label={`Delete ${member.full_name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
                      >
                        <Icon name="trash" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop data table */}
            <div className="hidden w-full overflow-x-auto md:block">
              <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
                <thead className="bg-slate-800 text-xs uppercase tracking-wider text-slate-100">
                  <tr>
                    <th className="w-16 whitespace-nowrap px-4 py-4 text-center font-semibold">
                      No.
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Member Number
                    </th>
                    <th className="min-w-52 px-4 py-4 font-semibold">
                      Member Details
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      ID Card Number
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Phone Number
                    </th>
                    <th className="min-w-40 px-4 py-4 font-semibold">
                      Address
                    </th>
                    <th className="min-w-36 px-4 py-4 font-semibold">
                      Employer
                    </th>
                    <th className="min-w-36 px-4 py-4 font-semibold">
                      Work Location
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 font-semibold">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 text-center font-semibold">
                      Deposits
                    </th>
                    <th className="whitespace-nowrap px-4 py-4 text-center font-semibold">
                      Loans
                    </th>
                    <th className="sticky right-0 z-10 whitespace-nowrap bg-slate-800 px-4 py-4 text-center font-semibold print:hidden">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedMembers.map((member, index) => (
                    <tr
                      key={member.id}
                      className="group transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50"
                    >
                      <td className="px-4 py-4 text-center tabular-nums text-slate-400">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-100">
                          {member.member_number || "-"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-700">
                            {member.full_name?.trim().charAt(0).toUpperCase() ||
                              "M"}
                          </div>
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-slate-900">
                              {member.full_name || "-"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {member.gender || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {member.id_card_number || "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {member.phone_number || "-"}
                      </td>

                      <td className="max-w-56 whitespace-normal break-words px-4 py-4 text-slate-600">
                        {member.address || "-"}
                      </td>

                      <td className="max-w-48 whitespace-normal break-words px-4 py-4 text-slate-600">
                        {member.employer || "-"}
                      </td>

                      <td className="max-w-48 whitespace-normal break-words px-4 py-4 text-slate-600">
                        {member.work_location || "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <StatusBadge status={member.membership_status} />
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-9 items-center justify-center rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-purple-700">
                          {getDepositCount(member)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-9 items-center justify-center rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-blue-700">
                          {getLoanCount(member)}
                        </span>
                      </td>

                      <td className="sticky right-0 bg-white/95 px-3 py-4 text-center shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.5)] group-hover:bg-blue-50 print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(member)}
                            title="Edit member"
                            aria-label={`Edit ${member.full_name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 transition hover:border-blue-300 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer"
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(member)}
                            title="Delete member"
                            aria-label={`Delete ${member.full_name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-red-100 cursor-pointer "
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Table footer */}
        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p>
            Showing{" "}
            <strong className="text-slate-800">{filteredMembers.length}</strong>{" "}
            of <strong className="text-slate-800">{members.length}</strong>{" "}
            members
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="member-page-size" className="text-xs font-medium text-slate-600">
                Rows per page 
              </label>
              
              <select id="member-page-size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <span className="text-xs text-slate-500">
                Showing{" "}
                <strong className="text-slate-800">{startItem}–{endItem}</strong>
                {" "}of{" "}
                <strong className="text-slate-800">
                  {filteredMembers.length}
                </strong>
              </span>
            </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1 || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon name="chevron-left" /> Previous </button>
              <span className="whitespace-nowrap text-xs font-medium text-slate-600">
                Page <strong className="text-slate-900">{currentPage}</strong> of{" "}
                <strong className="text-slate-900">{totalPages}</strong>
              </span>

            <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages || loading} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" >
              Next 
              <Icon name="chevron-right" />
            </button>
          </div>
          </div>

        <button type="button" onClick={() => void fetchMembers()} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
        <Icon name="refresh" />
        Refresh list
        </button>
      </footer>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5 print:hidden">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingMember ? "Edit Member" : "Add New Member"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
              >
                <Icon name="warning" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-6">
                {/* Automatically generated or read-only member number */}
                {editingMember ? (
                  <FormField label="Member Number">
                    <div className="mt-1 flex min-h-[42px] items-center rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5">
                      <span className="text-sm font-bold text-blue-800">
                        {editingMember.member_number || "-"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      This number cannot be changed.
                    </p>
                  </FormField>
                ) : (
                  <FormField label="Member Number">
                    <div className="mt-1 flex min-h-[42px] items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2.5">
                      <Icon name="check" />
                      <span className="text-sm font-medium text-blue-800">
                        Automatically generated
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      A unique number will be assigned when you save this member.
                    </p>
                  </FormField>
                )}

                <FormField label="Full Name" required>
                  <input
                    required
                    maxLength={255}
                    value={form.full_name}
                    onChange={(event) =>
                      updateField("full_name", event.target.value)
                    }
                    placeholder="Enter full name"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Gender" required>
                  <select
                    required
                    value={form.gender}
                    onChange={(event) =>
                      updateField("gender", event.target.value as Gender)
                    }
                    className={inputClass}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </FormField>

                <FormField label="ID Card Number" required>
                  <input
                    required
                    maxLength={255}
                    value={form.id_card_number}
                    onChange={(event) =>
                      updateField("id_card_number", event.target.value)
                    }
                    placeholder="Enter ID card number"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Phone Number" required>
                  <input
                    required
                    maxLength={255}
                    value={form.phone_number}
                    onChange={(event) =>
                      updateField("phone_number", event.target.value)
                    }
                    placeholder="Enter phone number"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Employer" required>
                  <input
                    required
                    maxLength={255}
                    value={form.employer}
                    onChange={(event) =>
                      updateField("employer", event.target.value)
                    }
                    placeholder="Enter employer"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Work Location" required>
                  <input
                    required
                    maxLength={255}
                    value={form.work_location}
                    onChange={(event) =>
                      updateField("work_location", event.target.value)
                    }
                    placeholder="Enter work location"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Membership Status" required>
                  <select
                    required
                    value={form.membership_status}
                    onChange={(event) =>
                      updateField(
                        "membership_status",
                        event.target.value as MembershipStatus,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </FormField>

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    maxLength={255}
                    rows={3}
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    placeholder="Enter address"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed cursor-pointer disabled:opacity-60"
                >
                  {saving && <Spinner />}
                  {saving
                    ? "Saving..."
                    : editingMember
                      ? "Update Member"
                      : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Confirmation and feedback modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  modal === "success"
                    ? "bg-green-100 text-green-700"
                    : modal === "confirm"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                <Icon name={modal === "success" ? "check" : "warning"} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">
                  {modal === "success"
                    ? "Success"
                    : modal === "confirm"
                      ? "Confirm Delete"
                      : "Something Went Wrong"}
                </h3>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              {modal === "confirm" ? (
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={deleting}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 cursor-pointer text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed cursor-pointer disabled:opacity-60"
                  >
                    {deleting && <Spinner />}
                    {deleting ? "Deleting..." : "Delete Member"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print styling */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }

          body {
            background: #fff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden !important;
          }

          .member-report-print,
          .member-report-print * {
            visibility: visible !important;
          }

          .member-report-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }

          .member-report-print .print\\:hidden {
            display: none !important;
          }

          .member-report-print .print\\:block {
            display: block !important;
          }

          .member-report-print .md\\:hidden {
            display: none !important;
          }

          .member-report-print .overflow-hidden,
          .member-report-print .overflow-x-auto {
            overflow: visible !important;
          }

          .member-report-print table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto !important;
            font-size: 7pt !important;
          }

          .member-report-print th,
          .member-report-print td {
            padding: 4px !important;
            overflow-wrap: anywhere !important;
          }

          .member-report-print thead {
            display: table-header-group;
          }

          .member-report-print tr {
            break-inside: avoid;
          }

          .member-report-print section {
            border: none !important;
            box-shadow: none !important;
          }

          .member-report-print .rounded-2xl {
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: number;
  color: "blue" | "green" | "gray";
  icon: "users" | "check";
}) {
  const colors = {
    blue: {
      iconBox: "bg-blue-100 text-blue-700",
      number: "text-blue-700",
      border: "border-blue-100",
      accent: "bg-blue-500",
    },
    green: {
      iconBox: "bg-green-100 text-green-700",
      number: "text-green-700",
      border: "border-green-100",
      accent: "bg-green-500",
    },
    gray: {
      iconBox: "bg-slate-100 text-slate-600",
      number: "text-slate-800",
      border: "border-slate-200",
      accent: "bg-slate-400",
    },
  }[color];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${colors.border} bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${colors.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p
            className={`mt-2 text-3xl font-bold tracking-tight ${colors.number}`}
          >
            {value.toLocaleString()}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.iconBox}`}
        >
          <Icon name={icon} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: MembershipStatus }) {
  const active = status === "Active";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
      }`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          active ? "bg-green-500" : "bg-slate-400"
        }`}
      />

      {status || "Inactive"}
    </span>
  );
}

function MobileField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-0.5 break-words text-sm font-medium text-slate-800">
        {value || "-"}
      </p>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {children}
    </div>
  );
}

function ExportOption({
  icon,
  title,
  description,
  color,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  color: "slate" | "green" | "blue" | "purple";
  onClick: () => void;
}) {
  const colors = {
    slate: "bg-slate-100 text-slate-700 group-hover:bg-slate-200",
    green: "bg-green-100 text-green-700 group-hover:bg-green-200",
    blue: "bg-blue-100 text-blue-700 group-hover:bg-blue-200",
    purple: "bg-purple-100 text-purple-700 group-hover:bg-purple-200",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${colors[color]}`}
      >
        <Icon name={icon} />
      </span>

      <span>
        <span className="block text-sm font-semibold text-slate-800">
          {title}
        </span>

        <span className="mt-0.5 block text-xs text-slate-500">
          {description}
        </span>
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
  );
}

function Icon({ name }: { name: string }) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m16 16 4 4" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v12m-5-5 5 5 5-5M5 17v3h14v-3"
          />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m7 10 5 5 5-5"
          />
        </svg>
      );

    case "print":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 8V3.5h10V8M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 14h10v6.5H7z"
          />
        </svg>
      );

    case "excel":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 3v7h7M8 13l4 5m0-5-4 5"
          />
        </svg>
      );

    case "word":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 3v7h7M7.5 13l1.5 5 2-4 2 4 1.5-5"
          />
        </svg>
      );

    case "csv":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 3v7h7M8 14h8M8 17h8"
          />
        </svg>
      );

    case "edit":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m16.86 4.49 2.65 2.65M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z"
          />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"
          />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
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
      );

    case "check":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m5 12 4 4L19 6"
          />
        </svg>
      );

    case "warning":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.3 3.86 1.82 18.5A2 2 0 0 0 3.55 21h16.9a2 2 0 0 0 1.73-2.5L13.7 3.86a2 2 0 0 0-3.4 0Z"
          />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 19h6v-1a4 4 0 0 0-6-3.46M16 19H8m8 0v-1a4 4 0 0 0-8 0v1m8-10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm6 10v-1a4 4 0 0 0-3-3.87M2 19v-1a4 4 0 0 1 3-3.87"
          />
        </svg>
      );
  }
}
