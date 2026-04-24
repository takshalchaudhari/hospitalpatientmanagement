import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PatientAPI } from '../services/api';
import { getSocket } from '../services/socket';

function formatTime(timestamp) {
  if (!timestamp) return 'Just now';
  return new Date(timestamp).toLocaleString();
}

export default function Dashboard() {
  const [patients, setPatients] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [patientRes, eventRes] = await Promise.all([
          PatientAPI.getPatients(),
          PatientAPI.getRecentActivity(12)
        ]);
        setPatients(patientRes.data.patients);
        setEvents(eventRes.data.events);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onDetected = (event) => {
      setEvents((current) => [event, ...current].slice(0, 12));
    };
    socket.on('patient_detected', onDetected);
    return () => socket.off('patient_detected', onDetected);
  }, []);

  const summary = useMemo(() => ({
    totalPatients: patients.length,
    activeRooms: new Set(patients.map((patient) => patient.room)).size,
    criticalWatch: patients.filter((patient) => String(patient.status).toLowerCase() !== 'stable').length,
    recentAlerts: events.length
  }), [patients, events]);

  if (loading) {
    return <div className="panel">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="panel error-text">{error}</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel wide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Executive overview</p>
            <h3>Hospital command overview</h3>
          </div>
        </div>
        <div className="hero-banner">
          <div>
            <span className="hero-banner-tag">Luxury care operations</span>
            <h4>One premium workspace for patient movement, event clarity, and high-trust clinical action.</h4>
            <p>
              Track live occupancy, identify priority watchlists, and move directly into patient history without losing the narrative of care.
            </p>
          </div>
          <div className="hero-banner-stack">
            <span>Dual-theme premium shell</span>
            <span>Audit-aware clinical activity</span>
            <span>Patient-linked executive timelines</span>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card gradient-a">
            <span>Total patients</span>
            <strong>{summary.totalPatients}</strong>
          </div>
          <div className="stat-card gradient-b">
            <span>Active rooms</span>
            <strong>{summary.activeRooms}</strong>
          </div>
          <div className="stat-card gradient-c">
            <span>Heightened watch</span>
            <strong>{summary.criticalWatch}</strong>
          </div>
          <div className="stat-card gradient-d">
            <span>Recent belt events</span>
            <strong>{summary.recentAlerts}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Patients</p>
            <h3>Active patient suite</h3>
          </div>
        </div>
        <div className="list-stack">
          {patients.map((patient) => (
            <Link key={patient.id} className="list-row" to={`/patients/${patient.id}`}>
              <div>
                <strong>{patient.name}</strong>
                <p>{patient.diagnosis}</p>
              </div>
              <div className="row-meta">
                <span>{patient.room} / {patient.bed}</span>
                <small>{patient.status || 'stable'}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live activity</p>
            <h3>Recent clinical and belt signals</h3>
          </div>
        </div>
        <div className="list-stack">
          {events.length === 0 ? <p className="muted-copy">No belt events recorded yet.</p> : null}
          {events.map((event, index) => (
            <div key={`${event.id || index}-${event.timestamp}`} className="list-row static event-row">
              <div>
                <strong>{event.name || event.patient?.name || `Patient ${event.patientId}`}</strong>
                <p>Belt {event.belt_id || event.beltId} • {event.event_type || event.eventType || 'detected'}</p>
              </div>
              <div className="row-meta">
                <span>{formatTime(event.timestamp)}</span>
                <Link className="text-link" to={`/patients/${event.patient_id || event.patientId || 1}`}>Open history</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
