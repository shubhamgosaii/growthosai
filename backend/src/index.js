import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

//firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const rtdb = admin.database();
const firestore = admin.firestore();

//generative ai init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//App init
const app = express();
app.use(cors());
app.use(express.json());

// function to get all company data
const getCompanyData = async () => {
  const [users, attendance, leaves, alerts, aiConfig] = await Promise.all([
    rtdb.ref("users").once("value"),
    rtdb.ref("attendance").once("value"),
    rtdb.ref("leaves").once("value"),
    rtdb.ref("aiAlerts").once("value"),
    rtdb.ref("aiConfig").once("value")
  ]);

  const performance = await firestore.collection("performance").get();
  const sales = await firestore.collection("sales").get();
  const projects = await firestore.collection("projects").get();

  return {
    users: users.val() || {},
    attendance: attendance.val() || {},
    leaves: leaves.val() || {},
    alerts: alerts.val() || {},
    aiConfig: aiConfig.val() || { autoRun: false },
    performance: performance.docs.map(d => d.data()),
    sales: sales.docs.map(d => d.data()),
    projects: projects.docs.map(d => d.data())
  };
};

// function to calculate key metrics
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
    attendanceCount: Object.keys(data.attendance || {}).length,
    leaveRequests: Object.keys(data.leaves || {}).length,
    projects: data.projects.length,
    totalSales: data.sales.reduce((s, x) => s + (x.amount || 0), 0)
  };
};

//ai intent detection
const detectIntent = (prompt = "") => {
  const p = prompt.toLowerCase();

  if (p.includes("attendance")) return "ATTENDANCE";
  if (p.includes("leave")) return "LEAVE";
  if (p.includes("employee") || p.includes("staff")) return "EMPLOYEE";
  if (p.includes("performance")) return "PERFORMANCE";
  if (p.includes("sales") || p.includes("revenue")) return "SALES";
  if (p.includes("project")) return "PROJECT";
  if (p.includes("risk")) return "RISK";
  if (p.includes("growth")) return "GROWTH";

  return "GENERAL";
};

// function to pick relevant data based on intent
const pickRelevantData = (intent, data) => {
  switch (intent) {
    case "EMPLOYEE":
      return { users: data.users };

    case "ATTENDANCE":
      return { attendance: data.attendance, users: data.users };

    case "LEAVE":
      return { leaves: data.leaves, users: data.users };

    case "PERFORMANCE":
      return { performance: data.performance };

    case "SALES":
      return { sales: data.sales };

    case "PROJECT":
      return { projects: data.projects };

    case "RISK":
    case "GROWTH":
      return data;

    default:
      return data;
  }
};

// create employee endpoint
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

// attendance marking
app.post("/attendance/mark", async (req, res) => {
  try {
    const { uid } = req.body;
    const date = new Date().toISOString().split("T")[0];

    await rtdb.ref(`attendance/${uid}/${date}`).set({
      uid,
      date,
      time: Date.now(),
      status: "PRESENT"
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// leave request
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

// leave action (approve/reject)
app.post("/leave/action", async (req, res) => {
  try {
    const { leaveId, status } = req.body;
    await rtdb.ref(`leaves/${leaveId}/status`).set(status);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ai query endpoint
app.post("/ai/query", async (req, res) => {
  try {
    const { prompt } = req.body;

    const fullData = await getCompanyData();
    const intent = detectIntent(prompt);
    const relevantData = pickRelevantData(intent, fullData);
    const metrics = calculateMetrics(fullData);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(`
You are GrowthOS AI – a real company operating system.

RULES:
- Plain English only
- No JSON
- No code
- Answer ONLY what is asked

Intent: ${intent}

Company Metrics:
${JSON.stringify(metrics)}

Relevant Data:
${JSON.stringify(relevantData)}

User Question:
${prompt}

Give:
1. Direct answer
2. Data based reasoning
3. Risk (if any)
4. Clear actions
`);

    const reply = result.response.text();

    await rtdb.ref("aiInsights").push({
      prompt,
      intent,
      reply,
      createdAt: Date.now()
    });

    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// start server
app.get("/", (_, res) => {
  res.send("GrowthOS AI Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("GrowthOS AI running on port", PORT)
);
