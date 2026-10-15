import type { RouteObject } from "react-router-dom";
import Login from "./pages/login";

// Route publik untuk halaman login.
const LoginRoutes: RouteObject[] = [
  {
    path: "/",
    element: <Login />,
  },
];

export default LoginRoutes;
