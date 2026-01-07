import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

/* ================= FIREBASE INIT ================= */
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  ),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const rtdb = admin.database();

/* ================= AI INIT ================= */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/* ================= APP INIT ================= */
const app = express();
app.use(cors());
app.use(express.json());

/* ================= HELPERS ================= */
const safeKey = (v) => {
  if (!v || typeof v !== "string") return null;
  return v.trim();
};

/* ================= AI HELPERS ================= */
const getCompanyData = async () => {
  const [departmentsSnap, attendanceSnap, leavesSnap] = await Promise.all([
    rtdb.ref("departments").once("value"),
    rtdb.ref("attendance").once("value"),
    rtdb.ref("leaves").once("value")
  ]);

  return {
    departments: departmentsSnap.val() || {},
    attendance: attendanceSnap.val() || {},
    leaves: leavesSnap.val() || {}
  };
};

const calculateMetrics = (data) => {
  let totalEmployees = 0;
  const departmentWise = {};

  Object.entries(data.departments || {}).forEach(([dept, users]) => {
    const count = Object.keys(users || {}).length;
    departmentWise[dept] = count;
    totalEmployees += count;
  });

  return { totalEmployees, departmentWise };
};

/* ================= AI QUERY ================= */
app.post("/ai/query", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ reply: "Prompt required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const data = await getCompanyData();
    const metrics = calculateMetrics(data);

    const result = await model.generateContent(`
You are GrowthOS AI.

Rules:
- Use company data only
- Short & clear answers

Metrics:
${JSON.stringify(metrics)}

Data:
${JSON.stringify(data)}

Question:
${prompt}
`);

    res.json({ reply: result.response.text() });
  } catch (e) {
    console.error("AI ERROR:", e);
    res.status(500).json({ reply: "AI failed" });
  }
});

/* ================= CREATE EMPLOYEE / HR ================= */
app.post("/create-employee", async (req, res) => {
  try {
    let { fullName, email, password, department, role, createdBy } = req.body;

    department = safeKey(department);

    if (!fullName || !email || !password || !department || !role) {
      return res.status(400).json({
        error: "fullName, email, password, department & role are required"
      });
    }

    const user = await admin.auth().createUser({ email, password });

    await rtdb.ref(`departments/${department}/${user.uid}`).set({
      uid: user.uid,
      fullName,
      email,
      role,
      accountType: department === "HR Department" ? "HR" : "EMPLOYEE",
      status: "ACTIVE",
      createdAt: Date.now(),
      createdBy: createdBy || null
    });

    res.json({ success: true, uid: user.uid });
  } catch (e) {
    console.error("CREATE USER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});


// =======================================================
// 🔥 LOGIN + VERIFY (NO UID FROM FRONTEND)
// frontend → email + department + role
// backend → uid find + verify + dashboard decide
// =======================================================

app.post("/auth/verify-login", async (req, res) => {
  try {
    let { email, department, role } = req.body;

    email = safeKey(email);
    department = safeKey(department);
    role = safeKey(role);

    if (!email || !department || !role) {
      return res.json({
        authorized: false,
        reason: "Missing login data"
      });
    }

    // 🔍 get department users
    const deptSnap = await rtdb
      .ref(`departments/${department}`)
      .once("value");

    if (!deptSnap.exists()) {
      return res.json({
        authorized: false,
        reason: "Department not found"
      });
    }

    let foundUser = null;
    let foundUid = null;

    // 🔍 find user by email
    deptSnap.forEach(child => {
      const user = child.val();
      if (user.email === email) {
        foundUser = user;
        foundUid = child.key;
      }
    });

    if (!foundUser) {
      return res.json({
        authorized: false,
        reason: "User not found in department"
      });
    }

    // 🔐 role check
    if (foundUser.role !== role) {
      return res.json({
        authorized: false,
        reason: "Role mismatch"
      });
    }

    // 🔐 status check
    if (foundUser.status !== "ACTIVE") {
      return res.json({
        authorized: false,
        reason: "User inactive"
      });
    }

    // 🧭 backend decides dashboard
    let dashboard = "/employee/dashboard";
    if (foundUser.accountType === "HR") {
      dashboard = "/hr/dashboard";
    }

    return res.json({
      authorized: true,
      uid: foundUid,
      department,
      role,
      dashboard
    });

  } catch (e) {
    console.error("VERIFY LOGIN ERROR:", e);
    res.status(500).json({
      authorized: false,
      reason: "Server error"
    });
  }
});

/* ================= ATTENDANCE ================= */
app.post("/attendance/mark", async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "uid required" });
    }

    const date = new Date().toISOString().split("T")[0];

    await rtdb.ref(`attendance/${uid}/${date}`).set({
      uid,
      date,
      status: "PRESENT",
      time: Date.now()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= LEAVES ================= */
app.post("/leave/request", async (req, res) => {
  try {
    const { uid, from, to, reason } = req.body;

    if (!uid || !from || !to || !reason) {
      return res.status(400).json({ error: "Invalid leave data" });
    }

    const id = rtdb.ref("leaves").push().key;

    await rtdb.ref(`leaves/${id}`).set({
      uid,
      from,
      to,
      reason,
      status: "PENDING",
      createdAt: Date.now()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/leave/action", async (req, res) => {
  try {
    const { leaveId, status } = req.body;

    if (!leaveId || !status) {
      return res.status(400).json({ error: "leaveId & status required" });
    }

    await rtdb.ref(`leaves/${leaveId}/status`).set(status);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= SERVER ================= */
app.get("/", (_, res) => {
  res.send("GrowthOS AI Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("GrowthOS AI running on port", PORT)
);
