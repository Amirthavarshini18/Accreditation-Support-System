import React, { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import axios from "axios";
import { useApp } from "../AppContext";
import { API_BASE } from "../constants";

function LoginInner() {
  const { login, authConfig } = useApp();
  const { allowedDomains = [], allowedDomain = "", institutionName = "NIT Calicut" } = authConfig || {};
  const domainList = allowedDomains.length ? allowedDomains : (allowedDomain ? [allowedDomain] : []);
  const domainDisplay = domainList.map(d => `@${d}`).join(", ") || "your institutional";
  const anyDomain = domainList.length === 0;

  const [mode, setMode] = useState("login"); // "login" | "complete-registration"
  const [pendingCredential, setPendingCredential] = useState(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [form, setForm] = useState({ name: "", department: "", designation: "", employeeId: "" });
  const [fieldErr, setFieldErr] = useState({});
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/google/`, {
        credential: credentialResponse.credential,
      }, { timeout: 10000 });
      const { access, refresh, user } = res.data;
      if (!access || !user) throw new Error("Authentication failed.");
      login(user, access, refresh, rememberMe);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 404 && data?.is_registered === false) {
        setPendingCredential(credentialResponse.credential);
        setPendingEmail(data.email || "");
        setPendingName(data.name || "");
        setForm((f) => ({ ...f, name: data.name || "" }));
        setMode("complete-registration");
      } else {
        const msg = data?.message || err.message || "Google Sign-In failed.";
        setError(
          msg.toLowerCase().includes("domain") ||
          msg.toLowerCase().includes("permitted") ||
          msg.toLowerCase().includes("allowed")
            ? `Only ${domainDisplay} Google accounts are allowed. Please use your institutional email.`
            : msg
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleError() {
    setError("Google Sign-In was cancelled or failed. Please try again.");
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Full name is required.";
    if (!form.department.trim()) errs.department = "Department is required.";
    if (!form.designation.trim()) errs.designation = "Designation is required.";
    if (Object.keys(errs).length) { setFieldErr(errs); return; }

    setLoading(true);
    setError("");
    setFieldErr({});
    try {
      const res = await axios.post(`${API_BASE}/auth/google/`, {
        credential: pendingCredential,
        name: form.name.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
        employee_id: form.employeeId.trim(),
      }, { timeout: 10000 });
      const { access, refresh, user } = res.data;
      if (!access || !user) throw new Error("Registration failed.");
      login(user, access, refresh, rememberMe);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        {/* Hero */}
        <div className="login-hero">
          <div className="login-badge">NBA</div>
          <p className="eyebrow">National Board of Accreditation</p>
          <h1>CO-PO Attainment System</h1>
          <p className="login-copy">
            Web-based application for Course Outcome (CO) and Programme Outcome (PO)
            attainment calculations aligned with GAPC 4.0, WK profiles, and SDGs as
            per the revised NBA SAR 2025.
          </p>
          <div className="login-features">
            {["Manual & Excel-based marks entry", "Dynamic CO-PO mapping", "GAPC 4.0 aligned POs", "SDG integration", "CSV & PDF export"].map((f) => (
              <span key={f} className="feature-pill">✓ {f}</span>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            🔒 {anyDomain ? "Sign in with any Google account." : <>Restricted to <strong style={{ color: "#fff" }}>{domainDisplay}</strong> accounts only.</>}
          </div>
        </div>

        {/* Form card */}
        <div className="login-card">
          {mode === "login" ? (
            <>
              <h2>Faculty Login</h2>
              <p className="login-sub">
                Sign in with your {anyDomain ? "Google" : <strong>{domainDisplay}</strong>} account.
              </p>

              {error && (
                <div className="notice error-notice" style={{ fontSize: 13, marginBottom: 16 }}>
                  {error.toLowerCase().includes("only @") || error.toLowerCase().includes("domain") ? (
                    <><strong>Invalid email domain.</strong><br />Please use a {domainDisplay} Google account.</>
                  ) : error}
                </div>
              )}

              <label className="check-row" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textTransform: "none", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Remember me on this device
              </label>

              <div style={{ display: "flex", justifyContent: "center", opacity: loading ? 0.6 : 1, pointerEvents: loading ? "none" : "auto" }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                  width="330"
                  text="signin_with"
                  shape="rectangular"
                  logo_alignment="left"
                />
              </div>

              {loading && (
                <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
                  Verifying with Google…
                </p>
              )}

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 20, lineHeight: 1.5 }}>
                First-time users will be prompted to complete their faculty profile after signing in.
              </p>
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit} noValidate style={{ width: "100%" }}>
              <h2>Complete Faculty Profile</h2>
              <p className="login-sub">
                Your Google account was verified. Please fill in your faculty details to finish registration.
              </p>

              {error && (
                <div className="notice error-notice" style={{ fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <label>
                Institutional Email
                <input type="email" value={pendingEmail} disabled style={{ background: "rgba(0,0,0,0.04)", cursor: "not-allowed" }} />
              </label>

              <label>
                Full Name <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.name}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFieldErr((fe) => ({ ...fe, name: undefined })); }}
                  placeholder="e.g. Dr. Jane Doe"
                />
                {fieldErr.name && <span className="field-error">{fieldErr.name}</span>}
              </label>

              <label>
                Department <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.department}
                  onChange={(e) => { setForm((f) => ({ ...f, department: e.target.value })); setFieldErr((fe) => ({ ...fe, department: undefined })); }}
                  placeholder="e.g. Computer Science & Engineering"
                />
                {fieldErr.department && <span className="field-error">{fieldErr.department}</span>}
              </label>

              <label>
                Designation <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.designation}
                  onChange={(e) => { setForm((f) => ({ ...f, designation: e.target.value })); setFieldErr((fe) => ({ ...fe, designation: undefined })); }}
                  placeholder="e.g. Assistant Professor"
                />
                {fieldErr.designation && <span className="field-error">{fieldErr.designation}</span>}
              </label>
              
              <button type="submit" disabled={loading} className="login-btn" style={{ marginTop: 16, width: "100%" }}>
                {loading ? "Completing Registration…" : "Complete Registration"}
              </button>

              <button
                type="button"
                onClick={() => { setMode("login"); setPendingCredential(null); setError(""); setFieldErr({}); }}
                style={{ marginTop: 8, width: "100%", padding: "9px 16px", border: "1px solid var(--line)", borderRadius: 6, background: "none", color: "var(--muted)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                ← Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { authConfig } = useApp();
  const clientId = authConfig?.googleClientId || process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <LoginInner />
    </GoogleOAuthProvider>
  );
}
