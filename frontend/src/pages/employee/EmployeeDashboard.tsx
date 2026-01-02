import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { ref, onValue, push, set, update } from "firebase/database";

/* ================= TYPES ================= */
type Attendance = {
  date: string;
  checkIn?: number;
  checkOut?: number;
};

type Leave = {
  id: string;
  from: string;
  to: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};

/* ================= CONSTANTS ================= */
const API = "http://localhost:5000";

/* ======================================================= */
const EmployeeDashboard = () => {
  const user = auth.currentUser;
  const uid = user?.uid ?? "";
  const email = user?.email ?? "";

  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);

  /* LEAVE FORM */
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  /* AI */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  const today = new Date().toISOString().split("T")[0];

  /* ================= FETCH ATTENDANCE ================= */
  useEffect(() => {
    if (!uid) return;

    return onValue(ref(db, `attendance/${uid}`), snap => {
      const list: Attendance[] = [];
      snap.forEach(d => list.push(d.val()));
      setAttendanceHistory(list);
      setAttendance(
        list.find(a => a.date === today) ?? null
      );
    });
  }, [uid]);

  /* ================= FETCH LEAVES ================= */
  useEffect(() => {
    if (!uid) return;

    return onValue(ref(db, "leaves"), snap => {
      const list: Leave[] = [];
      snap.forEach(c => {
        const v = c.val();
        if (v.uid === uid) {
          list.push({ id: c.key!, ...v });
        }
      });
      setLeaves(list);
    });
  }, [uid]);

  /* ================= CHECK IN ================= */
  const checkIn = async () => {
    const data = {
      date: today,
      checkIn: Date.now()
    };
    await set(ref(db, `attendance/${uid}/${today}`), data);
  };

  /* ================= CHECK OUT ================= */
  const checkOut = async () => {
    await update(ref(db, `attendance/${uid}/${today}`), {
      checkOut: Date.now()
    });
  };

  /* ================= APPLY LEAVE ================= */
  const applyLeave = async () => {
    if (!from || !to || !reason) {
      setMsg("❌ All fields required");
      return;
    }

    await push(ref(db, "leaves"), {
      uid,
      from,
      to,
      reason,
      status: "PENDING",
      createdAt: Date.now()
    });

    setFrom("");
    setTo("");
    setReason("");
    setMsg("✅ Leave applied");
  };

  /* ================= AI ================= */
  const askAI = async () => {
    if (!aiPrompt.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: aiPrompt
    };

    setChat(prev => [...prev, userMsg]);
    setAiPrompt("");
    setAiLoading(true);

    try {
      const res = await fetch(`${API}/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `
Employee Email: ${email}
Attendance Records: ${attendanceHistory.length}
Leave Requests: ${leaves.length}

Question:
${userMsg.text}
`
        })
      });

      const data = await res.json();

      setChat(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: data.reply
        }
      ]);
    } catch {
      setChat(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: "❌ AI service unavailable"
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="emp-shell">
      {/* TOPBAR */}
      <header className="emp-topbar">
        <h2>Employee Dashboard</h2>
        <span>{email}</span>
        <button onClick={() => signOut(auth)}>Logout</button>
      </header>

      {/* DASHBOARD */}
      <main className="emp-content">
        {/* ATTENDANCE */}
        <section className="card">
          <h3>Today's Attendance</h3>
          {!attendance?.checkIn ? (
            <button onClick={checkIn}>Check In</button>
          ) : !attendance?.checkOut ? (
            <button onClick={checkOut}>Check Out</button>
          ) : (
            <p>✅ Attendance Completed</p>
          )}
        </section>

        {/* LEAVE */}
        <section className="card">
          <h3>Apply Leave</h3>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <textarea
            placeholder="Reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <button onClick={applyLeave}>Apply</button>
          {msg && <p>{msg}</p>}
        </section>

        {/* LEAVE STATUS */}
        <section className="card">
          <h3>My Leaves</h3>
          <ul>
            {leaves.map(l => (
              <li key={l.id}>
                {l.from} → {l.to} | {l.status}
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* FLOATING AI */}
      <button className="ai-float" onClick={() => setAiOpen(true)}>
        🤖
      </button>

      {aiOpen && (
        <div className="ai-panel">
          <h3>GrowthOS AI</h3>

          <div className="ai-chat">
            {chat.map(c => (
              <div key={c.id} className={c.role}>
                {c.text}
              </div>
            ))}
            {aiLoading && <p>AI thinking...</p>}
          </div>

          <textarea
            placeholder="Ask AI about work, growth, performance..."
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
          />

          <button onClick={askAI}>Ask AI</button>
          <button onClick={() => setAiOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
