import { useRoutes } from "react-router-dom";

import LoginRoutes from "../modules/Auth/route";
import SuperAdminRoutes from "../modules/SuperAdmin/route";
import ManagerRoutes from "../modules/Manager/route";
import FinanceRoutes from "../modules/Finance/route";
import AdministrationRoutes from "../modules/Administration/route";

// Route utama aplikasi.
export default function AppRoutes() {
  return useRoutes([
    ...LoginRoutes,
    ...SuperAdminRoutes,
    ...ManagerRoutes,
    ...FinanceRoutes,
    ...AdministrationRoutes,

    // Tambahkan route modul lain setelah dibuat:
    // ...ManagerRoutes,
    // ...FinanceRoutes,
    // ...AdministrationRoutes,
  ]);
}
