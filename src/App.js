import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ContentStudio from "./pages/ContentStudio";
import Communications from "./pages/Communications";
import Calendar from "./pages/Calendar";
import Tasks from "./pages/Tasks";
import Team from "./pages/Team";
import ProfileEditor from "./pages/ProfileEditor";
import FlyerGenerator from "./pages/FlyerGenerator";
import People from "./pages/People";
import Onboarding from "./pages/Onboarding";

const AppShell = ({ children }) => (
  <div style={{ display: "flex", minHeight: "100vh" }}>
    <Sidebar />
    <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/content"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ContentStudio />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/communications"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Communications />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Calendar />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Tasks />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Team />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/flyers"
            element={
              <ProtectedRoute>
                <AppShell>
                  <FlyerGenerator />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/people"
            element={
              <ProtectedRoute>
                <AppShell>
                  <People />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Onboarding />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProfileEditor />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
