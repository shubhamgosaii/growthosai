import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

/* ================= FIREBASE INIT ================= */

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const rtdb = admin.database();
const firestore = admin.firestore();

/* ================= AI INIT ================= */

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/* ================= APP ================= */

const app = express();
app.use(cors());
app.use(express.json());

/* =================================================
   FETCH FULL COMPANY DATA (AI USE)
================================================= */

const getCompanyData = async () => {
  const [users, attendance, leaves, alerts] = await Promise.all([
    rtdb.ref("users").once("value"),
    rtdb.ref("attendance").once("value"),
    rtdb.ref("leaves").once("value"),
    rtdb.ref("aiAlerts").once("value")
  ]);

  const performance = await firestore.collection("performance").get();
  const sales = await firestore.collection("sales").get();
  const projects = await firestore.collection("projects").get();

  return {
    users: users.val() || {},
    attendance: attendance.val() || {},
    leaves: leaves.val() || {},
    alerts: alerts.val() || {},
    performance: performance.docs.map(d => d.data()),
    sales: sales.docs.map(d => d.data()),
    projects: projects.docs.map(d => d.data())
  };
};

/* =================================================
   METRICS CALCULATION
================================================= */

const calculateMetrics = (data) => {
  const users = Object.values(data.users || {});
  const employees = users.filter(u => u.role === "EMPLOYEE");

  const departmentWise = {};
  employees.forEach(e => {
    departmentWise[e.department] =
      (departmentWise[e.department] || 0) + 1;
  });

  return {
    totalEmployees: employees.length,
    departmentWise,
    attendanceRecords: Object.keys(data.attendance || {}).length,
    leaveRequests: Object.keys(data.leaves || {}).length,
    projects: data.projects.length,
    totalSales: data.sales.reduce((s, x) => s + (x.amount || 0), 0)
  };
};

/* =================================================
   HR: CREATE EMPLOYEE (FULL DETAILS)
================================================= */

app.post("/create-employee", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      dob,
      skills,
      role,
      department,
      hrUid
    } = req.body;

    const user = await admin.auth().createUser({ email, password });

    await rtdb.ref(`users/${user.uid}`).set({
      fullName,
      email,
      dob,
      skills,
      role,
      department,
      status: "ACTIVE",
      createdBy: hrUid,
      createdAt: Date.now()
    });

    res.json({ success: true, uid: user.uid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =================================================
   EMPLOYEE: ATTENDANCE MARK
================================================= */

app.post("/attendance/mark", async (req, res) => {
  try {
    const { uid } = req.body;
    const date = new Date().toISOString().split("T")[0];

    await rtdb.ref(`attendance/${uid}/${date}`).set({
      uid,
      date,
      time: Date.now()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =================================================
   EMPLOYEE: LEAVE REQUEST
================================================= */

app.post("/leave/request", async (req, res) => {
  try {
    const { uid, from, to, reason } = req.body;
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

/* =================================================
   HR: LEAVE APPROVE / REJECT
================================================= */

app.post("/leave/action", async (req, res) => {
  try {
    const { leaveId, status } = req.body;
    await rtdb.ref(`leaves/${leaveId}/status`).set(status);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =================================================
   AI: MANUAL QUERY (CHAT)
================================================= */

app.post("/ai/query", async (req, res) => {
  try {
    const { prompt } = req.body;

    const data = await getCompanyData();
    const metrics = calculateMetrics(data);

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
You are GrowthOS AI – an AI Operating System for companies.

RULES:
- Respond ONLY in plain English
- No JSON
- No code blocks

Company Metrics:
${JSON.stringify(metrics)}

Company Data:
${JSON.stringify(data)}

User Question:
${prompt}

Analyze deeply, find risks, growth opportunities and give clear action steps.
`
            }
          ]
        }
      ]
    });

    const insight = {
      prompt,
      reply: response.text,
      metrics,
      createdAt: Date.now()
    };

    await rtdb.ref("aiInsights").push(insight);

    res.json({ reply: response.text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =================================================
   AI: AUTO RISK MONITOR (CRON / MANUAL)
================================================= */

app.post("/ai/auto-run", async (_, res) => {
  try {
    const data = await getCompanyData();
    const metrics = calculateMetrics(data);

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
You are GrowthOS AI running autonomous monitoring.

Analyze company health, detect risks, inefficiencies
and generate critical alerts for HR and management.
`
            }
          ]
        }
      ]
    });

    await rtdb.ref("aiAlerts").push({
      message: response.text,
      metrics,
      createdAt: Date.now()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =================================================
   SERVER
================================================= */

app.get("/", (_, res) => {
  res.send("✅ GrowthOS AI Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("🚀 GrowthOS AI running on port", PORT)
);
