import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    AdminAPI.getAuditLogs().then((res) => setLogs(res.data.logs));
  }, []);

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Audit visibility</p>
          <h3>Administrative and system event ledger</h3>
        </div>
      </div>
      <div className="list-stack">
        {logs.map((log) => (
          <div key={log.id} className="list-row static">
            <div>
              <strong>{log.action}</strong>
              <p>{log.actor_username || 'system'} • {log.target_type} {log.target_id || ''}</p>
            </div>
            <span>{new Date(log.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
