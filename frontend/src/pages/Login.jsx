import React, { useState } from 'react';
import { useAuth } from '../App';

export default function Login() {
  const { login } = useAuth();
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
        <div className="brand-chip">Secure hospital access</div>
        <h1>Sentinel Health Monitoring Framework</h1>
        <p className="panel-copy">
          A premium command center for secure patient monitoring, account governance, and live belt history.
        </p>

        <div className="login-hero-card">
          <div className="hero-kpi-grid">
            <div className="hero-kpi">
              <span>Shift visibility</span>
              <strong>24/7</strong>
            </div>
            <div className="hero-kpi">
              <span>Access control</span>
              <strong>RBAC</strong>
            </div>
            <div className="hero-kpi">
              <span>Event traceability</span>
              <strong>Live</strong>
            </div>
          </div>
          <div className="history-preview">
            <div className="history-preview-head">
              <strong>Patient history timeline</strong>
              <span>Designed for quick review</span>
            </div>
            <div className="history-preview-item">
              <span className="history-dot clinical" />
              <div>
                <strong>ICU-1 arrival detected</strong>
                <p>Belt event, room context, and clinical note appear in one place.</p>
              </div>
            </div>
            <div className="history-preview-item">
              <span className="history-dot observation" />
              <div>
                <strong>Doctor annotation added</strong>
                <p>Structured notes and timeline history stay attached to the patient record.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <p className="eyebrow">Secure sign in</p>
          <h2>Access the clinical console</h2>
          <p className="muted-copy">
            Accounts are provisioned by an administrator only. Use your hospital-issued credentials.
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
            <strong>Need help?</strong>
            <span>For access approval or password recovery, contact your hospital administrator.</span>
          </div>
        </form>
      </section>
    </div>
  );
}
