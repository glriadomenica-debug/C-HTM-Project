import type { RouteObject } from "react-router-dom";
import AppLayout from "../../components/FinanceComponents/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import Dashboard from "./pages/Dashboard"
import Deposits from "./pages/Deposit";
import DepositReport from "./pages/DepositReport";
import MemberSaving from "./pages/MemberSavingSummary";
import Loans from "./pages/Loans";
import LoanReport from "./pages/LoanReport";
import LoanPayments from "./pages/LoanPayments";
import LoanPayReport from "./pages/LoanPayReport";
import Transactions from "./pages/TransactionManagement";
import Settings from "./pages/Settings";

const FinanceRoutes: RouteObject[] = [
  {
    path: "/finance",
    element: <ProtectedRoute allowedRoles={["finance"]} />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "dashboard",
            element: <Dashboard />,
          },
          {
            path: "deposits",
            element: <Deposits/>,
          },
          {
            path: "depositreport",
            element: <DepositReport/>,
          },
          {
            path: "membersaving",
            element: <MemberSaving/>,
          }, {
            path: "loans",
            element: <Loans/>,
          },
          {
            path: "loanreport",
            element: <LoanReport/>,
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
            path: "transactions",
            element: <Transactions/>,
          },
          {
            path: "settings",
            element: <Settings/>,
          },
        ],
      },
    ],
  },
];

export default FinanceRoutes;
