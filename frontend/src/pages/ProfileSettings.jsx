import React, { useEffect, useState } from 'react';
import { useAuth, useTheme } from '../App';
import { AuthAPI, ProfileAPI } from '../services/api';

export default function ProfileSettings() {
  const { user, reloadSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', nextPassword: '' });

  useEffect(() => {
    ProfileAPI.getProfile().then((res) => setProfile(res.data.profile));
  }, [user]);

  async function saveProfile(event) {
    event.preventDefault();
    await ProfileAPI.updateProfile({ fullName: profile.fullName, email: profile.email });
    await reloadSession();
    setMessage('Profile updated');
  }

  async function changePassword(event) {
    event.preventDefault();
    await AuthAPI.changePassword(passwords.currentPassword, passwords.nextPassword);
    setPasswords({ currentPassword: '', nextPassword: '' });
    setMessage('Password updated. Please sign in again.');
  }

  async function logoutAll() {
    await AuthAPI.logoutAll();
    setMessage('All sessions revoked. Sign in again on other devices.');
  }

  if (!profile) {
    return <div className="panel">Loading profile...</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Profile</p>
            <h3>Personal suite settings</h3>
          </div>
        </div>
        {message ? <div className="alert success">{message}</div> : null}
        <form className="inline-form" onSubmit={saveProfile}>
          <input value={profile.fullName || ''} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} placeholder="Full name" />
          <input value={profile.email || ''} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email" />
          <input value={profile.username || ''} disabled placeholder="Username" />
          <input value={profile.role || ''} disabled placeholder="Role" />
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">Light suite</option>
            <option value="dark">Dark suite</option>
          </select>
          <button className="primary-btn" type="submit">Save profile</button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Credential security</p>
            <h3>Change password</h3>
          </div>
        </div>
        <form className="inline-form" onSubmit={changePassword}>
          <input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} placeholder="Current password" required />
          <input type="password" value={passwords.nextPassword} onChange={(e) => setPasswords({ ...passwords, nextPassword: e.target.value })} placeholder="New secure password" required />
          <button className="primary-btn" type="submit">Update password</button>
        </form>
        <button className="secondary-btn" type="button" onClick={logoutAll}>
          Revoke all sessions
        </button>
      </section>
    </div>
  );
}
