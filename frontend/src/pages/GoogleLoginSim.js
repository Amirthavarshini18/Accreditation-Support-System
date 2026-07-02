import React, { useState } from "react";
import axios from "axios";
import { API_BASE, ALLOWED_DOMAIN } from "../constants";

export default function GoogleLoginSim() {
  const [customMode, setCustomMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mockAccounts = [
    { name: "Dr. Jane Doe", email: `jane.doe@${ALLOWED_DOMAIN}`, dept: "Computer Science" },
    { name: "Prof. John Smith", email: `john.smith@${ALLOWED_DOMAIN}`, dept: "Electrical Engineering" },
  ];

  async function handleLogin(selectedEmail, selectedName) {
    if (!selectedEmail.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only ${ALLOWED_DOMAIN} institutional accounts are permitted to sign in.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/google-login/`, {
        email: selectedEmail.trim().toLowerCase(),
        name: selectedName.trim(),
      });
      if (res.data?.success) {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "GOOGLE_LOGIN_SUCCESS",
              faculty: res.data.faculty,
              accessToken: res.data.accessToken,
              refreshToken: res.data.refreshToken,
            },
            window.location.origin
          );
        }
        window.close();
      } else {
        setError(res.data?.message || "Failed to authenticate.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Connection error.");
    } finally {
      setLoading(false);
    }
  }

  function handleCustomSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please fill in both Name and Email.");
      return;
    }
    handleLogin(email, name);
  }

  return (
    <div className="g-sim-shell">
      <div className="g-sim-card">
        {/* Google Logo */}
        <div className="g-logo-wrapper">
          <svg className="g-logo-svg" viewBox="0 0 24 24" width="32" height="32">
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
          <span className="g-logo-text">Google</span>
        </div>

        <h2>Simulated Google Account Chooser</h2>
        <p className="g-sim-sub">to continue to NBA Attainment Portal</p>

        {error && <div className="g-error-box">{error}</div>}

        {!customMode ? (
          <>
            <div className="g-accounts-list">
              {mockAccounts.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => handleLogin(acc.email, acc.name)}
                  className="g-account-item"
                  disabled={loading}
                >
                  <div className="g-avatar-circle">
                    {acc.name.charAt(4) || acc.name.charAt(0)}
                  </div>
                  <div className="g-account-info">
                    <span className="g-acc-name">{acc.name}</span>
                    <span className="g-acc-email">{acc.email}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setCustomMode(true);
                setError("");
              }}
              className="g-use-other-btn"
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="16" y1="11" x2="22" y2="11" />
              </svg>
              Use another account
            </button>
          </>
        ) : (
          <form onSubmit={handleCustomSubmit} className="g-custom-form">
            <label>
              Full Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Jane Doe"
                required
                disabled={loading}
              />
            </label>

            <label>
              Google Account Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`username@${ALLOWED_DOMAIN}`}
                required
                disabled={loading}
              />
              <span className="g-field-hint">Must end with @{ALLOWED_DOMAIN}</span>
            </label>

            <div className="g-form-actions">
              <button
                type="button"
                onClick={() => {
                  setCustomMode(false);
                  setError("");
                }}
                className="g-btn-back"
                disabled={loading}
              >
                Back
              </button>
              <button type="submit" className="g-btn-next" disabled={loading}>
                {loading ? "Signing in..." : "Next"}
              </button>
            </div>
          </form>
        )}

        <div className="g-sim-footer">
          To check domain restrictions, only <strong>@{ALLOWED_DOMAIN}</strong> accounts are permitted.
        </div>
      </div>
    </div>
  );
}
