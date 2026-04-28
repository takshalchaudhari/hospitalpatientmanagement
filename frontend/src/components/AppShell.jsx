import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth, useTheme } from '../App';

const clinicalItems = [
  { to: '/dashboard', label: 'Dashboard', description: 'Live operations' }
];

function getInitials(user) {
  const source = user?.fullName || user?.username || 'SHMF';
  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuRef = useRef(null);
  const canManageAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className={`shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`shell-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-topbar">
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <div className="brand-block brand-block-shell">
          <span className="brand-chip">Care workspace</span>
          <h1>SHMF</h1>
          <p>Elegant hospital operations with faster patient control.</p>
        </div>

        <nav className="shell-nav">
          <div className="nav-group">
            <p className="nav-section-label">Clinic</p>
            {clinicalItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `shell-link ${isActive ? 'active' : ''}`}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div className="header-copy">
            <p className="eyebrow">Clinical command center</p>
            <h2>Patient care dashboard</h2>
            <p className="header-subtitle">
              Clear visibility, calmer visuals, and sharper hospital workflows in one refined workspace.
            </p>
          </div>
          <div className="header-status header-status-top">
            <div className="header-meta">
              <span>Role: {user?.role}</span>
              <small>Secure session active</small>
            </div>
            <div className="profile-menu-wrap" ref={menuRef}>
              <button
                className="profile-avatar"
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-expanded={menuOpen}
                aria-label="Open profile menu"
              >
                {getInitials(user)}
              </button>
              {menuOpen ? (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    <strong>{user?.fullName || user?.username}</strong>
                    <span>{user?.username}</span>
                  </div>
                  {canManageAdmin ? (
                    <>
                      <NavLink to="/admin/users" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                        User management
                      </NavLink>
                      <NavLink to="/admin/settings" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                        System settings
                      </NavLink>
                      <NavLink to="/admin/audit" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                        Audit logs
                      </NavLink>
                    </>
                  ) : null}
                  <NavLink to="/settings/profile" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
                    Profile settings
                  </NavLink>
                  <button className="profile-menu-item" type="button" onClick={toggleTheme}>
                    Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                  </button>
                  <button className="profile-menu-item danger" type="button" onClick={logout}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
