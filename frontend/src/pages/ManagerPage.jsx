import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { puneImages } from "../pune";

export default function ManagerPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [managerStats, setManagerStats] = useState({
    total_users: 0,
    total_rides: 0,
    active_drivers: 0,
    completed_rides: 0,
    requested_rides: 0,
    ongoing_rides: 0,
    cancelled_rides: 0,
  });
  const [managerReport, setManagerReport] = useState(null);
  const [managerQuestion, setManagerQuestion] = useState("");
  const [managerMessages, setManagerMessages] = useState([]);
  const [message, setMessage] = useState("");

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const loadManagerStats = async () => {
    try {
      const response = await api.get("/manager/stats");
      setManagerStats(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadManagerReport = async () => {
    try {
      const response = await api.get("/manager/ai-report");
      setManagerReport(response.data.report);
    } catch (error) {
      console.error(error);
    }
  };

 const askManagerAI = async (question = managerQuestion) => {
    const qText = (question || managerQuestion).trim();
    if (!qText) return;

    setManagerMessages((old) => [...old, { role: "user", text: qText }]);
    setManagerQuestion("");

    // 1. INSTANT LOCAL SMART REPLY (0-second response time using live stats)
    const lower = qText.toLowerCase();
    let instantReply = null;
    const activeRides = managerStats.requested_rides + managerStats.ongoing_rides;

    if (lower.includes("active") || lower.includes("rides are active")) {
      instantReply = `📊 Fleet Status: There are currently ${activeRides} active ride(s) (${managerStats.requested_rides} requested, ${managerStats.ongoing_rides} ongoing) with ${managerStats.active_drivers} driver(s) online.`;
    } else if (lower.includes("summarize") || lower.includes("today")) {
      instantReply = `📈 Operations Summary: Out of ${managerStats.total_rides} total rides across ${managerStats.total_users} users, ${managerStats.completed_rides} are completed and ${managerStats.cancelled_rides || 0} are cancelled.`;
    } else if (lower.includes("attention") || lower.includes("needs attention")) {
      instantReply = `⚠️ Operational Review:\n• Cancelled Rides: ${managerStats.cancelled_rides || 0}\n• Active Fleet Supply: ${managerStats.active_drivers} driver(s) online for ${activeRides} active request(s).`;
    }

    if (instantReply) {
      setManagerMessages((old) => [...old, { role: "assistant", text: instantReply }]);
      return;
    }

    // 2. BACKEND FALLBACK FOR CUSTOM QUESTIONS
    try {
      const response = await api.post("/manager/ai-chat", { question: qText });
      setManagerMessages((old) => [...old, { role: "assistant", text: response.data.answer }]);
    } catch {
      setManagerMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: `🤖 Manager AI Insight: Managing ${managerStats.total_rides} total rides, ${managerStats.active_drivers} active drivers, and ${managerStats.completed_rides} completed trips across Pune.`,
        },
      ]);
    }
  };

  useEffect(() => {
    loadManagerStats();
    loadManagerReport();
    const interval = setInterval(loadManagerStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell manager-page">
      <header className="topbar">
        <div className="brand">
          AI-RIDE
          <span>PUNE</span>
        </div>
        <div className="topbar-right">
          <span>{user.name}</span>
          <button onClick={signOut}>Logout</button>
        </div>
      </header>

      <main className="page-container">
        <section className="city-hero">
          <img src={puneImages.pmc} alt="Pune Municipal Corporation" />
          <div className="city-hero-overlay">
            <div>
              <span className="eyebrow light">MANAGER</span>
              <h1>Operations</h1>
            </div>
            <span className="status-pill live">● LIVE</span>
          </div>
        </section>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Users</span>
            <strong>{managerStats.total_users}</strong>
          </div>
          <div className="stat-card">
            <span>Rides</span>
            <strong>{managerStats.total_rides}</strong>
          </div>
          <div className="stat-card">
            <span>Online drivers</span>
            <strong>{managerStats.active_drivers}</strong>
          </div>
          <div className="stat-card">
            <span>Completed</span>
            <strong>{managerStats.completed_rides}</strong>
          </div>
        </div>

        <div className="manager-layout">
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">SYSTEM REPORT</span>
                <h2>Today at a glance</h2>
              </div>
            </div>
            {managerReport && (
              <div className="report-list">
                <div>
                  <span>Overview</span>
                  <p>{managerReport.overview}</p>
                </div>
                <div>
                  <span>Operations</span>
                  <p>{managerReport.operations}</p>
                </div>
                <div>
                  <span>Fleet</span>
                  <p>{managerReport.fleet}</p>
                </div>
                <div>
                  <span>Attention</span>
                  <p>{managerReport.attention}</p>
                </div>
              </div>
            )}
            <div className="activity-strip">
              <div>
                <span>Requested</span>
                <strong>{managerStats.requested_rides}</strong>
              </div>
              <div>
                <span>Ongoing</span>
                <strong>{managerStats.ongoing_rides}</strong>
              </div>
              <div>
                <span>Cancelled</span>
                <strong>{managerStats.cancelled_rides || 0}</strong>
              </div>
            </div>
          </section>

          <section className="panel chat-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">MANAGER ASSISTANT</span>
                <h2>Ask about operations</h2>
              </div>
            </div>
            <div className="suggested-questions">
              {["How many rides are active?", "Summarize today's operations", "What needs attention?"].map(
                (question) => (
                  <button key={question} onClick={() => askManagerAI(question)}>
                    {question}
                  </button>
                )
              )}
            </div>
            <div className="chat-messages">
              {managerMessages.length === 0 && (
                <div className="chat-empty">Ask the AI assistant about ride operations.</div>
              )}
              {managerMessages.map((item, index) => (
                <div key={index} className={item.role === "user" ? "chat-message user" : "chat-message"}>
                  {item.text}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                value={managerQuestion}
                onChange={(e) => setManagerQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") askManagerAI();
                }}
                placeholder="Ask manager AI..."
              />
              <button onClick={() => askManagerAI()}>SEND</button>
            </div>
          </section>
        </div>
      </main>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}
