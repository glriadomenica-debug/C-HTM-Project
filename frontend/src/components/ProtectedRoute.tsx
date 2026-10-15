import { Navigate, Outlet } from "react-router-dom";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

interface StoredUser {
  role?:
    | {
        role_name?: string;
      }
    | string;
  role_name?: string;
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");

  // Jika belum login, arahkan ke halaman login.
  if (!token || !storedUser) {
    return <Navigate to="/login" replace />;
  }

  let user: StoredUser;

  try {
    user = JSON.parse(storedUser) as StoredUser;
  } catch {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    return <Navigate to="/login" replace />;
  }

  // Nama role berada di user.role.role_name.
  const rawRole =
    typeof user.role === "object" && user.role !== null
      ? user.role.role_name
      : (user.role ?? user.role_name);

  const role = String(rawRole ?? "")
    .toLowerCase()
    .trim();

  console.log("ProtectedRoute role:", role);
  console.log("Allowed roles:", allowedRoles);

  // Pastikan role pengguna sesuai dengan route.
  if (!allowedRoles.map((item) => item.toLowerCase()).includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
