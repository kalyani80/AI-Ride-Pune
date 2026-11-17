import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("airide_token");
    if (!token) {
      setReady(true);
      return;
    }

    api
      .get("/me")
      .then((response) => setUser(response.data))
      .catch(() => {
        sessionStorage.removeItem("airide_token");
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const saveSession = (data) => {
    if (data.access_token) {
      sessionStorage.setItem("airide_token", data.access_token);
    }
    setUser(data);
  };

  const logout = () => {
    sessionStorage.removeItem("airide_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, ready, saveSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
