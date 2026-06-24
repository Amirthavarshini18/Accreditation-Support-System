import React, { useState } from "react";
import axios from "axios";
import { useApp } from "../AppContext";
import { API_BASE } from "../constants";

export default function Login() {
  const { login } = useApp();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/login/`, form);
      if (!res.data.success) throw new Error(res.data.message || "Login failed");
      login(res.data.faculty);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
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
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Faculty Login</h2>
          <p className="login-sub">Enter your credentials to access the system</p>

          <label>
            Full Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dr. / Prof. Name"
            />
          </label>
          <label>
            Email Address
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="faculty@institute.edu"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="notice error-notice">{error}</div>}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
