import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS = { admin: "Admin", leader: "Leader", team: "Team" };

const JoinInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { register } = useAuth();

  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    client
      .get(`/api/public/invites/${token}`)
      .then((res) => {
        setInvite(res.data);
        setName(res.data.name || "");
      })
      .catch((err) => setLoadError(err.response?.data?.error || "This invite could not be found"));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      await register({
        email: invite.email,
        password,
        name: name.trim(),
        ministry_id: invite.ministry_id,
        invite_token: token,
      });
      navigate("/");
    } catch (err) {
      setSubmitError(err.response?.data?.error || "Failed to create your account");
    } finally {
      setSubmitting(false);
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
          <p style={{ fontSize: "12px", color: "#888", marginTop: "6px", letterSpacing: "0.04em" }}>
            Ministry Operations Platform
          </p>
        </div>

        {loadError && (
          <div style={{ fontSize: "13px", color: "#c0504d", textAlign: "center" }}>{loadError}</div>
        )}

        {!loadError && !invite && (
          <div style={{ fontSize: "13px", color: "#888", textAlign: "center" }}>Loading invite...</div>
        )}

        {invite && (
          <>
            <p style={{ fontSize: "13px", color: "#333", textAlign: "center", marginBottom: "24px", lineHeight: "1.6" }}>
              You've been invited to join <strong>{invite.ministry_name}</strong> as a{" "}
              <strong>{ROLE_LABELS[invite.role] || invite.role}</strong>. Set up your account below.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label
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
                  type="email"
                  value={invite.email}
                  disabled
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "0.5px solid #e8e6e0",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#888",
                    background: "#f7f7f5",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
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
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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

              {submitError && (
                <div
                  style={{
                    background: "#fdf0f0",
                    border: "0.5px solid #e8b4b4",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    color: "#c0504d",
                    marginBottom: "16px",
                  }}
                >
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#1a1a2e",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                {submitting ? "Creating account..." : "Join the team"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinInvite;
