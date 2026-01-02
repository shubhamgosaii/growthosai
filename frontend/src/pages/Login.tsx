import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  type UserCredential
} from "firebase/auth";
import { ref, get, type DataSnapshot } from "firebase/database";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { JSX } from "react/jsx-dev-runtime";

/* ================= TYPES ================= */
type Role = "HR" | "EMPLOYEE" | "";

interface UserRecord {
  role: "HR" | "EMPLOYEE";
  department?: string;
}

/* ================= CONSTANTS ================= */
const departments = ["HR", "Engineering", "Sales", "Marketing"];

/* ======================================================= */
const Login = (): JSX.Element => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("");
  const [department, setDepartment] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* =======================================================
     🔒 BLOCK LOGIN PAGE IF USER ALREADY LOGGED IN
  ======================================================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        navigate("/", { replace: true });
      }
    });
    return unsub;
  }, [navigate]);

  /* =======================================================
     LOGIN HANDLER
  ======================================================= */
  const login = async (): Promise<void> => {
    setError("");

    if (!email || !password || !role) {
      setError("All fields are required");
      return;
    }

    if (role === "EMPLOYEE" && !department) {
      setError("Please select department");
      return;
    }

    try {
      setLoading(true);

      const cred: UserCredential =
        await signInWithEmailAndPassword(auth, email, password);

      const snap: DataSnapshot = await get(
        ref(db, `users/${cred.user.uid}`)
      );

      if (!snap.exists()) {
        setError("User record not found");
        return;
      }

      const user: UserRecord = snap.val();

      /* 🔐 ROLE CHECK */
      if (user.role !== role) {
        setError("Role mismatch");
        return;
      }

      /* 🔐 DEPARTMENT CHECK (EMPLOYEE ONLY) */
      if (role === "EMPLOYEE" && user.department !== department) {
        setError("Wrong department selected");
        return;
      }

      /* ✅ SUCCESS REDIRECT */
      navigate(
        role === "HR" ? "/hr/dashboard" : "/employee/dashboard",
        { replace: true }
      );

    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     UI
  ======================================================= */
  return (
    <div className="container">
      <div className="card">
        <h2>Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {/* ROLE */}
        <select value={role} onChange={e => setRole(e.target.value as Role)}>
          <option value="">Select Role</option>
          <option value="HR">HR</option>
          <option value="EMPLOYEE">Employee</option>
        </select>

        {/* DEPARTMENT (EMPLOYEE ONLY) */}
        {role === "EMPLOYEE" && (
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
          >
            <option value="">Select Department</option>
            {departments.map(dep => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        )}

        {error && <p className="error">{error}</p>}

        <button onClick={login} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </div>
  );
};

export default Login;