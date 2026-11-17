import { useState } from "react";

export default function AIAssistant({
  role = "rider", // "rider" or "driver"
  onAgentBookRide, // Agent callback to control Rider UI
  currentRide,
  weather,
  temperature,
  driverStats,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text:
        role === "rider"
          ? "✨ Greetings, traveler! I am RideBot 🌟, your personal AI companion. Ask me anything about Pune, traffic, or routes — or simply tell me *'Book a Mini from DY Patil Akurdi to Elpro Mall'* and I'll book it for you instantly! ⭐"
          : "🌟 Hello Captain! I'm RideBot ✨, your smart driving assistant. Ask me about Pune hotspots, earnings, or weather updates anytime! 🚀",
    },
  ]);

  // Quick Action / FAQ Chips
  const quickPrompts =
    role === "rider"
      ? [
          "🤖 Book Mini from Akurdi to Hinjewadi",
          "🌟 Tell me about Pune traffic today",
          "✨ How do you calculate fares?",
          "🛡️ How do I verify my driver?",
        ]
      : [
          "🔥 Where is high demand in Pune right now?",
          "💰 How are my earnings calculated?",
          "⛈️ Weather & traffic forecast",
          "✨ Give me a driving tip",
        ];

  const handleSend = async (customText) => {
    const query = (customText || input).trim();
    if (!query) return;

    setMessages((prev) => [...prev, { sender: "user", text: query }]);
    setInput("");
    setIsTyping(true);

    const lower = query.toLowerCase();

    // ====================================================
    // 1. RIDE BOOKING INTENT (AGENTIC CAPABILITY)
    // ====================================================
    if (role === "rider") {
      const fromToMatch = query.match(/from\s+(.+?)\s+to\s+(.+)/i);

      if (fromToMatch || lower.includes("book")) {
        const extractedPickup = fromToMatch ? fromToMatch[1].trim() : "DY Patil Akurdi";
        const extractedDrop = fromToMatch ? fromToMatch[2].replace(/(please|now|fast|for me)/gi, "").trim() : "Hinjewadi Phase 1";

        let vehicle = "mini";
        if (lower.includes("sedan")) vehicle = "sedan";
        if (lower.includes("suv")) vehicle = "suv";

        setTimeout(async () => {
          setMessages((prev) => [
            ...prev,
            {
              sender: "ai",
              text: `✨ **RideBot Action Initiated:**\n🌟 Pickup: **${extractedPickup}**\n⭐ Drop: **${extractedDrop}**\n🚗 Cab: **${vehicle.toUpperCase()}**\n\nTaking control of your dashboard, analyzing live Pune weather (${weather || "Clear"}, ${temperature ?? 25}°C), and securing your ride... ⚡`,
            },
          ]);

          if (onAgentBookRide) {
            const result = await onAgentBookRide(
              extractedPickup,
              extractedDrop,
              vehicle,
              true
            );
            setMessages((prev) => [
              ...prev,
              {
                sender: "ai",
                text: `✨ ${result} 🌟`,
              },
            ]);
          }
          setIsTyping(false);
        }, 800);
        return;
      }
    }

    // ====================================================
    // 2. GENERAL CONVERSATIONAL AI (GEMINI / CHATGPT STYLE)
    // ====================================================
    setTimeout(() => {
      let reply = "";

      if (lower.includes("surge") || lower.includes("pricing") || lower.includes("fare")) {
        reply = `✨ **Smart Pricing Intelligence:** Fares are dynamically calculated using real-time distance, Pune traffic density, and live weather (${weather || "Clear"}, ${temperature ?? 25}°C). Zero commission means more savings for you! 🌟`;
      } else if (lower.includes("verify") || lower.includes("otp") || lower.includes("pin") || lower.includes("safety")) {
        reply = currentRide?.otp
          ? `🛡️ **Safety Shield Active:** Your active ride OTP is **${currentRide.otp}**. Always match this 4-digit PIN with your driver before stepping in! ⭐`
          : `🛡️ **Your Safety Matters:** Every trip generates a secure 4-digit OTP. Your driver must enter this code before the meter starts. ✨`;
      } else if (lower.includes("demand") || lower.includes("hotspot") || lower.includes("where")) {
        reply = `🔥 **Pune High-Demand Zones:**\n⭐ **Akurdi & Ravet** (Student hubs)\n🌟 **Hinjewadi Phase 1 & Wakad** (IT corridors)\n✨ **FC Road & Shivajinagar**\nHead here for lightning-fast pickups! 🚀`;
      } else if (lower.includes("commission") || lower.includes("earning") || lower.includes("payment")) {
        reply = `💸 **100% Direct Payouts:** AI-Ride Pune takes **0% cut**. Riders pay you directly via cash or UPI. ${driverStats ? `You've completed \${driverStats.rides} successful trips so far! 🌟` : "Keep driving, keep earning! ✨"}`;
      } else if (lower.includes("weather") || lower.includes("traffic") || lower.includes("pune")) {
        reply = `🌤️ **Pune City Report:** Currently **${weather || "Pleasant"} (${temperature ?? 25}°C)**. Expect moderate traffic flow around Chinchwad flyover and Wakad bridge. Drive safe! ⭐`;
      } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        reply = `✨ Hello there! I'm **RideBot**, your AI companion for Pune mobility. How can I brighten your journey today? 🌟`;
      } else if (lower.includes("who are you") || lower.includes("what can you do")) {
        reply = `🤖 I am **RideBot**, an advanced AI assistant built like ChatGPT/Gemini. I can explain Pune routes, answer FAQs, calculate fares, or even book a cab for you automatically when you say *'Book a Mini from X to Y'*! ✨🌟`;
      } else {
        // Conversational Fallback (AI-generated sounding text)
        reply = `🌟 That's a great question about Pune travel! As **RideBot**, I'm constantly analyzing live traffic and ride metrics to give you the smoothest experience. Feel free to ask me about routes, fares, safety tips, or command me to book your next ride! ✨🚀`;
      }

      setMessages((prev) => [...prev, { sender: "ai", text: reply }]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            width: "360px",
            height: "490px",
            marginBottom: "14px",
            borderRadius: "20px",
            background: "rgba(15, 23, 42, 0.97)",
            border: "1px solid rgba(79, 70, 229, 0.5)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              background: "linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%)",
              color: "#000",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🤖</span>
              <div>
                <div style={{ fontWeight: "900", fontSize: "14px", lineHeight: "1.1", color: "#fff" }}>
                  RideBot ✨
                </div>
                <div style={{ fontSize: "10.5px", fontWeight: "700", opacity: 0.85, color: "#e2e8f0" }}>
                  {role === "rider" ? "AI Companion & Autonomous Booker" : "Captain Smart Assistant"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#fff",
                fontWeight: "900",
                borderRadius: "50%",
                width: "26px",
                height: "26px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "10px 12px",
                  borderRadius: "14px",
                  fontSize: "12.5px",
                  lineHeight: "1.45",
                  whiteSpace: "pre-line",
                  background:
                    m.sender === "user"
                      ? "#4f46e5"
                      : "rgba(255, 255, 255, 0.07)",
                  color: m.sender === "user" ? "#fff" : "#f3f4f6",
                  fontWeight: m.sender === "user" ? "600" : "400",
                  border:
                    m.sender === "ai"
                      ? "1px solid rgba(255, 255, 255, 0.1)"
                      : "none",
                }}
              >
                {m.text}
              </div>
            ))}
            {isTyping && (
              <div style={{ fontSize: "11px", color: "#38bdf8", fontStyle: "italic" }}>
                ✨ RideBot is thinking & crafting response... 🌟
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div
            style={{
              padding: "8px 10px",
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,0,0,0.25)",
            }}
          >
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                style={{
                  fontSize: "10.5px",
                  padding: "5px 9px",
                  borderRadius: "99px",
                  background: "rgba(79, 70, 229, 0.16)",
                  border: "1px solid rgba(79, 70, 229, 0.35)",
                  color: "#a5b4fc",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                role === "rider"
                  ? "Ask anything or say 'Book Mini from...'"
                  : "Ask RideBot about earnings, hotspots..."
              }
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontSize: "12px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              style={{
                padding: "0 14px",
                borderRadius: "10px",
                background: "#4f46e5",
                color: "#fff",
                fontWeight: "800",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: "14px 20px",
          borderRadius: "999px",
          background: "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)",
          color: "#fff",
          fontWeight: "900",
          fontSize: "13.5px",
          border: "2px solid rgba(255,255,255,0.25)",
          boxShadow: "0 10px 25px rgba(79, 70, 229, 0.4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginLeft: "auto",
        }}
      >
        <span style={{ fontSize: "18px" }}>🤖</span>
        {isOpen ? "Close RideBot" : "RideBot ✨"}
      </button>
    </div>
  );
}