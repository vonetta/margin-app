import React, { useState } from "react";
import client from "../api/client";
import { clickableDivProps } from "../utils/a11y";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "0.5px solid var(--gray-300)",
  borderRadius: "var(--border-radius)",
  fontSize: "13px",
  color: "var(--charcoal)",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "10px",
  color: "var(--gray-600)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const ChangePasswordModal = () => {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }

    setSaving(true);
    try {
      await client.put("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        {...clickableDivProps(() => setOpen(true))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "12px",
          color: "rgba(255,255,255,0.55)",
          cursor: "pointer",
          letterSpacing: "0.02em",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        ⚿ Change password
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: "var(--white)",
              borderRadius: "var(--border-radius-lg)",
              padding: "24px",
              width: "360px",
              maxWidth: "90vw",
            }}
          >
            <div
              style={{
                fontFamily: "Cinzel, serif",
                fontSize: "14px",
                color: "var(--navy)",
                marginBottom: "16px",
              }}
            >
              Change password
            </div>

            {success ? (
              <>
                <div style={{ fontSize: "12px", color: "var(--charcoal)", marginBottom: "16px" }}>
                  Password changed. Use it next time you sign in.
                </div>
                <button
                  onClick={close}
                  style={{
                    padding: "8px 16px",
                    background: "var(--navy)",
                    color: "var(--white)",
                    border: "none",
                    borderRadius: "var(--border-radius)",
                    fontSize: "12px",
                    fontWeight: "500",
                  }}
                >
                  Close
                </button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "12px" }}>
                  <label style={labelStyle} htmlFor="change-password-current">Current password</label>
                  <input
                    id="change-password-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={labelStyle} htmlFor="change-password-new">New password</label>
                  <input
                    id="change-password-new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle} htmlFor="change-password-confirm">Confirm new password</label>
                  <input
                    id="change-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      background: "#fdf0f0",
                      border: "0.5px solid #e8b4b4",
                      borderRadius: "var(--border-radius)",
                      padding: "8px 12px",
                      fontSize: "12px",
                      color: "#c0504d",
                      marginBottom: "16px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: "8px 16px",
                      background: saving ? "var(--gray-400)" : "var(--navy)",
                      color: "var(--white)",
                      border: "none",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {saving ? "Saving..." : "Change password"}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      color: "var(--gray-600)",
                      border: "0.5px solid var(--gray-300)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "12px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChangePasswordModal;
