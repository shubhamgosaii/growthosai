import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { ref, onValue, set } from "firebase/database";
import {
  Users,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Sparkles
} from "lucide-react";

import FloatingAIChat from "../../components/FloatingAIChat";
import AttendanceGrowthChart from "../../components/AttendanceGrowthChart";

/* ================= TYPES ================= */
type Employee = {
  uid: string;
  fullName: string;
  email: string;
  department: string;
  role: string;
  status: string;
};

type Attendance = {
  uid: string;
  date: string;
  status: string;
};

type Leave = {
  id: string;
  uid: string;
  from: string;
  to: string;
  reason: string;
  status: string;
};

type Tab =
  | "dashboard"
  | "employees"
  | "attendance"
  | "leaves"
  | "analytics"
  | "settings";

const departments = ["HR", "Engineering", "Sales", "Marketing"];

/* ======================================================= */
export default function HRDashboard() {
  const hrEmail = auth.currentUser?.email ?? "";

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);

  /* CREATE EMPLOYEE */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState("");

  /* ================= FETCH EMPLOYEES ================= */
  useEffect(() => {
    return onValue(ref(db, "users"), snap => {
      const list: Employee[] = [];
      snap.forEach(c => {
        const v = c.val();
        if (v.role === "EMPLOYEE") {
          list.push({
            uid: c.key!,
            fullName: v.fullName,
            email: v.email,
            department: v.department,
            role: v.role,
            status: v.status || "ACTIVE"
          });
        }
      });
      setEmployees(list);
    });
  }, []);

  /* ================= FETCH ATTENDANCE ================= */
  useEffect(() => {
    return onValue(ref(db, "attendance"), snap => {
      const list: Attendance[] = [];
      snap.forEach(day => {
        Object.values(day.val()).forEach((x: any) => list.push(x));
      });
      setAttendance(list);
    });
  }, []);

  /* ================= FETCH LEAVES ================= */
  useEffect(() => {
    return onValue(ref(db, "leaves"), snap => {
      const list: Leave[] = [];
      snap.forEach(c => list.push({ id: c.key!, ...c.val() }));
      setLeaves(list);
    });
  }, []);

  /* ================= CREATE EMPLOYEE ================= */
  const createEmployee = async () => {
    setMessage("");

    if (!fullName || !email || !password || !department) {
      setMessage("❌ All fields required");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/create-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          department,
          hrUid: auth.currentUser?.uid
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage("✅ Employee created successfully");
      setFullName("");
      setEmail("");
      setPassword("");
      setDepartment("");
    } catch (e: any) {
      setMessage("❌ " + e.message);
    }
  };

  /* ================= LEAVE ACTION ================= */
  const updateLeave = async (id: string, status: "APPROVED" | "REJECTED") => {
    await set(ref(db, `leaves/${id}/status`), status);
  };

  /* ================= STATS ================= */
  const stats = {
    totalEmployees: employees.length,
    todayAttendance: attendance.filter(
      a => a.date === new Date().toISOString().split("T")[0]
    ).length,
    pendingLeaves: leaves.filter(l => l.status === "PENDING").length,
    activeEmployees: employees.filter(e => e.status === "ACTIVE").length
  };

  /* ================= CHART DATA ================= */
  const chartData = [
    {
      date: "Mon",
      attendance: stats.todayAttendance - 1,
      employees: stats.totalEmployees
    },
    {
      date: "Tue",
      attendance: stats.todayAttendance,
      employees: stats.totalEmployees
    },
    {
      date: "Wed",
      attendance: stats.todayAttendance + 1,
      employees: stats.totalEmployees + 1
    }
  ];

  const menu = [
    { id: "dashboard", icon: BarChart3, label: "Dashboard" },
    { id: "employees", icon: Users, label: "Employees" },
    { id: "attendance", icon: Calendar, label: "Attendance" },
    { id: "leaves", icon: FileText, label: "Leaves" },
    { id: "analytics", icon: TrendingUp, label: "AI Analytics" },
    { id: "settings", icon: Settings, label: "Settings" }
  ];

  /* ================= UI ================= */
  return (
    <div className="dashboard-container">
      {/* SIDEBAR */}
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <Sparkles size={26} />
          <h1>GrowthOS</h1>
        </div>

        <nav className="sidebar-nav">
          {menu.map(m => (
            <button
              key={m.id}
              className={`nav-item ${activeTab === m.id ? "active" : ""}`}
              onClick={() => setActiveTab(m.id as Tab)}
            >
              <m.icon size={18} />
              <span>{m.label}</span>
            </button>
          ))}
        </nav>

        <button className="nav-item logout" onClick={() => signOut(auth)}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* MAIN */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h2>{menu.find(m => m.id === activeTab)?.label}</h2>
            <p>{hrEmail} · HR Manager</p>
          </div>
        </header>

        <div className="dashboard-content">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              <div className="grid-layout">
                <Stat title="Employees" value={stats.totalEmployees} icon={<Users />} />
                <Stat title="Present Today" value={stats.todayAttendance} icon={<CheckCircle />} />
                <Stat title="Pending Leaves" value={stats.pendingLeaves} icon={<Clock />} />
                <Stat title="Active Staff" value={stats.activeEmployees} icon={<TrendingUp />} />
              </div>

              <AttendanceGrowthChart data={chartData} />
            </>
          )}

          {/* EMPLOYEES */}
          {activeTab === "employees" && (
            <div className="grid-layout">
              <div className="content-card glass">
                <h3><UserPlus size={18}/> Add Employee</h3>
                <div className="form">
                  <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
                  <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                  <select value={department} onChange={e => setDepartment(e.target.value)}>
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <button className="btn-primary" onClick={createEmployee}>Create</button>
                  {message && <p>{message}</p>}
                </div>
              </div>

              <div className="content-card glass full-width">
                <h3>Employees</h3>
                <div className="employee-grid">
                  {employees.map(e => (
                    <div key={e.uid} className="employee-card">
                      <div className="employee-avatar">{e.fullName?.[0]}</div>
                      <h4>{e.fullName}</h4>
                      <p>{e.email}</p>
                      <span className="badge">{e.department}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LEAVES */}
          {activeTab === "leaves" && (
            <div className="content-card glass">
              <h3>Leave Requests</h3>
              {leaves.map(l => (
                <div key={l.id} className="leave-row">
                  <div>
                    <b>{l.reason}</b>
                    <p>{l.from} → {l.to}</p>
                  </div>
                  {l.status === "PENDING" && (
                    <div className="actions">
                      <button onClick={() => updateLeave(l.id, "APPROVED")}><CheckCircle/></button>
                      <button onClick={() => updateLeave(l.id, "REJECTED")}><XCircle/></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* AI ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="content-card glass">
              <h3>Ask GrowthOS AI</h3>
              <p>
                Ask anything about employees, attendance, leaves, risks or growth.
                AI uses live company database.
              </p>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div className="content-card glass">
              <h3>Settings</h3>
              <p>AI auto-run, alerts & permissions coming next.</p>
            </div>
          )}
        </div>
      </main>

      {/* FLOATING AI */}
      <FloatingAIChat />
    </div>
  );
}

/* ================= STAT ================= */
function Stat({ title, value, icon }: any) {
  return (
    <div className="stat-card glass">
      <div className="stat-icon">{icon}</div>
      <div>
        <h3>{value}</h3>
        <p>{title}</p>
      </div>
    </div>
  );
}
