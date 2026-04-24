import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';

const initialForm = {
  username: '',
  fullName: '',
  email: '',
  password: '',
  role: 'staff'
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  async function loadUsers() {
    const res = await AdminAPI.getUsers();
    setUsers(res.data.users);
  }

  useEffect(() => {
    loadUsers().catch((err) => setError(err.response?.data?.message || 'Unable to load users'));
  }, []);

  async function createUser(event) {
    event.preventDefault();
    try {
      await AdminAPI.createUser(form);
      setForm(initialForm);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create user');
    }
  }

  async function updateUser(id, payload) {
    try {
      await AdminAPI.updateUser(id, payload);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update user');
    }
  }

  async function resetPassword(id) {
    const password = window.prompt('Enter a new temporary password (min 12 chars).');
    if (!password) {
      return;
    }
    try {
      await AdminAPI.resetPassword(id, password);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reset password');
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Executive administration</p>
            <h3>Create staff and doctor accounts</h3>
          </div>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        <form className="inline-form" onSubmit={createUser}>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" required />
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" required />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff</option>
            <option value="doctor">Doctor</option>
            <option value="admin">Admin</option>
          </select>
          <button className="primary-btn" type="submit">Create account</button>
        </form>
      </section>

      <section className="panel wide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Managed accounts</p>
            <h3>User lifecycle command board</h3>
          </div>
        </div>
        <div className="list-stack">
          {users.map((user) => (
            <div key={user.id} className="list-row static">
              <div>
                <strong>{user.full_name}</strong>
                <p>{user.username} • {user.email || 'No email'} • {user.role}</p>
              </div>
              <div className="row-actions">
                <select value={user.role} onChange={(e) => updateUser(user.id, { role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="doctor">Doctor</option>
                  <option value="admin">Admin</option>
                </select>
                <select value={user.status} onChange={(e) => updateUser(user.id, { status: e.target.value, fullName: user.full_name, email: user.email })}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="must_change_password">Must change password</option>
                </select>
                <button className="secondary-btn" type="button" onClick={() => resetPassword(user.id)}>
                  Reset password
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
