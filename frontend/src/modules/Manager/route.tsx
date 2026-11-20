import type { RouteObject } from "react-router-dom";
import AppLayout from "../../components/ManagerComponents/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Member from "./pages/Member";
import NonMember from "./pages/Nonmember";
import Deposit from "./pages/Deposit";
import DepositReport from "./pages/DepositReport";
import MemberSaving from "./pages/MemberSavingSummary";
import Loans from "./pages/Loans";
import LoanPayments from "./pages/LoanPayments";
import LoanPayReport from "./pages/LoanPayReport";
import Settings from "./pages/Settings";
import Roles from "./pages/Roles";
import Users from "./pages/User";

const ManagerRoutes: RouteObject[] = [
  {
    path: "/manager",
    element: <ProtectedRoute allowedRoles={["manager"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "dashboard",
            element: <Dashboard />,
          },
          {
            path: "members",
            element: <Member />,
          },
          {
            path: "nonmembers",
            element: <NonMember/>,
          },
          {
            path: "deposits",
            element: <Deposit/>,
          },
          {
            path: "depositreport",
            element: <DepositReport/>,
          },
          {
            path: "membersaving",
            element: <MemberSaving/>,
          },
          {
            path: "loans",
            element: <Loans/>,
          },
          {
            path: "loanpayments",
            element: <LoanPayments/>,
          },
          {
            path: "loanpayreport",
            element: <LoanPayReport/>,
          },
          {
            path: "settings",
            element:<Settings/>,
          },
          {
            path: "roles",
            element:<Roles/>,
          },
          {
            path: "users",
            element: <Users/>,
          },
        ],
      },
    ],
  },
];

export default ManagerRoutes;
