import type { RouteObject } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/User";
import Roles from "./pages/Roles";
import Settings from "./pages/Settings";
import Members from "./pages/Member";
import NonMembers from "./pages/Nonmember";
import Deposits from "./pages/Deposit";
import Loans from "./pages/Loans";
import LoanPayments from "./pages/LoanPayments";
import TransactionManagement from "./pages/TransactionManagement";
import LoanReport from "./pages/LoanReport";

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
          {
            path: "settings",
            element: <Settings />,
          },
          {
            path: "members",
            element: <Members />,
          },
          {
            path: "nonmembers",
            element: <NonMembers />,
          },
          {
            path: "deposits",
            element: <Deposits />,
          },
          {
            path: "Loans",
            element: <Loans />,
          },
          {
            path: "loanpayments",
            element: <LoanPayments />,
          },
          {
            path: "transactions",
            element: <TransactionManagement />,
          },
          {
            path: "loanreport",
            element: <LoanReport />,
          },
        ],
      },
    ],
  },
];

export default SuperAdminRoutes;
