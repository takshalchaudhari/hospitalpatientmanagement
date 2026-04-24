import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, useTheme } from '../App';

function navItems(role) {
  const common = [
    { to: '/dashboard', label: 'Overview', description: 'Live command center' },
    { to: '/settings/profile', label: 'My Settings', description: 'Profile and security' }
  ];

  if (role === 'admin') {
    return [
      ...common,
      { to: '/admin/users', label: 'User Control', description: 'Provision and manage access' },
      { to: '/admin/settings', label: 'System Settings', description: 'Hospital configuration' },
      { to: '/admin/audit', label: 'Audit Trail', description: 'Administrative activity' }
    ];
  }

  return common;
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand-block brand-block-shell">
          <span className="brand-chip">Luxury clinical workspace</span>
          <h1>SHMF</h1>
          <p>Executive patient operations for premium care environments and high-trust hospital teams.</p>
        </div>

        <div className="sidebar-panel">
          <div className="sidebar-panel-head">
            <strong>Environment</strong>
            <span>{theme === 'dark' ? 'Night suite' : 'Day suite'}</span>
          </div>
          <button className="theme-toggle" type="button" onClick={toggleTheme}>
            <span>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
            <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
          </button>
        </div>

        <nav className="shell-nav">
          {navItems(user?.role).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `shell-link ${isActive ? 'active' : ''}`}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-panel">
            <strong>{user?.fullName || user?.username}</strong>
            <span>{user?.role}</span>
            <small>{user?.mustChangePassword ? 'Password reset required' : 'Session protected'}</small>
          </div>
          <button className="secondary-btn" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div className="header-copy">
            <p className="eyebrow">Calm luxury healthcare workspace</p>
            <h2>Real-time patient command suite</h2>
            <p className="header-subtitle">
              A denser, premium control surface for patient visibility, role-aware workflows, and protected operational decision-making.
            </p>
          </div>
          <div className="header-status">
            <span className="status-pill online">Encrypted clinical session</span>
            <span className="status-pill neutral">Role: {user?.role}</span>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
