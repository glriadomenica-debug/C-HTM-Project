import { useCallback, useEffect, useState, type FormEvent } from "react";
import api from "../../../services/api";

type Tab = "profile" | "password";
type ModalType = "confirm" | "success" | "error" | "warning";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone_number: string | null;
  role_id?: number;
  role?: {
    id: number;
    role_name: string;
  } | null;
}

interface ProfileForm {
  name: string;
  email: string;
  phone_number: string;
}

interface PasswordForm {
  current_password: string;
  password: string;
  password_confirmation: string;
}

type FieldErrors = Record<string, string>;

interface AppModalProps {
  type: ModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
}

const emptyProfile: ProfileForm = {
  name: "",
  email: "",
  phone_number: "",
};

const emptyPassword: PasswordForm = {
  current_password: "",
  password: "",
  password_confirmation: "",
};

function responseData<T>(response: any): T {
  const body = response?.data;

  if (body?.data !== undefined) return body.data as T;
  if (body?.user !== undefined) return body.user as T;

  return body as T;
}

function apiErrors(error: any): FieldErrors {
  const errors = error?.response?.data?.errors;

  if (!errors || typeof errors !== "object") return {};

  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0]) : String(value),
    ]),
  );
}

function friendlyError(error: any, fallback: string): string {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (!error?.response) {
    return "Unable to connect to the server. Please check your internet connection or API server and try again.";
  }

  if (status === 401) {
    return "Your session may have expired. Please log in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 404) {
    return "Endpoint not found. Please check the Laravel backend route configuration.";
  }

  if (status === 422) {
    return message || "The submitted data is invalid. Please review the form.";
  }

  if (status === 429) {
    return "Too many attempts. Please wait a moment before trying again.";
  }

  if (status >= 500) {
    return "The server is experiencing a problem. Please try again later.";
  }

  return message || fallback;
}

