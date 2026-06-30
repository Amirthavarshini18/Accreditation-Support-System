import React, { useState } from "react";
import axios from "axios";
import { useApp } from "../AppContext";
import { API_BASE } from "../constants";

export default function Login() {
  const { login, authConfig } = useApp();
  const { allowedDomain, institutionName } = authConfig || { allowedDomain: "nitc.ac.in", institutionName: "NIT Calicut" };

  const DOMAIN_ERROR = `Only ${institutionName} institutional email addresses (@${allowedDomain}) are permitted.`;

  function validateEmail(email) {
    if (!email) return "Email is required.";
    if (!email.toLowerCase().endsWith(`@${allowedDomain}`)) return DOMAIN_ERROR;
    return null;
  }

  const [mode, setMode]         = useState("login"); // "login" | "register"
  const [form, setForm]         = useState({ email: "", password: "", name: "", department: "", designation: "", employeeId: "" });
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // default: persistent
  const [error, setError]       = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [loading, setLoading]   = useState(false);
  const isDomainError = error && (
    error.includes(DOMAIN_ERROR) || 
    error.toLowerCase().includes("invalid email domain") ||
    error.toLowerCase().includes("only nit calicut") ||
    error.toLowerCase().includes("only " + institutionName.toLowerCase())
  );

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErr((e) => ({ ...e, [key]: undefined }));
    setError("");
  }

  function validate() {
    const errs = {};
    const emailErr = validateEmail(form.email.trim());
    if (emailErr) errs.email = emailErr;
    if (!form.password) errs.password = "Password is required.";
    if (mode === "register") {
      if (!form.name.trim()) errs.name = "Full name is required.";
      if (form.password.length < 6) errs.password = "Password must be at least 6 characters.";
    }
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "login" ? `${API_BASE}/auth/login/` : `${API_BASE}/auth/register/`;
      const payload = {
        email:       form.email.trim().toLowerCase(),
        password:    form.password,
        name:        form.name.trim(),
        department:  form.department.trim(),
        designation: form.designation.trim(),
        employeeId:  form.employeeId.trim(),
      };

      // Use a timeout so "Network Error" is visible as an actionable failure.
      const res = await axios.post(endpoint, payload, { timeout: 10000 });
      if (!res.data?.success) throw new Error(res.data?.message || "Authentication failed.");
      login(res.data.faculty, res.data.accessToken, res.data.refreshToken, rememberMe);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      const fallback = err.message || "Authentication failed.";
      setError(status ? `Request failed (${status}): ${msg || fallback}` : (msg || fallback));
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
            🔒 Restricted to <strong style={{ color: "#fff" }}>@{allowedDomain}</strong> institutional accounts only.
          </div>
        </div>

        {/* Form card */}
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h2>{mode === "login" ? "Faculty Login" : "Create Account"}</h2>
          <p className="login-sub">
            {mode === "login"
              ? "Sign in with your institutional email"
              : "Register your NITC faculty account"}
          </p>

          {/* Register-only fields */}
          {mode === "register" && (
            <>
              <label>
                Full Name <span style={{ color: "#e53e3e" }}>*</span>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Dr. / Prof. Full Name"
                  autoComplete="name"
                />
                {fieldErr.name && <span className="field-error">{fieldErr.name}</span>}
              </label>
              <label>
                Department
                <input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Computer Science & Engineering" />
              </label>
              <label>
                Designation
                <input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Assistant Professor" />
              </label>
            </>
          )}

          {/* Email */}
          <label>
            Institutional Email <span style={{ color: "#e53e3e" }}>*</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder={`faculty@${allowedDomain}`}
              autoComplete="email"
              required
            />
            {fieldErr.email && <span className="field-error">{fieldErr.email}</span>}
          </label>

          {/* Password */}
          <label>
            Password <span style={{ color: "#e53e3e" }}>*</span>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13,
                }}
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErr.password && <span className="field-error">{fieldErr.password}</span>}
          </label>

          {/* Domain-specific error (two-line spec format) */}
          {isDomainError && (
            <div className="notice error-notice" style={{ fontSize: 13 }}>
              <strong>Invalid email domain.</strong><br />
              Please login using your <strong>@{allowedDomain}</strong> email.
            </div>
          )}
          {/* Generic error (non-domain) */}
          {error && !isDomainError && (
            <div className="notice error-notice" style={{ fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Remember Me (login mode only) */}
          {mode === "login" && (
            <label className="check-row" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textTransform: "none", marginBottom: 0 }}>
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              Remember me on this device
            </label>
          )}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : (mode === "login" ? "Sign In" : "Create Account")}
          </button>

          <p style={{ textAlign: "center", fontSize: 13, marginTop: 12, color: "var(--muted)" }}>
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button type="button" onClick={() => { setMode("register"); setError(""); setFieldErr({}); }}
                  style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Register
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" onClick={() => { setMode("login"); setError(""); setFieldErr({}); }}
                  style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Sign In
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
