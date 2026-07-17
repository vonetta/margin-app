import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // The api client redirects here with ?expired=1 when a previously
  // authenticated session's token is rejected (expired/revoked) — strip
  // it from the URL right away so refreshing doesn't re-show it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      setSessionExpired(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1a1a2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontFamily: "Cinzel, serif",
              fontSize: "24px",
              fontWeight: "600",
              color: "#1a1a2e",
              letterSpacing: "0.1em",
            }}
          >
            MARGIN
          </h1>
          <p
            style={{
              fontSize: "12px",
              color: "#888",
              marginTop: "6px",
              letterSpacing: "0.04em",
            }}
          >
            Ministry Operations Platform
          </p>
        </div>

        {sessionExpired && (
          <div
            style={{
              background: "#fff8ec",
              border: "0.5px solid #f0d080",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#b8902e",
              marginBottom: "16px",
            }}
          >
            Your session expired — please sign in again.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="login-email"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: "500",
                color: "#555",
                marginBottom: "6px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "0.5px solid #e8e6e0",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#1C1C1C",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="login-password"
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: "500",
                color: "#555",
                marginBottom: "6px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "0.5px solid #e8e6e0",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#1C1C1C",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fdf0f0",
                border: "0.5px solid #e8b4b4",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "12px",
                color: "#c0504d",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#d0ccc8" : "#1a1a2e",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "500",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ fontSize: "12px", color: "#888", textAlign: "center", marginTop: "20px" }}>
          New ministry? <Link to="/create-ministry" style={{ color: "#1a1a2e" }}>Set up your workspace</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