function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${
        small ? "h-4 w-4" : "h-7 w-7"
      }`}
    />
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
  suffix,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
            suffix ? "pr-24" : ""
          } ${
            error
              ? "border-red-300 focus:border-red-400 focus:ring-red-50"
              : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-50"
          }`}
        />

        {suffix && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            {suffix}
          </div>
        )}
      </div>

      {error && (
        <p
          id={`${name}-error`}
          role="alert"
          className="mt-1.5 text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function AppModal({
  modal,
  busy,
  onClose,
}: {
  modal: AppModalProps;
  busy: boolean;
  onClose: () => void;
}) {
  const appearance: Record<
    ModalType,
    { icon: string; iconClass: string; buttonClass: string }
  > = {
    confirm: {
      icon: "?",
      iconClass: "bg-indigo-50 text-indigo-600",
      buttonClass: "bg-indigo-600 hover:bg-indigo-700",
    },
    success: {
      icon: "✓",
      iconClass: "bg-emerald-50 text-emerald-600",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
    },
    error: {
      icon: "!",
      iconClass: "bg-red-50 text-red-600",
      buttonClass: "bg-red-600 hover:bg-red-700",
    },
    warning: {
      icon: "!",
      iconClass: "bg-amber-50 text-amber-600",
      buttonClass: "bg-amber-600 hover:bg-amber-700",
    },
  };

  const style = appearance[modal.type];
  const isConfirm = modal.type === "confirm";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        aria-describedby="settings-modal-message"
        className="w-full max-w-md animate-[modalIn_.18s_ease-out] rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${style.iconClass}`}
          >
            {style.icon}
          </div>

          <h2
            id="settings-modal-title"
            className="text-lg font-bold text-slate-900"
          >
            {modal.title}
          </h2>

          <p
            id="settings-modal-message"
            className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500"
          >
            {modal.message}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {isConfirm && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {modal.cancelText || "Cancel"}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isConfirm && modal.onConfirm) {
                void modal.onConfirm();
              } else {
                onClose();
              }
            }}
            disabled={busy}
            autoFocus
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed cursor-pointer disabled:opacity-60 ${style.buttonClass}`}
          >
            {busy && <Spinner small />}
            {busy
              ? "Processing..."
              : isConfirm
                ? modal.confirmText || "Yes, Continue"
                : "Got it"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
        active
          ? "border-indigo-200 bg-indigo-50"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${
          active ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-500"
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold ${
            active ? "text-indigo-700" : "text-slate-700"
          }`}
        >
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>

      {active && (
        <span className="mt-1 text-indigo-600" aria-hidden="true">
          ›
        </span>
      )}
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPassword);

  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [modal, setModal] = useState<AppModalProps | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/profile");
      const user = responseData<UserProfile>(response);

      if (
        !user ||
        typeof user.id !== "number" ||
        typeof user.name !== "string" ||
        typeof user.email !== "string"
      ) {
        throw new Error("INVALID_PROFILE");
      }

      setProfile(user);
      setProfileForm({
        name: user.name,
        email: user.email,
        phone_number: user.phone_number ?? "",
      });
    } catch (error: any) {
      setModal({
        type: "error",
        title: "Unable to Load Profile",
        message:
          error instanceof Error && error.message === "INVALID_PROFILE"
            ? "The profile data returned by the server has an unexpected format."
            : friendlyError(error, "Failed to load your account information."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const changeProfileField = (field: keyof ProfileForm, value: string) => {
    setProfileForm((previous) => ({ ...previous, [field]: value }));
    setProfileErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const changePasswordField = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((previous) => ({ ...previous, [field]: value }));
    setPasswordErrors((previous) => ({ ...previous, [field]: "" }));
  };

  const validateProfile = () => {
    const errors: FieldErrors = {};
    const name = profileForm.name.trim();
    const email = profileForm.email.trim();
    const phone = profileForm.phone_number.trim();

    if (!name) {
      errors.name = "Full name is required.";
    } else if (name.length > 255) {
      errors.name = "Name cannot exceed 255 characters.";
    }

    if (!email) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address.";
    } else if (email.length > 255) {
      errors.email = "Email cannot exceed 255 characters.";
    }

    if (phone.length > 30) {
      errors.phone_number = "Phone number cannot exceed 30 characters.";
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (savingProfile || !validateProfile()) return;

    setSavingProfile(true);
    setProfileErrors({});

    try {
      const response = await api.put("/profile", {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone_number: profileForm.phone_number.trim() || null,
      });

      const updatedUser = responseData<UserProfile>(response);

      if (
        !updatedUser ||
        typeof updatedUser.id !== "number" ||
        typeof updatedUser.name !== "string" ||
        typeof updatedUser.email !== "string"
      ) {
        throw new Error("INVALID_PROFILE");
      }

      setProfile(updatedUser);
      setProfileForm({
        name: updatedUser.name,
        email: updatedUser.email,
        phone_number: updatedUser.phone_number ?? "",
      });

      setModal({
        type: "success",
        title: "Profile Updated Successfully",
        message: "Your account information has been saved successfully.",
      });
    } catch (error: any) {
      if (error instanceof Error && error.message === "INVALID_PROFILE") {
        setModal({
          type: "warning",
          title: "Invalid Server Response",
          message:
            "The server received the request, but the returned profile data has an unexpected format.",
        });
      } else {
        const errors = apiErrors(error);

        if (Object.keys(errors).length > 0) {
          setProfileErrors(errors);
          setModal({
            type: "warning",
            title: "Please Review Your Information",
            message:
              "Some fields contain invalid information. Correct the highlighted fields and try saving again.",
          });
        } else {
          setModal({
            type: "error",
            title: "Failed to Update Profile",
            message: friendlyError(error, "Please try again."),
          });
        }
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const validatePassword = () => {
    const errors: FieldErrors = {};

    if (!passwordForm.current_password) {
      errors.current_password = "Current password is required.";
    }

    if (!passwordForm.password) {
      errors.password = "New password is required.";
    } else if (passwordForm.password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    } else if (passwordForm.password === passwordForm.current_password) {
      errors.password =
        "New password must be different from your current password.";
    }

    if (!passwordForm.password_confirmation) {
      errors.password_confirmation = "Please confirm your new password.";
    } else if (passwordForm.password !== passwordForm.password_confirmation) {
      errors.password_confirmation = "Passwords do not match.";
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updatePassword = async () => {
    setSavingPassword(true);
    setPasswordErrors({});

    try {
      await api.put("/change-password", passwordForm);

      setPasswordForm(emptyPassword);
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirmation(false);

      setModal({
        type: "success",
        title: "Password Changed Successfully",
        message:
          "Your password has been updated. Use your new password the next time you log in.",
      });
    } catch (error: any) {
      const errors = apiErrors(error);

      if (Object.keys(errors).length > 0) {
        setPasswordErrors(errors);
        setModal({
          type: "warning",
          title: "Please Review Your Password",
          message:
            "Make sure your current password is correct, your new password meets the requirements, and the confirmation matches.",
        });
      } else {
        setModal({
          type: "error",
          title: "Failed to Change Password",
          message: friendlyError(error, "Please try again."),
        });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (savingPassword || !validatePassword()) return;

    setModal({
      type: "confirm",
      title: "Change Your Password?",
      message:
        "You are about to update your account password. Make sure your new password is correct before continuing.",
      confirmText: "Yes, Change Password",
      cancelText: "Review Again",
      onConfirm: updatePassword,
    });
  };

  const resetProfile = () => {
    if (!profile) return;

    const hasChanges =
      profileForm.name !== profile.name ||
      profileForm.email !== profile.email ||
      profileForm.phone_number !== (profile.phone_number ?? "");

    if (!hasChanges) {
      setProfileErrors({});
      return;
    }

    setModal({
      type: "confirm",
      title: "Discard Changes?",
      message:
        "All unsaved profile changes will be reverted to your last saved information.",
      confirmText: "Yes, Discard Changes",
      cancelText: "Continue Editing",
      onConfirm: () => {
        setProfileForm({
          name: profile.name,
          email: profile.email,
          phone_number: profile.phone_number ?? "",
        });
        setProfileErrors({});
        setModal(null);
      },
    });
  };

  const resetPassword = () => {
    const hasValues = Object.values(passwordForm).some(Boolean);

    if (!hasValues) {
      setPasswordErrors({});
      return;
    }

    setModal({
      type: "confirm",
      title: "Clear Password Fields?",
      message:
        "All password fields will be cleared. You can fill in the form again at any time.",
      confirmText: "Clear Fields",
      cancelText: "Keep Editing",
      onConfirm: () => {
        setPasswordForm(emptyPassword);
        setPasswordErrors({});
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirmation(false);
        setModal(null);
      },
    });
  };

  const initials = (profile?.name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const closeModal = () => {
    if (!savingPassword && !savingProfile) setModal(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      {modal && (
        <AppModal
          modal={modal}
          busy={savingPassword || savingProfile}
          onClose={closeModal}
        />
      )}

      <div className="w-full">
        <header className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            Account Management
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Jere ita-boot nia informasaun pesoál no seguransa konta C-HTM
            nian
          </p>
        </header>

        <div className="grid w-full grid-cols-1 items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Account
              </p>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {initials || "U"}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {profile?.name || "My Account"}
                  </p>

                  <p className="mt-1 truncate text-xs text-slate-500">
                    {profile?.email || "Account Settings"}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-3">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Preferensia
              </p>

              <nav className="space-y-1" aria-label="Settings navigation">
                <TabButton
                  active={activeTab === "profile"}
                  onClick={() => setActiveTab("profile")}
                  icon="♙"
                  title="Profile"
                  description="Maneje ita-nia informasaun"
                />

                <TabButton
                  active={activeTab === "password"}
                  onClick={() => setActiveTab("password")}
                  icon="⌑"
                  title="Troka Password"
                  description="Hadia ita-nia password"
                />
              </nav>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Account Settings
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Keep your account information and password secure.
              </p>
            </div>
          </aside>

          <main className="min-w-0">
            {loading ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <Spinner />

                <p className="mt-4 text-sm font-medium text-slate-600">
                  Loading informasaun konta...
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Favor hein oituan.
                </p>
              </div>
            ) : !profile ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl font-bold text-red-600">
                  !
                </div>

                <h2 className="mt-4 text-lg font-bold text-slate-900">
                  Profile Unavailable
                </h2>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  We couldn't load your account information. Check your
                  connection and login session, then try again.
                </p>

                <button
                  type="button"
                  onClick={() => void fetchProfile()}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Try Again
                </button>
              </section>
            ) : activeTab === "profile" ? (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                  <h2 className="text-lg font-bold text-slate-900">
                    My Profile
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Atualiza informasaun báziku ne'ebé asosiadu ho ita-boot nia
                    konta.
                  </p>
                </div>

                <form
                  onSubmit={saveProfile}
                  noValidate
                  className="space-y-6 p-5 sm:p-7"
                >
                  <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">
                      {initials || "U"}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {profile.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {profile.role?.role_name || "Account User"}
                      </p>
                    </div>

                    <span className="ml-auto hidden rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 sm:inline-flex">
                      ID: {profile.id}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Informasaun Pesoal
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Favór asegura katak informasaun ne’ebé ita fornese loos no
                      loos duni.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
                    <Field
                      label="Naran kompletu"
                      name="name"
                      value={profileForm.name}
                      onChange={(value) => changeProfileField("name", value)}
                      error={profileErrors.name}
                      placeholder="Hatama ita-nia naran kompletu"
                      autoComplete="name"
                    />

                    <Field
                      label="Email Address"
                      name="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(value) => changeProfileField("email", value)}
                      error={profileErrors.email}
                      placeholder="name@example.com"
                      autoComplete="email"
                    />

                    <div className="sm:col-span-2">
                      <Field
                        label="Numeru telfone"
                        name="phone_number"
                        type="tel"
                        value={profileForm.phone_number}
                        onChange={(value) =>
                          changeProfileField("phone_number", value)
                        }
                        error={profileErrors.phone_number}
                        placeholder="Hatama ita-nia numeru telfone (optional)"
                        autoComplete="tel"
                      />

                      <p className="mt-1.5 text-xs text-slate-400">
                        Ita bele husik mamuk koluna ne'e, se karik ita la iha
                        numeru telfone.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-slate-400">
                      Sei halo mudansa wainhira ita buti butaun atualiza dadus.
                    </p>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={resetProfile}
                        disabled={savingProfile}
                        className="rounded-lg border border-slate-200 cursor-pointer px-4 py-2.5 text-sm font-semibold text-slate-600 transition cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                      >
                        Kansela
                      </button>

                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="inline-flex items-center cursor-pointer justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition cursor-pointer hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingProfile && <Spinner small />}
                        {savingProfile ? "Rai..." : "Rai dadus"}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            ) : (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                  <h2 className="text-lg font-bold text-slate-900">
                    Troka Password
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Troka ita-nia password regular hodi garantia ita nia konta
                    ho seguru.
                  </p>
                </div>

                <form
                  onSubmit={submitPassword}
                  noValidate
                  className="space-y-6 p-5 sm:p-7"
                >
                  <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                    <span
                      className="mt-0.5 text-lg text-indigo-600"
                      aria-hidden="true"
                    >
                      ⓘ
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-indigo-900">
                        Kria password ne'ebe forte
                      </p>

                      <p className="mt-1 text-xs leading-5 text-indigo-800">
                        Uza karakter minimu 8. Prevene utiliza password ne'ebe
                        fasil atu hatene ka password ne'ebe uza ba konta seluk.
                      </p>
                    </div>
                  </div>

                  <div className="max-w-xl space-y-5">
                    <Field
                      label="Password atual"
                      name="current_password"
                      type={showCurrent ? "text" : "password"}
                      value={passwordForm.current_password}
                      onChange={(value) =>
                        changePasswordField("current_password", value)
                      }
                      error={passwordErrors.current_password}
                      placeholder="Hatama ita-nia password atual"
                      autoComplete="current-password"
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowCurrent((value) => !value)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {showCurrent ? "Hide" : "Show"}
                        </button>
                      }
                    />

                    <Field
                      label="Password Foun"
                      name="password"
                      type={showNew ? "text" : "password"}
                      value={passwordForm.password}
                      onChange={(value) =>
                        changePasswordField("password", value)
                      }
                      error={passwordErrors.password}
                      placeholder="Hatama password foun"
                      autoComplete="new-password"
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowNew((value) => !value)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {showNew ? "Hide" : "Show"}
                        </button>
                      }
                    />

                    <Field
                      label="Konfirma passowrd foun"
                      name="password_confirmation"
                      type={showConfirmation ? "text" : "password"}
                      value={passwordForm.password_confirmation}
                      onChange={(value) =>
                        changePasswordField("password_confirmation", value)
                      }
                      error={passwordErrors.password_confirmation}
                      placeholder="Hatama fila-fali password foun"
                      autoComplete="new-password"
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowConfirmation((value) => !value)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {showConfirmation ? "Hide" : "Show"}
                        </button>
                      }
                    />
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-slate-400">
                      Labele fahe ita-nia password ho ema seluk.
                    </p>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={resetPassword}
                        disabled={savingPassword}
                        className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                      >
                        Hamoos koluna
                      </button>

                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition cursor-pointer hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Atualiza password
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
