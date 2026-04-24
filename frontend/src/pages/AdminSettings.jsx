import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    AdminAPI.getSystemSettings().then((res) => setSettings(res.data.settings));
  }, []);

  async function save(event) {
    event.preventDefault();
    await AdminAPI.updateSystemSettings(settings);
    setMessage('System settings updated');
  }

  if (!settings) {
    return <div className="panel">Loading system settings...</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin control</p>
          <h3>System settings</h3>
        </div>
      </div>
      {message ? <div className="alert success">{message}</div> : null}
      <form className="inline-form" onSubmit={save}>
        <input value={settings.hospitalName || ''} onChange={(e) => setSettings({ ...settings, hospitalName: e.target.value })} placeholder="Hospital name" />
        <input value={settings.logoUrl || ''} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} placeholder="Logo URL" />
        <input value={settings.timezone || ''} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} placeholder="Timezone" />
        <input type="number" value={settings.sessionTimeoutMinutes || 15} onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: Number(e.target.value) })} placeholder="Session timeout" />
        <input type="number" value={settings.auditRetentionDays || 90} onChange={(e) => setSettings({ ...settings, auditRetentionDays: Number(e.target.value) })} placeholder="Audit retention" />
        <select value={settings.beltGatewayMode || 'device_key'} onChange={(e) => setSettings({ ...settings, beltGatewayMode: e.target.value })}>
          <option value="device_key">Device key</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <button className="primary-btn" type="submit">Save settings</button>
      </form>
    </section>
  );
}
