import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const labelStyle = {
  display: "block",
  fontSize: "11px",
  fontWeight: "500",
  color: "#555",
  marginBottom: "6px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "0.5px solid #e8e6e0",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#1C1C1C",
  outline: "none",
};

const CreateMinistry = () => {
  const [ministryName, setMinistryName] = useState("");
  const [ministryIdTouched, setMinistryIdTouched] = useState(false);
  const [ministryId, setMinistryId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { registerMinistry } = useAuth();
  const navigate = useNavigate();

  const handleNameChange = (value) => {
    setMinistryName(value);
    if (!ministryIdTouched) {
      setMinistryId(slugify(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerMinistry({
        ministry_id: ministryId,
        ministry_name: ministryName,
        name,
        email,
        password,
      });
      navigate("/onboarding");
    } catch (err) {
      setError(err.response?.data?.error || "Could not create your ministry");
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
          maxWidth: "420px",
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
          <p style={{ fontSize: "12px", color: "#888", marginTop: "6px", letterSpacing: "0.04em" }}>
            Set up your ministry's workspace
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Ministry name</label>
            <input
              type="text"
              value={ministryName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Workspace URL slug</label>
            <input
              type="text"
              value={ministryId}
              onChange={(e) => {
                setMinistryIdTouched(true);
                setMinistryId(slugify(e.target.value));
              }}
              required
              pattern="[a-z0-9-]+"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Your name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
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
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create ministry"}
          </button>
        </form>

        <p style={{ fontSize: "12px", color: "#888", textAlign: "center", marginTop: "20px" }}>
          Already have an account? <Link to="/login" style={{ color: "#1a1a2e" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default CreateMinistry;
