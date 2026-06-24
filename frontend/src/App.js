import React from "react";
import { createPortal } from "react-dom";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
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

const guideItems = [
  { title: "Course Information", desc: "Course name, code, academic year, semester, programme, specialization, credits, and faculty name." },
  { title: "Course Outcomes", desc: "Clearly defined CO statements with Bloom's Taxonomy levels, target grade, target percentage, and related SDGs." },
  { title: "PSO Details", desc: "Programme Specific Outcomes and their related Washington Knowledge indicators." },
  { title: "Assessment Policy", desc: "Weightage for Internal Assessment, End Semester Examination, Continuous Assessment, and any other component." },
  { title: "Excel Marks Sheets", desc: "CO-wise formatted Excel files for Internal Assessment, End Semester Examination, and Continuous Assessment." },
  { title: "Survey Data", desc: "Indirect assessment responses for each CO using VH, H, M, L, and VL scale levels." },
  { title: "Washington Accord Mapping", desc: "CO to WK connections and derived CO-PO-PSO mappings for automated attainment calculation." },
];

function WelcomeModal() {
  const { showWelcome, setShowWelcome } = useApp();
  const navigate = useNavigate();
  if (!showWelcome) return null;
  return createPortal(
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-badge">NBA</span>
          <h2>Welcome to Accreditation Support System</h2>
          <p className="modal-subtitle">GAPC 4.0 Workflow Guide</p>
        </div>
        <p className="modal-intro">Before you begin, please keep the following details ready:</p>
        <ol className="modal-list">
          {guideItems.map((item, i) => (
            <li key={i}><strong>{item.title}</strong> — {item.desc}</li>
          ))}
        </ol>
        <p className="modal-body-note">
          This system will guide you step by step through course configuration, mapping, marks upload, attainment calculation, and report generation.
        </p>
        <button className="modal-btn" onClick={() => { setShowWelcome(false); navigate("/dashboard"); }}>
          I Understand, Continue
        </button>
        <p className="modal-footer-note">
          Note: Please ensure Excel files follow the required CO header format before upload.
        </p>
      </div>
    </div>,
    document.body
  );
}

function ProtectedRoute({ children }) {
  const { faculty } = useApp();
  if (!faculty) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { faculty, status, error, setStatus, setError } = useApp();

  return (
    <>
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

      <WelcomeModal />

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
