import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// requireOnboarding: for the profile-dependent surfaces (Content Studio,
// Flyer Generator, Social Queue) — everything else stays reachable even
// before onboarding finishes, so a brand-new ministry isn't locked out of
// the whole app on day one, just the features that need a real profile
// to produce anything useful.
const ProtectedRoute = ({ children, requireOnboarding }) => {
  const { user, ministry, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Cinzel, serif",
          color: "var(--navy)",
          fontSize: "14px",
          letterSpacing: "0.08em",
        }}
      >
        MARGIN
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireOnboarding && ministry && !ministry.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;
