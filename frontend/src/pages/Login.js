import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useApp } from "../AppContext";
import { API_BASE } from "../constants";

export default function Login() {
  const { login, authConfig } = useApp();
  const { allowedDomain, institutionName, googleClientId: configClientId } = authConfig || { allowedDomain: "nitc.ac.in", institutionName: "NIT Calicut", googleClientId: "" };
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || configClientId || "";

  const DOMAIN_ERROR = `Only ${institutionName} institutional email addresses (@${allowedDomain}) are permitted.`;

  const [mode, setMode] = useState("login"); // "login" | "complete-registration"
  const [unregisteredUser, setUnregisteredUser] = useState(null);
  const [form, setForm] = useState({ name: "", department: "", designation: "", employeeId: "" });
  const [rememberMe, setRememberMe] = useState(true); // default: persistent
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGsiLoaded(true);
    document.body.appendChild(script);
    return () => {
      try {
        document.body.removeChild(script);
      } catch (_) {}
    };
  }, []);

  const handleCredentialResponse = useCallback(async (response) => {
    const idToken = response.credential;
    setLoading(true);
    setError("");
    setFieldErr({});
    try {
      const res = await axios.post(`${API_BASE}/auth/google/`, {
        credential: idToken
      }, { timeout: 10000 });
      
      const { access, refresh, user } = res.data;
      if (!access || !user) throw new Error("Authentication failed: invalid response from server.");
      login(user, access, refresh, rememberMe);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      
      if (status === 404 && data && data.is_registered === false) {
        setUnregisteredUser({
          email: data.email,
          name: data.name,
          credential: idToken
        });
        setForm((f) => ({
          ...f,
          name: data.name || "",
        }));
        setMode("complete-registration");
      } else {
        const msg = data?.message;
        const fallback = err.message || "Google Sign-In failed.";
        let errorMsg = msg || fallback;
        if (err.response?.status === 400 && (errorMsg.toLowerCase().includes("domain") || errorMsg.toLowerCase().includes("allowed") || errorMsg.toLowerCase().includes("permitted"))) {
          errorMsg = `Only @${allowedDomain} Google accounts are allowed.`;
        }
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [login, rememberMe, allowedDomain]);

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Full name is required.";
    if (!form.department.trim()) errs.department = "Department is required.";
    if (!form.designation.trim()) errs.designation = "Designation is required.";
    
    if (Object.keys(errs).length > 0) {
      setFieldErr(errs);
      return;
    }

    setLoading(true);
    setError("");
    setFieldErr({});
    try {
      const res = await axios.post(`${API_BASE}/auth/google/`, {
        credential: unregisteredUser.credential,
        name: form.name.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
        employee_id: form.employeeId.trim(),
      }, { timeout: 10000 });

      const { access, refresh, user } = res.data;
      if (!access || !user) throw new Error("Registration failed: invalid response from server.");
      login(user, access, refresh, rememberMe);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!gsiLoaded || !googleClientId) return;
    try {
      /* global google */
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
      });
      google.accounts.id.renderButton(
        document.getElementById("google-signin-div"),
        { theme: "outline", size: "large", width: 330 }
      );
    } catch (err) {
      console.error("Error rendering Google button:", err);
    }
  }, [gsiLoaded, googleClientId, handleCredentialResponse]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "GOOGLE_LOGIN_SUCCESS") {
        const { faculty, accessToken, refreshToken } = event.data;
        login(faculty, accessToken, refreshToken, rememberMe);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [login, rememberMe]);

  function handleGoogleLogin() {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      "/google-login-sim",
      "Google Sign In",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
  }

  const isDomainError = error && (
    error.includes(DOMAIN_ERROR) || 
    error.toLowerCase().includes("invalid email domain") ||
    error.toLowerCase().includes("only nit calicut") ||
    error.toLowerCase().includes("only " + institutionName.toLowerCase()) ||
    error.toLowerCase().includes("only @")
  );

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
            🔒 Restricted to <strong style={{ color: "#fff" }}>@{allowedDomain}</strong> institutional accounts only.
          </div>
        </div>

        {/* Form card */}
        <div className="login-card">
          {mode === "login" ? (
            <>
              <h2>Faculty Login</h2>
              <p className="login-sub">
                Sign in with your institutional Google account to access the system.
              </p>
              <p className="login-sub-hint" style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 16, textAlign: "center" }}>
                Only institutional <strong>@{allowedDomain}</strong> accounts are permitted. If you do not have a registered profile, you will be prompted to sign up.
              </p>

              {/* Domain-specific error (two-line spec format) */}
              {isDomainError && (
                <div className="notice error-notice" style={{ fontSize: 13, marginBottom: 16 }}>
                  <strong>Invalid email domain.</strong><br />
                  Please login using your <strong>@{allowedDomain}</strong> email.
                </div>
              )}
              {/* Generic error (non-domain) */}
              {error && !isDomainError && (
                <div className="notice error-notice" style={{ fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Remember Me checkbox */}
              <label className="check-row" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textTransform: "none", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Remember me on this device
              </label>

              <div 
                id="google-signin-div" 
                style={{ display: "flex", justifyContent: "center", width: "100%", minHeight: 40, marginBottom: 12 }}
              />

              <div className="login-separator" style={{ margin: "16px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span>or</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="g-login-btn"
                style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
              >
                <svg className="g-btn-logo" viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: 8 }}>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.63-1.05-1.38-1.21-2.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Simulate Google Login (Dev Fallback)
              </button>
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit} noValidate style={{ width: "100%" }}>
              <h2>Create Faculty Profile</h2>
              <p className="login-sub">
                Complete your profile details to register your account.
              </p>

              {error && (
                <div className="notice error-notice" style={{ fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Read-only Google Email */}
              <label>
                Institutional Email
                <input
                  type="email"
                  value={unregisteredUser?.email || ""}
                  disabled
                  style={{ background: "rgba(255,255,255,0.05)", cursor: "not-allowed" }}
                />
              </label>

              {/* Full Name */}
              <label>
                Full Name <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dr. Jane Doe"
                  required
                />
                {fieldErr.name && <span className="field-error">{fieldErr.name}</span>}
              </label>

              {/* Department */}
              <label>
                Department <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.department}
                  onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Computer Science & Engineering"
                  required
                />
                {fieldErr.department && <span className="field-error">{fieldErr.department}</span>}
              </label>

              {/* Designation */}
              <label>
                Designation <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.designation}
                  onChange={(e) => setForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. Assistant Professor"
                  required
                />
                {fieldErr.designation && <span className="field-error">{fieldErr.designation}</span>}
              </label>

              {/* Employee ID */}
              <label>
                Employee ID
                <input
                  value={form.employeeId || ""}
                  onChange={(e) => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  placeholder="e.g. EMP123"
                />
              </label>

              <button type="submit" disabled={loading} className="login-btn" style={{ marginTop: 16, width: "100%" }}>
                {loading ? "Completing Registration..." : "Complete Registration"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setUnregisteredUser(null);
                  setError("");
                  setFieldErr({});
                }}
                className="secondary"
                style={{ marginTop: 8, width: "100%", padding: "9px 16px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, background: "none", color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}
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
