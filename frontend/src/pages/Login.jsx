import React, { useState } from 'react';
import { useAuth, useTheme } from '../App';

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-panel-topbar">
          <div className="brand-chip">Private hospital command suite</div>
          <button className="theme-toggle theme-toggle-auth" type="button" onClick={toggleTheme}>
            <span>{theme === 'dark' ? 'Day mode' : 'Night mode'}</span>
            <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
          </button>
        </div>
        <h1>Luxury clinical control for modern patient care.</h1>
        <p className="panel-copy">
          Sentinel Health Monitoring Framework gives premium hospitals a calmer way to manage monitoring, audit visibility, patient history, and secure staff access.
        </p>

        <div className="login-hero-card">
          <div className="hero-kpi-grid">
            <div className="hero-kpi">
              <span>Operations coverage</span>
              <strong>24/7 care</strong>
            </div>
            <div className="hero-kpi">
              <span>Access control</span>
              <strong>Role-aware</strong>
            </div>
            <div className="hero-kpi">
              <span>Clinical recall</span>
              <strong>Unified history</strong>
            </div>
          </div>
          <div className="history-preview">
            <div className="history-preview-head">
              <strong>Patient journey timeline</strong>
              <span>Designed for premium care teams</span>
            </div>
            <div className="history-preview-item">
              <span className="history-dot clinical" />
              <div>
                <strong>Ward transition captured instantly</strong>
                <p>Belt movement, room context, and staff notes align into one executive timeline.</p>
              </div>
            </div>
            <div className="history-preview-item">
              <span className="history-dot observation" />
              <div>
                <strong>Doctor directive added in context</strong>
                <p>Clinical annotations stay attached to the patient story instead of being scattered across screens.</p>
              </div>
            </div>
          </div>
          <div className="login-lounge-strip">
            <div>
              <span>Luxury tone</span>
              <strong>Soft glass surfaces</strong>
            </div>
            <div>
              <span>Theme parity</span>
              <strong>Dark and light suites</strong>
            </div>
            <div>
              <span>Executive density</span>
              <strong>Faster scan behavior</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <p className="eyebrow">Secure sign in</p>
          <h2>Enter the patient operations suite</h2>
          <p className="muted-copy">
            Accounts are provisioned by administrators only. Use your hospital-issued credentials to access your protected workspace.
          </p>

          {error ? <div className="alert error">{error}</div> : null}

          <label className="field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="Enter your username"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Enter your password"
              required
            />
          </label>

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="support-card">
            <strong>Private access support</strong>
            <span>For account approval, credential recovery, or shift onboarding, contact your hospital administrator.</span>
          </div>
        </form>
      </section>
    </div>
  );
}
