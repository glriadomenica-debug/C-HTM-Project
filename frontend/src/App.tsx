// import { BrowserRouter } from "react-router-dom";
// import AppRoutes from "./routes";

// function App() {
//   return (
//     <BrowserRouter>
//       <AppRoutes />
//     </BrowserRouter>
//   );
// }
// export default App;

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AppRoutes from "./routes/index";

export default function App() {
  return (
    <>
      {/* Semua halaman dan route aplikasi */}
      <AppRoutes />

      {/* Satu notifikasi global untuk seluruh aplikasi */}
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </>
  );
}
