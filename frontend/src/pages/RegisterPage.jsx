import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { puneImages } from "../pune";

export default function RegisterPage() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("rider");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("mini");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        email,
        phone,
        password,
        role,
      };
      if (role === "driver") {
        payload.vehicle_type = vehicleType;
        payload.vehicle_number = vehicleNumber;
      }
      const response = await api.post("/register", payload);
      saveSession(response.data);
      navigate(`/${response.data.role}`);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Registration failed.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-photo">
        <img src={puneImages.shaniwar} alt="Shaniwar Wada Pune" />
        <div className="photo-overlay">
          <span>AI-RIDE</span>
          <h1>Join the Pune network.</h1>
          <p>Riders book in seconds. Drivers go online and earn.</p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="brand">
          AI-RIDE
          <span>PUNE</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">GET STARTED</span>
          <h1>Create account</h1>
        </div>

        <div className="role-tabs">
          {[
            ["rider", "Rider"],
            ["driver", "Driver"],
          ].map(([nextRole, label]) => (
            <button
              key={nextRole}
              type="button"
              className={role === nextRole ? "active" : ""}
              onClick={() => setRole(nextRole)}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={handleRegister}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
          />
          {role === "driver" && (
            <>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="mini">Mini</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
              </select>
              <input
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Vehicle number e.g. MH12AB1234"
                required
              />
            </>
          )}
          <button className="primary-btn wide" type="submit">
            CREATE ACCOUNT
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
        {message && <div className="toast inline-toast">{message}</div>}
      </div>
    </div>
  );
}
