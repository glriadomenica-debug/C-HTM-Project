import type { RouteObject } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/User";
import Roles from "./pages/Roles";

const SuperAdminRoutes: RouteObject[] = [
  {
    path: "/superadmin",
    element: <ProtectedRoute allowedRoles={["superadmin"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "dashboard",
            element: <Dashboard />,
          },
          {
            path: "users",
            element: <Users />,
          },
          {
            path: "roles",
            element: <Roles />,
          },
        ],
      },
    ],
  },
];

export default SuperAdminRoutes;
