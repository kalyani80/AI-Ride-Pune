import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { puneImages } from "../pune";

export default function LoginPage() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("rider");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/login", { email, password });
      const loggedUser = response.data;
      if (loggedUser.role !== selectedRole) {
        setMessage(`Select ${loggedUser.role} to continue.`);
        return;
      }
      saveSession(loggedUser);
      navigate(`/${loggedUser.role}`);
    } catch {
      setMessage("Invalid email or password.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-photo">
        <img src={puneImages.shaniwar} alt="Shaniwar Wada Pune" />
        <div className="photo-overlay">
          <span>AI-RIDE</span>
          <h1>
            Pune,
            <br />
            your ride is ready.
          </h1>
          <p>Smart routes. AI pricing. Real-time rides.</p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="brand">
          AI-RIDE
          <span>PUNE</span>
        </div>

        <div className="auth-heading">
          <span className="eyebrow">Hello Pune!</span>
          <h1>Welcome </h1>
        </div>

        <div className="role-tabs">
          {[
            ["rider", "Rider"],
            ["driver", "Driver"],
            ["manager", "Manager"],
          ].map(([role, label]) => (
            <button
              key={role}
              type="button"
              className={selectedRole === role ? "active" : ""}
              onClick={() => setSelectedRole(role)}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
          />
          <button className="primary-btn wide" type="submit">
            LOGIN
          </button>
        </form>

        <p className="auth-switch">
          New to AI-Ride? <Link to="/register">Create an account</Link>
        </p>

        <div
  className="demo-box"
  style={{
    marginTop: "22px",
    padding: "18px",
    borderRadius: "18px",
    background:
      "linear-gradient(145deg, rgba(99, 102, 241, 0.12) 0%, rgba(17, 24, 39, 0.75) 60%, rgba(0, 0, 0, 0.5) 100%)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    boxShadow: "0 10px 30px -10px rgba(99, 102, 241, 0.15)",
  }}
>
  {/* Header with Live City Pulse */}
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "14px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "16px" }}>⚡</span>
      <span
        style={{
          fontSize: "13.5px",
          color: "#fff",
          fontWeight: "800",
          letterSpacing: "0.3px",
        }}
      >
        Pune Live Mobility Pulse
      </span>
    </div>
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "999px",
        background: "rgba(34, 197, 94, 0.15)",
        border: "1px solid rgba(34, 197, 94, 0.4)",
        fontSize: "11px",
        fontWeight: "700",
        color: "#4ade80",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#22c55e",
          boxShadow: "0 0 8px #22c55e",
        }}
      />
      240+ Cabs Online
    </span>
  </div>

  {/* 3 Hero Metric Cards */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "10px",
      textAlign: "center",
      marginBottom: "14px",
    }}
  >
    <div
      style={{
        padding: "12px 6px",
        borderRadius: "14px",
        background: "rgba(99, 102, 241, 0.12)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: "900", color: "#38bdf8" }}>
        ~2.8m
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "#e5e7eb",
          fontWeight: "600",
          marginTop: "3px",
        }}
      >
        ⚡ Avg. Pickup
      </div>
    </div>

    <div
      style={{
        padding: "12px 6px",
        borderRadius: "14px",
        background: "rgba(34, 197, 94, 0.12)",
        border: "1px solid rgba(34, 197, 94, 0.3)",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: "900", color: "#4ade80" }}>
        ₹0 Cut
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "#e5e7eb",
          fontWeight: "600",
          marginTop: "3px",
        }}
      >
        🤝 Direct to Driver
      </div>
    </div>

    <div
      style={{
        padding: "12px 6px",
        borderRadius: "14px",
        background: "rgba(59, 130, 246, 0.12)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: "900", color: "#60a5fa" }}>
        4.9 ★
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "#e5e7eb",
          fontWeight: "600",
          marginTop: "3px",
        }}
      >
        🛡️ PIN Verified
      </div>
    </div>
  </div>

  {/* Catchy Hot-Zones & Price Lock Banner */}
  <div
    style={{
      padding: "10px 12px",
      borderRadius: "12px",
      background: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "12px",
    }}
  >
    <span style={{ color: "#d1d5db" }}>
      🔥 <strong style={{ color: "#fff" }}>High-Demand Hubs:</strong> Akurdi •
      Hinjewadi • Wakad • FC Rd
    </span>
    <span
      style={{
        color: "#6366f1",
        fontWeight: "800",
        whiteSpace: "nowrap",
        marginLeft: "8px",
      }}
    >
      Starts @ ₹40
    </span>
  </div>
</div>

        {message && <div className="toast inline-toast">{message}</div>}
      </div>
    </div>
  );
}
