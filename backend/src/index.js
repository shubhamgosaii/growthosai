import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

/* ================= FIREBASE INIT ================= */

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

/* ================= AI INIT ================= */

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

/* ================= APP INIT ================= */

const app = express();
app.use(cors());
app.use(express.json());

/* ================= CREATE EMPLOYEE ================= */

app.post("/create-employee", async (req, res) => {
  try {
    const { email, password, department, hrUid } = req.body;

    const user = await admin.auth().createUser({
      email,
      password
    });

    await admin.database().ref("users/" + user.uid).set({
      role: "EMPLOYEE",
      email,
      department,
      createdBy: hrUid
    });

    res.json({ success: true, uid: user.uid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================= AI ENDPOINT ================= */

app.post("/ai", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    });

    res.json({
      success: true,
      reply: response.text
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
