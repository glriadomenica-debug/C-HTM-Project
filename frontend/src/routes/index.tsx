import { useRoutes } from "react-router-dom";

import LoginRoutes from "../modules/Auth/route";
import SuperAdminRoutes from "../modules/SuperAdmin/route";

// Route utama aplikasi.
export default function AppRoutes() {
  return useRoutes([
    ...LoginRoutes,
    ...SuperAdminRoutes,

    // Tambahkan route modul lain setelah dibuat:
    // ...ManagerRoutes,
    // ...FinanceRoutes,
    // ...AdministrationRoutes,
  ]);
}
