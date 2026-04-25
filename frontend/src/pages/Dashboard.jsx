import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import { PatientAPI } from '../services/api';
import { getSocket } from '../services/socket';

const initialPatientForm = {
  name: '',
  age: '',
  gender: '',
  diagnosis: '',
  room: '',
  bed: '',
  photoUrl: '',
  status: 'stable',
  assignedDoctorId: ''
};

function formatTime(timestamp) {
  if (!timestamp) return 'Just now';
  return new Date(timestamp).toLocaleString();
}

function matchesStatus(patientStatus, filter) {
  if (filter === 'all') {
    return true;
  }
  return String(patientStatus || 'stable').toLowerCase() === filter;
}

function buildPatientForm(patient) {
  if (!patient) {
    return initialPatientForm;
  }

  return {
    name: patient.name || '',
    age: patient.age ?? '',
    gender: patient.gender || '',
    diagnosis: patient.diagnosis || '',
    room: patient.room || '',
    bed: patient.bed || '',
    photoUrl: patient.photo_url || '',
    status: patient.status || 'stable',
    assignedDoctorId: patient.assigned_doctor_id ? String(patient.assigned_doctor_id) : ''
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [events, setEvents] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [patientForm, setPatientForm] = useState(initialPatientForm);
  const canManagePatients = ['admin', 'doctor', 'staff'].includes(user?.role);

  async function loadDashboard() {
    try {
      const requests = [
        PatientAPI.getPatients({ includeArchived: includeArchived ? 1 : 0 }),
        PatientAPI.getRecentActivity(12)
      ];

      if (canManagePatients) {
        requests.push(PatientAPI.getSupportData());
      }

      const [patientRes, eventRes, supportRes] = await Promise.all(requests);
      setPatients(patientRes.data.patients);
      setEvents(eventRes.data.events);
      setDoctors(supportRes?.data?.doctors || []);
      setWards(supportRes?.data?.wards || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [includeArchived]);

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

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return patients.filter((patient) => {
      const searchable = [
        patient.name,
        patient.diagnosis,
        patient.room,
        patient.bed,
        patient.assigned_doctor_name || ''
      ].join(' ').toLowerCase();

      return matchesStatus(patient.status, statusFilter)
        && (wardFilter === 'all' || patient.room === wardFilter)
        && (
          doctorFilter === 'all'
          || (doctorFilter === 'mine' && Number(patient.assigned_doctor_id) === Number(user?.id))
          || String(patient.assigned_doctor_id || '') === doctorFilter
        )
        && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [patients, query, statusFilter, wardFilter, doctorFilter, user?.id]);

  function openCreateDrawer() {
    setEditingPatientId(null);
    setPatientForm(initialPatientForm);
    setFeedback('');
    setError('');
    setDrawerOpen(true);
  }

  function openEditDrawer(patient) {
    setEditingPatientId(patient.id);
    setPatientForm(buildPatientForm(patient));
    setFeedback('');
    setError('');
    setDrawerOpen(true);
  }

  async function handleSavePatient(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    const payload = {
      ...patientForm,
      assignedDoctorId: patientForm.assignedDoctorId || null,
      photoUrl: patientForm.photoUrl || null
    };

    try {
      if (editingPatientId) {
        await PatientAPI.updatePatient(editingPatientId, payload);
        setFeedback('Patient record updated successfully.');
      } else {
        await PatientAPI.createPatient(payload);
        setFeedback('Patient added successfully.');
      }
      setPatientForm(initialPatientForm);
      setEditingPatientId(null);
      setDrawerOpen(false);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save patient');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatus(patient, nextStatus) {
    try {
      setError('');
      setFeedback('');
      await PatientAPI.updatePatient(patient.id, { status: nextStatus });
      setFeedback(`${patient.name} moved to ${nextStatus}.`);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update patient status');
    }
  }

  async function handleArchivePatient(patient) {
    try {
      setError('');
      setFeedback('');
      await PatientAPI.archivePatient(patient.id);
      setFeedback(`${patient.name} archived successfully.`);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to archive patient');
    }
  }

  async function handleRestorePatient(patient) {
    try {
      setError('');
      setFeedback('');
      await PatientAPI.restorePatient(patient.id);
      setFeedback(`${patient.name} restored successfully.`);
      await loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to restore patient');
    }
  }

  if (loading) {
    return (
      <div className="dashboard-stack">
        <section className="panel">
          <div className="skeleton skeleton-title" />
          <div className="stats-grid stats-grid-compact">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="stat-card stat-card-skeleton">
                <div className="skeleton skeleton-line short" />
                <div className="skeleton skeleton-line large" />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="skeleton skeleton-title" />
          <div className="list-stack">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="list-row static">
                <div className="skeleton skeleton-line medium" />
                <div className="skeleton skeleton-line short" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (error && !patients.length && !events.length) {
    return <div className="panel error-text">{error}</div>;
  }

  return (
    <>
      <div className="dashboard-stack">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Hospital overview</p>
              <h3>Today&apos;s patient operations</h3>
            </div>
            {canManagePatients ? (
              <button className="primary-btn" type="button" onClick={openCreateDrawer}>
                Add Patient
              </button>
            ) : null}
          </div>
          {feedback ? <div className="alert success">{feedback}</div> : null}
          {error ? <div className="alert error">{error}</div> : null}

          <div className="stats-grid stats-grid-compact">
            <div className="stat-card">
              <span>Total patients</span>
              <strong>{summary.totalPatients}</strong>
            </div>
            <div className="stat-card">
              <span>Active rooms</span>
              <strong>{summary.activeRooms}</strong>
            </div>
            <div className="stat-card">
              <span>Heightened watch</span>
              <strong>{summary.criticalWatch}</strong>
            </div>
            <div className="stat-card">
              <span>Recent alerts</span>
              <strong>{summary.recentAlerts}</strong>
            </div>
          </div>
        </section>

        <div className="page-grid dashboard-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Patient control</p>
                <h3>Active patients</h3>
              </div>
              {canManagePatients ? (
                <button className="secondary-btn" type="button" onClick={openCreateDrawer}>
                  Add Patient
                </button>
              ) : null}
            </div>

            <div className="toolbar-row">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by patient, diagnosis, room, bed, or doctor"
              />
              <div className="control-grid">
                <select value={wardFilter} onChange={(event) => setWardFilter(event.target.value)}>
                  <option value="all">All wards</option>
                  {wards.map((ward) => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
                <select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
                  <option value="all">All doctors</option>
                  {user?.role === 'doctor' ? <option value="mine">My patients</option> : null}
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={String(doctor.id)}>
                      {doctor.full_name || doctor.username}
                    </option>
                  ))}
                </select>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(event) => setIncludeArchived(event.target.checked)}
                  />
                  <span>Show archived</span>
                </label>
              </div>
              <div className="filter-chips">
                {['all', 'stable', 'observation', 'critical', 'discharged', 'archived'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`filter-chip ${statusFilter === filter ? 'active' : ''}`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="list-stack">
              {filteredPatients.length === 0 ? (
                <div className="empty-state">
                  <strong>No matching patients</strong>
                  <p>Try a different search or filter, or add a new patient record.</p>
                </div>
              ) : null}
              {filteredPatients.map((patient) => (
                <div key={patient.id} className="list-row static patient-row-card">
                  <div>
                    <strong>{patient.name}</strong>
                    <p>{patient.diagnosis}</p>
                    <small className="muted-copy">
                      {patient.room} / {patient.bed}
                      {patient.assigned_doctor_name ? ` • Dr. ${patient.assigned_doctor_name}` : ' • No doctor assigned'}
                    </small>
                  </div>
                  <div className="row-meta patient-row-meta">
                    <span>{patient.status || 'stable'}</span>
                    <div className="row-actions patient-row-actions">
                      <Link className="text-link" to={`/patients/${patient.id}`}>Open</Link>
                      {canManagePatients ? (
                        <button className="text-action-btn" type="button" onClick={() => openEditDrawer(patient)}>
                          Edit
                        </button>
                      ) : null}
                      {canManagePatients && patient.status !== 'critical' ? (
                        <button className="text-action-btn" type="button" onClick={() => handleQuickStatus(patient, 'critical')}>
                          Mark critical
                        </button>
                      ) : null}
                      {canManagePatients && patient.status !== 'stable' ? (
                        <button className="text-action-btn" type="button" onClick={() => handleQuickStatus(patient, 'stable')}>
                          Mark stable
                        </button>
                      ) : null}
                      {canManagePatients && patient.archived_at ? (
                        <button className="text-action-btn" type="button" onClick={() => handleRestorePatient(patient)}>
                          Restore
                        </button>
                      ) : null}
                      {canManagePatients && !patient.archived_at ? (
                        <button className="text-action-btn danger" type="button" onClick={() => handleArchivePatient(patient)}>
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recent activity</p>
                <h3>Clinical and belt signals</h3>
              </div>
            </div>
            <div className="list-stack">
              {events.length === 0 ? (
                <div className="empty-state">
                  <strong>No recent events</strong>
                  <p>Belt detections and activity updates will appear here.</p>
                </div>
              ) : null}
              {events.map((event, index) => (
                <div key={`${event.id || index}-${event.timestamp}`} className="list-row static">
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
      </div>

      <div className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)}>
        <aside className={`drawer-panel ${drawerOpen ? 'open' : ''}`} onClick={(event) => event.stopPropagation()}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editingPatientId ? 'Patient update' : 'Patient intake'}</p>
              <h3>{editingPatientId ? 'Edit patient' : 'Add patient'}</h3>
            </div>
            <button className="drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close patient form">
              ×
            </button>
          </div>

          <form className="drawer-form" onSubmit={handleSavePatient}>
            <input
              value={patientForm.name}
              onChange={(event) => setPatientForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Patient name"
              required
            />
            <input
              type="number"
              value={patientForm.age}
              onChange={(event) => setPatientForm((current) => ({ ...current, age: event.target.value }))}
              placeholder="Age"
              required
            />
            <select
              value={patientForm.gender}
              onChange={(event) => setPatientForm((current) => ({ ...current, gender: event.target.value }))}
              required
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <input
              value={patientForm.diagnosis}
              onChange={(event) => setPatientForm((current) => ({ ...current, diagnosis: event.target.value }))}
              placeholder="Diagnosis"
              required
            />
            <div className="inline-form compact-inline-form">
              <input
                value={patientForm.room}
                onChange={(event) => setPatientForm((current) => ({ ...current, room: event.target.value }))}
                placeholder="Room"
                required
              />
              <input
                value={patientForm.bed}
                onChange={(event) => setPatientForm((current) => ({ ...current, bed: event.target.value }))}
                placeholder="Bed"
                required
              />
            </div>
            <input
              value={patientForm.photoUrl}
              onChange={(event) => setPatientForm((current) => ({ ...current, photoUrl: event.target.value }))}
              placeholder="Photo URL (optional)"
            />
            <select
              value={patientForm.status}
              onChange={(event) => setPatientForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="stable">Stable</option>
              <option value="observation">Observation</option>
              <option value="critical">Critical</option>
              <option value="discharged">Discharged</option>
            </select>
            <select
              value={patientForm.assignedDoctorId}
              onChange={(event) => setPatientForm((current) => ({ ...current, assignedDoctorId: event.target.value }))}
            >
              <option value="">No doctor assigned</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name || doctor.username}
                </option>
              ))}
            </select>

            <div className="drawer-actions">
              <button className="secondary-btn" type="button" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
              <button className="primary-btn" type="submit" disabled={saving}>
                {saving ? 'Saving...' : editingPatientId ? 'Update patient' : 'Save patient'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </>
  );
}
