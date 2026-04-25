import React, { useState } from 'react';
import { useAuth, useTheme } from '../App';
import { API_BASE_URL } from '../services/api';

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
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.code === 'ERR_NETWORK') {
        setError(`Cannot reach the backend service at ${API_BASE_URL}.`);
      } else {
        setError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-panel-topbar">
          <button className="theme-toggle theme-toggle-auth" type="button" onClick={toggleTheme}>
            <span>{theme === 'dark' ? 'Day mode' : 'Night mode'}</span>
            <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
          </button>
        </div>
        <h1>Sentinel Health Monitoring Framework</h1>
      </section>

      <section className="login-card-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>

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
        </form>
      </section>
    </div>
  );
}
