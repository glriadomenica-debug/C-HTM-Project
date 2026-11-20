import type { RouteObject } from "react-router-dom";
import AppLayout from "../../components/AdminComponents/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Member from "./pages/Member";
import NonMember from "./pages/Nonmember";
import Loan from "./pages/Loans";
import LoanPayment from "./pages/LoanPayments";
import Settings from "./pages/Settings";
import LoanReport from "./pages/LoanReport";
import LoanPayReport from "./pages/LoanPayReport";

const AdministrationRoutes: RouteObject[] = [
  {
    path: "/administration",
    element: <ProtectedRoute allowedRoles={["administration"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "dashboard",
            element: <Dashboard />,
          },
          {
            path: "member",
            element: <Member/>,
          },
          {
            path: "nonmember",
            element: <NonMember/>,
          },
          {
            path: "loan",
            element: <Loan/>,
          },
          {
            path: "loanpayment",
            element: <LoanPayment/>,
          },
          {
            path: "settings",
            element: <Settings/>,
          },
          {
            path: "loanreport",
            element: <LoanReport/>,
          },
          {
            path: "loanpayreport",
            element: <LoanPayReport/>,
          }
        ],
      },
    ],
  },
];

export default AdministrationRoutes;
