import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";

interface FormLogin {
  email: string;
  password: string;
}

interface User {
  id: number;
  name?: string;
  email: string;
  role?:
    | {
        id?: number;
        role_name?: string;
      }
    | string;
  role_name?: string;
}

interface LoginResponse {
  data: {
    token: string;
    user: User;
  };
}

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormLogin>({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState<boolean>(false);

  // Menangani perubahan input
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
  };

  // Menangani proses login
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);

    try {
      // Mengirim data login ke API Laravel
      const response = await api.post<LoginResponse>("/auth/login", form);

      const { token, user } = response.data.data;

      // Memastikan data login tersedia
      if (!token || !user) {
        throw new Error("Data login tidak lengkap.");
      }

      // Mengambil nama role dari respons API
      const rawRole =
        user.role && typeof user.role === "object"
          ? user.role.role_name
          : (user.role ?? user.role_name);

      const role = String(rawRole ?? "")
        .toLowerCase()
        .trim();

      console.log("User data:", user);
      console.log("Detected role:", role);

      // Memastikan role dikenali sebelum menyimpan sesi
      const allowedRoles = [
        "superadmin",
        "manager",
        "finance",
        "administration",
      ];

      if (!allowedRoles.includes(role)) {
        toast.error(`Role tidak dikenali: ${role || "kosong"}`);
        return;
      }

      // Menyimpan token dan data user
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Mengarahkan user sesuai role
      switch (role) {
        case "superadmin":
          toast.success("Login ho susesu!");
          navigate("/superadmin/dashboard", { replace: true });
          break;

        case "manager":
          toast.success("Login ho susesu!");
          navigate("/manager/dashboard", { replace: true });
          break;

        case "finance":
          toast.success("Login ho susesu!");
          navigate("/finance/dashboard", { replace: true });
          break;

        case "administration":
          toast.success("Login ho susesu!");
          navigate("/administration/dashboard", { replace: true });
          break;

        default:
          toast.error("La hetan role ne'ebe ita hatama.");
          break;
      }
    } catch (error: unknown) {
      console.error("Erru wainhira login:", error);

      if (axios.isAxiosError<{ message?: string }>(error)) {
        toast.error(error.response?.data?.message || "Login erru!");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Login erru!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-3xl font-bold text-blue-900">Log in</h1>

        <p className="mb-8 text-sm text-gray-500">
          Favor hatama ita-nia Email no Password
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Input email */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Input password */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Tombol login */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-900 p-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
