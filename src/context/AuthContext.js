import React, { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";
import { applyBranding, resetBranding } from "../utils/applyBranding";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ministryId, setMinistryId] = useState(null);
  const [ministry, setMinistry] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMinistryBranding = async (mId) => {
    try {
      const res = await client.get("/api/ministry");
      setMinistry(res.data);
      applyBranding(res.data.branding);
    } catch (err) {
      console.error("Failed to load ministry branding");
    }
  };

  // /api/auth/me enriches each membership with the ministry's name/tagline
  // (the login/register response doesn't), so the ministry switcher has
  // something to show. Refetch after creating a new sub-ministry too, so
  // the new membership shows up without a re-login.
  const refreshUser = async () => {
    try {
      const res = await client.get("/api/auth/me");
      setUser(res.data);
      localStorage.setItem("margin_user", JSON.stringify(res.data));
      return res.data;
    } catch (err) {
      console.error("Failed to refresh user");
      return null;
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("margin_user");
    const storedMinistryId = localStorage.getItem("margin_ministry_id");
    if (storedUser && storedMinistryId) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setMinistryId(storedMinistryId);
      loadMinistryBranding(storedMinistryId);
      refreshUser();
    }
    setLoading(false);
  }, []);

  // Shared by login, self-registration, invite acceptance, and brand-new
  // ministry creation — every one of these ends the same way: a token and
  // a user land in hand, and the app needs a live session for whichever
  // ministry they should land in.
  const establishSession = async (token, user, selectedMinistryId) => {
    const targetMinistryId =
      selectedMinistryId || user.ministries[0]?.ministry_id;

    localStorage.setItem("margin_token", token);
    localStorage.setItem("margin_user", JSON.stringify(user));
    localStorage.setItem("margin_ministry_id", targetMinistryId);

    setUser(user);
    setMinistryId(targetMinistryId);

    await loadMinistryBranding(targetMinistryId);
    await refreshUser();

    return user;
  };

  const login = async (email, password, selectedMinistryId) => {
    const res = await client.post("/api/auth/login", { email, password });
    return establishSession(res.data.token, res.data.user, selectedMinistryId);
  };

  // Shared by direct self-registration and invite acceptance — both end
  // with the same "create account, establish a session" shape as login.
  const register = async (payload) => {
    const res = await client.post("/api/auth/register", payload);
    return establishSession(res.data.token, res.data.user);
  };

  // Brand-new ministry, created from scratch (no existing ministry_id to
  // join) — lands the founding admin straight into the ministry they just
  // created, same as register().
  const registerMinistry = async (payload) => {
    const res = await client.post("/api/auth/register-ministry", payload);
    return establishSession(res.data.token, res.data.user, payload.ministry_id);
  };

  const logout = () => {
    localStorage.removeItem("margin_token");
    localStorage.removeItem("margin_user");
    localStorage.removeItem("margin_ministry_id");
    setUser(null);
    setMinistryId(null);
    setMinistry(null);
    resetBranding();
  };

  const switchMinistry = async (newMinistryId) => {
    localStorage.setItem("margin_ministry_id", newMinistryId);
    setMinistryId(newMinistryId);
    await loadMinistryBranding(newMinistryId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        ministryId,
        ministry,
        loading,
        login,
        register,
        registerMinistry,
        logout,
        switchMinistry,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
