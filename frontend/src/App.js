import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./AppContext";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CourseDetails from "./pages/CourseDetails";
import AttainmentType from "./pages/AttainmentSetup";
import QuestionsMapping from "./pages/QuestionsCoPo";
import WKMapping from "./pages/WashingtonKnowledgeMapping";
import MarksEntry from "./pages/MarksUpload";
import IndirectSurvey from "./pages/ExitSurvey";
import Report from "./pages/Report";
import ExportPage from "./pages/ReportExport";

import "./App.css";

function ProtectedRoute({ children }) {
  const { faculty } = useApp();
  if (!faculty) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { faculty, status, error, setStatus, setError } = useApp();

  return (
    <>
      {/* Global status/error banners inside protected area */}
      <Routes>
        <Route path="/login" element={faculty ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<Navigate to={faculty ? "/dashboard" : "/login"} replace />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/course" element={<ProtectedRoute><CourseDetails /></ProtectedRoute>} />
        <Route path="/attainment-type" element={<ProtectedRoute><AttainmentType /></ProtectedRoute>} />
        <Route path="/questions" element={<ProtectedRoute><QuestionsMapping /></ProtectedRoute>} />
        <Route path="/wk-mapping" element={<ProtectedRoute><WKMapping /></ProtectedRoute>} />
        <Route path="/marks" element={<ProtectedRoute><MarksEntry /></ProtectedRoute>} />
        <Route path="/survey" element={<ProtectedRoute><IndirectSurvey /></ProtectedRoute>} />
        <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        <Route path="/export" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global notifications */}
      {(status || error) && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "grid", gap: 8, maxWidth: 380 }}>
          {status && (
            <div className="notice" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {status}
              <button className="secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setStatus("")}>✕</button>
            </div>
          )}
          {error && (
            <div className="notice error-notice" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {error}
              <button className="secondary" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setError("")}>✕</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
