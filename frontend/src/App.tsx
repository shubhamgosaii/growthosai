import { Routes, Route } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

import Home from "./pages/Home";
import Login from "./pages/Login";
import HRDashboard from "./pages/hr/HRDashboard";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import AuthGuard from "./auth/AuthGuard";

export default function App() {
  const [user] = useAuthState(auth);

  return (
    <>
      {!user && <Home />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/hr/dashboard"
          element={
            <AuthGuard>
              <HRDashboard />
            </AuthGuard>
          }
        />

        <Route
          path="/employee/dashboard"
          element={
            <AuthGuard>
              <EmployeeDashboard />
            </AuthGuard>
          }
        />
      </Routes>
    </>
  );
}
