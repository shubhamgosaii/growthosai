import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const firestore = admin.firestore();

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const app = express();
app.use(cors());
app.use(express.json());

const getCompanyData = async () => {
  const usersSnap = await admin.database().ref("users").once("value");
  const attendanceSnap = await admin.database().ref("attendance").once("value");
  const leavesSnap = await admin.database().ref("leaves").once("value");
  const alertsSnap = await admin.database().ref("aiAlerts").once("value");

  const performanceSnap = await firestore.collection("performance").get();
  const salesSnap = await firestore.collection("sales").get();
  const projectsSnap = await firestore.collection("projects").get();

  return {
    users: usersSnap.val() || {},
    attendance: attendanceSnap.val() || {},
    leaves: leavesSnap.val() || {},
    aiAlerts: alertsSnap.val() || {},
    performance: performanceSnap.docs.map(d => d.data()),
    sales: salesSnap.docs.map(d => d.data()),
    projects: projectsSnap.docs.map(d => d.data())
  };
};

const calculateMetrics = (data) => {
  const users = Object.values(data.users);
  const employees = users.filter(u => u.role === "EMPLOYEE");

  const departmentDistribution = {};
  employees.forEach(e => {
    departmentDistribution[e.department] =
      (departmentDistribution[e.department] || 0) + 1;
  });

  const attendanceCount = Object.keys(data.attendance).length;
  const leaveCount = Object.keys(data.leaves).length;
  const totalSales = data.sales.reduce((s, x) => s + (x.amount || 0), 0);

  return {
    totalEmployees: employees.length,
    departmentDistribution,
    attendanceRecords: attendanceCount,
    leaveRequests: leaveCount,
    totalSales,
    projectCount: data.projects.length
  };
};

app.post("/create-employee", async (req, res) => {
  try {
    const { email, password, department, hrUid } = req.body;

    const user = await admin.auth().createUser({ email, password });

    await admin.database().ref(`users/${user.uid}`).set({
      role: "EMPLOYEE",
      email,
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

app.post("/attendance/mark", async (req, res) => {
  try {
    const { uid } = req.body;
    const date = new Date().toISOString().split("T")[0];

    await admin.database().ref(`attendance/${uid}/${date}`).set({
      uid,
      date,
      time: Date.now()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/leave/request", async (req, res) => {
  try {
    const { uid, from, to, reason } = req.body;
    const id = admin.database().ref("leaves").push().key;

    await admin.database().ref(`leaves/${id}`).set({
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
    await admin.database().ref(`leaves/${leaveId}/status`).set(status);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ai/query", async (req, res) => {
  try {
    const { prompt } = req.body;

    const rawData = await getCompanyData();
    const metrics = calculateMetrics(rawData);

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
You are GrowthOS AI, an autonomous company operating system.

Metrics:
${JSON.stringify(metrics, null, 2)}

Company Data:
${JSON.stringify(rawData, null, 2)}

User Prompt:
${prompt}

Analyze deeply, detect risks, calculate impact, and suggest actions to improve company growth.
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

    await admin.database().ref("aiInsights").push(insight);

    res.json({ success: true, insight });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/ai/auto-run", async (req, res) => {
  try {
    const rawData = await getCompanyData();
    const metrics = calculateMetrics(rawData);

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
You are GrowthOS AI running autonomous monitoring.

Metrics:
${JSON.stringify(metrics, null, 2)}

Company Data:
${JSON.stringify(rawData, null, 2)}

Identify critical risks, inefficiencies, and immediate actions.
`
            }
          ]
        }
      ]
    });

    const alert = {
      message: response.text,
      metrics,
      createdAt: Date.now()
    };

    await admin.database().ref("aiAlerts").push(alert);

    res.json({ success: true, alert });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("GrowthOS AI Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("🚀 GrowthOS AI running on port", PORT);
});
