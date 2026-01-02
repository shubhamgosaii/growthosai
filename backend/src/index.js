import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

// firebase admin init
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const rtdb = admin.database();

// ai init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// app init
const app = express();
app.use(cors());
app.use(express.json());

// fetch company data
const getCompanyData = async () => {
  const [usersSnap, attendanceSnap, leavesSnap] = await Promise.all([
    rtdb.ref("users").once("value"),
    rtdb.ref("attendance").once("value"),
    rtdb.ref("leaves").once("value")
  ]);

  return {
    users: usersSnap.val() || {},
    attendance: attendanceSnap.val() || {},
    leaves: leavesSnap.val() || {}
  };
};

// calculate basic metrics
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
    departmentWise
  };
};

// ai query endpoint
app.post("/ai/query", async (req, res) => {
  try {
    const { prompt, mode = "BOTH" } = req.body;

    if (!prompt) {
      return res.json({ reply: "Please ask a question." });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

   // just jarvis (company ai)
    if (mode === "JARVIS") {
      const data = await getCompanyData();
      const metrics = calculateMetrics(data);

      const result = await model.generateContent(`
You are GrowthOS Jarvis (Company AI).

RULES:
- Answer ONLY from company data
- Be short & precise
- No assumptions
- No extra info

Company Metrics:
${JSON.stringify(metrics)}

Company Data:
${JSON.stringify(data)}

Question:
${prompt}
`);

      return res.json({ reply: result.response.text() });
    }

    // just gemini (general ai)
    if (mode === "GEMI") {
      const result = await model.generateContent(`
You are Gemini AI.

Answer clearly and professionally.

Question:
${prompt}
`);
      return res.json({ reply: result.response.text() });
    }

    // hybrid (both)
    const data = await getCompanyData();
    const metrics = calculateMetrics(data);

    const result = await model.generateContent(`
You are GrowthOS AI (Hybrid).

RULES:
- Prefer company data if relevant
- Otherwise use general knowledge
- Clear, structured answer

Company Metrics:
${JSON.stringify(metrics)}

Company Data:
${JSON.stringify(data)}

Question:
${prompt}
`);

    return res.json({ reply: result.response.text() });

  } catch (error) {
    console.error("AI ERROR:", error);
    res.status(500).json({
      reply: "AI failed while analyzing the request."
    });
  }
});

// create employee endpoint
app.post("/create-employee", async (req, res) => {
  try {
    const { fullName, email, password, department, hrUid } = req.body;

    const user = await admin.auth().createUser({ email, password });

    await rtdb.ref(`users/${user.uid}`).set({
      fullName,
      email,
      department,
      role: "EMPLOYEE",
      status: "ACTIVE",
      createdBy: hrUid,
      createdAt: Date.now()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// mark attendance endpoint
app.post("/attendance/mark", async (req, res) => {
  try {
    const { uid } = req.body;
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

// leave request endpoint
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

// leave action endpoint
app.post("/leave/action", async (req, res) => {
  try {
    const { leaveId, status } = req.body;
    await rtdb.ref(`leaves/${leaveId}/status`).set(status);
    res.json({ success: true });
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
