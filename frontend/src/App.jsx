import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RiderPage from "./pages/RiderPage";
import DriverPage from "./pages/DriverPage";
import ManagerPage from "./pages/ManagerPage";
import "./App.css";

function Guard({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return <div className="boot-screen">Loading AI-Ride...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return children;
}

function App() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <div className="boot-screen">Loading AI-Ride...</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? `/${user.role}` : "/login"} replace />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to={`/${user.role}`} replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to={`/${user.role}`} replace /> : <RegisterPage />}
      />
      <Route
        path="/rider"
        element={
          <Guard role="rider">
            <RiderPage />
          </Guard>
        }
      />
      <Route
        path="/driver"
        element={
          <Guard role="driver">
            <DriverPage />
          </Guard>
        }
      />
      <Route
        path="/manager"
        element={
          <Guard role="manager">
            <ManagerPage />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
