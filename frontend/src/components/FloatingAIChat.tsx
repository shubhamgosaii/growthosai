import { useState } from "react";
import { Send, X, Bot } from "lucide-react";
import { motion } from "framer-motion";

type Msg = {
  role: "user" | "ai";
  text: string;
  time: number;
};

type AIMode = "JARVIS" | "GEMI" | "BOTH";

export default function FloatingAIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mode, setMode] = useState<AIMode>("BOTH");

  const askAI = async () => {
    if (!input.trim()) return;

    const userText = input;
    setInput("");
    setLoading(true);

    setMessages(prev => [
      ...prev,
      { role: "user", text: userText, time: Date.now() }
    ]);

    try {
      const res = await fetch("http://localhost:5000/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          mode // 🔥 VERY IMPORTANT
        })
      });

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          text: data.reply || "AI could not generate a response.",
          time: Date.now()
        }
      ]);

      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          text: "❌ AI service unavailable. Check backend.",
          time: Date.now()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 🤖 FLOATING AI BUTTON */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={unread > 0 ? { rotate: [0, -8, 8, -6, 6, 0] } : {}}
        transition={{ duration: 0.5 }}
        onClick={() => {
          setOpen(true);
          setUnread(0);
        }}
        className="fixed bottom-6 right-6 w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-2xl z-50"
        style={{
          background: "linear-gradient(135deg,#667eea,#764ba2)",
          color: "#fff"
        }}
      >
        <Bot size={38} />

        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
            {unread}
          </span>
        )}
      </motion.button>

      {/* 💬 CHAT WINDOW */}
      {open && (
        <div className="fixed bottom-24 right-6 w-[94vw] sm:w-[380px] max-h-[72vh] bg-white dark:bg-[#111] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">

          {/* HEADER */}
          <div className="flex items-center justify-between px-4 py-3 bg-teal-600 text-white">
            <span className="flex items-center gap-2 font-semibold">
              <Bot size={18} /> GrowthOS AI
            </span>
            <X className="cursor-pointer" onClick={() => setOpen(false)} />
          </div>

          {/* MODE SELECT */}
          <div className="px-3 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a]">
            <select
              value={mode}
              onChange={e => setMode(e.target.value as AIMode)}
              className="w-full px-3 py-2 rounded-lg border dark:bg-[#222] dark:text-white text-sm"
            >
              <option value="BOTH">🧠 Both (Company + AI)</option>
              <option value="JARVIS">🏢 Jarvis (Company Data)</option>
              <option value="GEMI">🌐 Gemi (General AI)</option>
            </select>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-xl max-w-[80%] text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-teal-500 text-white rounded-br-none"
                      : "bg-gray-200 dark:bg-[#333] dark:text-white rounded-bl-none"
                  }`}
                >
                  {m.text}
                  <div className="text-[10px] opacity-60 mt-1 text-right">
                    {new Date(m.time).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-xs opacity-60">🤖 AI is thinking...</div>
            )}
          </div>

          {/* INPUT */}
          <div className="flex items-center gap-2 p-3 border-t dark:border-gray-700">
            <input
              className="flex-1 px-3 py-2 rounded-lg border dark:bg-[#222] dark:text-white"
              placeholder="Ask anything about company or general AI…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askAI()}
            />
            <button
              onClick={askAI}
              className="p-2 rounded-lg bg-teal-600 text-white"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
