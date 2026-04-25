import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { PatientAPI } from '../services/api';

function eventLabel(item) {
  if (item.kind === 'note') {
    return item.note_type === 'clinical' ? 'Clinical note' : 'Staff handoff';
  }
  return item.event_type || 'Belt event';
}

function buildEditForm(patient) {
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

export default function PatientDetail() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const canManagePatients = ['admin', 'doctor', 'staff'].includes(user?.role);
  const canWriteNotes = ['admin', 'doctor'].includes(user?.role);

  async function loadDetail() {
    try {
      const requests = [PatientAPI.getPatient(patientId)];
      if (canManagePatients) {
        requests.push(PatientAPI.getSupportData());
      }
      const [detailRes, supportRes] = await Promise.all(requests);
      setDetail(detailRes.data);
      setDoctors(supportRes?.data?.doctors || []);
      setEditForm(buildEditForm(detailRes.data.patient));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load patient');
    }
  }

  useEffect(() => {
    loadDetail();
  }, [patientId]);

  async function saveNote(event) {
    event.preventDefault();
    setSavingNote(true);
    setFeedback('');
    setError('');
    try {
      await PatientAPI.addNote(patientId, noteText, user.role === 'doctor' ? 'clinical' : 'handoff');
      setNoteText('');
      setFeedback('Patient note saved.');
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save note');
    } finally {
      setSavingNote(false);
    }
  }

  async function savePatientProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setFeedback('');
    setError('');
    try {
      await PatientAPI.updatePatient(patientId, {
        ...editForm,
        assignedDoctorId: editForm.assignedDoctorId || null,
        photoUrl: editForm.photoUrl || null
      });
      setFeedback('Patient profile updated.');
      setEditing(false);
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update patient');
    } finally {
      setSavingProfile(false);
    }
  }

  async function quickStatus(nextStatus) {
    setFeedback('');
    setError('');
    try {
      await PatientAPI.updatePatient(patientId, { status: nextStatus });
      setFeedback(`Patient moved to ${nextStatus}.`);
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update patient status');
    }
  }

  async function archivePatient() {
    setFeedback('');
    setError('');
    try {
      await PatientAPI.archivePatient(patientId);
      setFeedback('Patient archived.');
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to archive patient');
    }
  }

  async function restorePatient() {
    setFeedback('');
    setError('');
    try {
      await PatientAPI.restorePatient(patientId);
      setFeedback('Patient restored.');
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to restore patient');
    }
  }

  const history = useMemo(() => {
    if (!detail) return [];
    return [
      ...detail.notes.map((note) => ({ ...note, kind: 'note', sortTime: note.created_at })),
      ...detail.events.map((item) => ({ ...item, kind: 'event', sortTime: item.timestamp }))
    ].sort((left, right) => new Date(right.sortTime) - new Date(left.sortTime));
  }, [detail]);

  if (error && !detail) {
    return <div className="panel error-text">{error}</div>;
  }

  if (!detail || !editForm) {
    return (
      <div className="page-state">
        <div className="spinner" />
        <p>Loading patient record...</p>
      </div>
    );
  }

  const { patient, notes } = detail;

  return (
    <div className="dashboard-stack">
      <section className="panel wide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Patient control</p>
            <h3>{patient.name}</h3>
          </div>
          <div className="row-actions">
            <span className="status-pill neutral">{patient.status}</span>
            {canManagePatients ? (
              <>
                <button className="secondary-btn" type="button" onClick={() => setEditing((current) => !current)}>
                  {editing ? 'Close editor' : 'Edit patient'}
                </button>
                {patient.status !== 'critical' ? (
                  <button className="secondary-btn" type="button" onClick={() => quickStatus('critical')}>
                    Mark critical
                  </button>
                ) : null}
                {patient.status !== 'stable' ? (
                  <button className="secondary-btn" type="button" onClick={() => quickStatus('stable')}>
                    Mark stable
                  </button>
                ) : null}
                {patient.status !== 'discharged' ? (
                  <button className="secondary-btn" type="button" onClick={() => quickStatus('discharged')}>
                    Discharge
                  </button>
                ) : null}
                {patient.archived_at ? (
                  <button className="secondary-btn" type="button" onClick={restorePatient}>
                    Restore
                  </button>
                ) : (
                  <button className="secondary-btn danger-btn" type="button" onClick={archivePatient}>
                    Archive
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>

        {feedback ? <div className="alert success">{feedback}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <div className="detail-grid">
          <div className="detail-box"><span>Diagnosis</span><strong>{patient.diagnosis}</strong></div>
          <div className="detail-box"><span>Location</span><strong>{patient.room} / {patient.bed}</strong></div>
          <div className="detail-box"><span>Age</span><strong>{patient.age}</strong></div>
          <div className="detail-box"><span>Gender</span><strong>{patient.gender}</strong></div>
          <div className="detail-box"><span>Assigned doctor</span><strong>{patient.assigned_doctor_name || 'Unassigned'}</strong></div>
          <div className="detail-box"><span>Last updated</span><strong>{new Date(patient.updated_at).toLocaleString()}</strong></div>
          <div className="detail-box"><span>Record state</span><strong>{patient.archived_at ? 'Archived' : 'Active'}</strong></div>
        </div>
      </section>

      {editing && canManagePatients ? (
        <section className="panel wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Patient profile</p>
              <h3>Edit patient record</h3>
            </div>
          </div>
          <form className="patient-edit-grid" onSubmit={savePatientProfile}>
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Patient name"
              required
            />
            <input
              type="number"
              value={editForm.age}
              onChange={(event) => setEditForm((current) => ({ ...current, age: event.target.value }))}
              placeholder="Age"
              required
            />
            <select
              value={editForm.gender}
              onChange={(event) => setEditForm((current) => ({ ...current, gender: event.target.value }))}
              required
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <input
              value={editForm.diagnosis}
              onChange={(event) => setEditForm((current) => ({ ...current, diagnosis: event.target.value }))}
              placeholder="Diagnosis"
              required
            />
            <input
              value={editForm.room}
              onChange={(event) => setEditForm((current) => ({ ...current, room: event.target.value }))}
              placeholder="Room"
              required
            />
            <input
              value={editForm.bed}
              onChange={(event) => setEditForm((current) => ({ ...current, bed: event.target.value }))}
              placeholder="Bed"
              required
            />
            <input
              value={editForm.photoUrl}
              onChange={(event) => setEditForm((current) => ({ ...current, photoUrl: event.target.value }))}
              placeholder="Photo URL"
            />
            <select
              value={editForm.status}
              onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="stable">Stable</option>
              <option value="observation">Observation</option>
              <option value="critical">Critical</option>
              <option value="discharged">Discharged</option>
            </select>
            <select
              value={editForm.assignedDoctorId}
              onChange={(event) => setEditForm((current) => ({ ...current, assignedDoctorId: event.target.value }))}
            >
              <option value="">No doctor assigned</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name || doctor.username}
                </option>
              ))}
            </select>
            <div className="drawer-actions patient-edit-actions">
              <button className="secondary-btn" type="button" onClick={() => {
                setEditing(false);
                setEditForm(buildEditForm(patient));
              }}>
                Cancel
              </button>
              <button className="primary-btn" type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Clinical notes</p>
              <h3>Care notes</h3>
            </div>
          </div>
          {canWriteNotes ? (
            <form className="inline-form" onSubmit={saveNote}>
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Add a clinical note or escalation handoff"
                required
              />
              <button className="primary-btn" type="submit" disabled={savingNote}>
                {savingNote ? 'Saving...' : 'Save note'}
              </button>
            </form>
          ) : (
            <p className="muted-copy">Staff can review notes here. Doctors and admins can add clinical notes.</p>
          )}
          <div className="list-stack">
            {notes.length === 0 ? (
              <div className="empty-state">
                <strong>No notes yet</strong>
                <p>Clinical annotations and handoffs will appear here.</p>
              </div>
            ) : null}
            {notes.map((note) => (
              <div key={note.id} className="list-row static">
                <div>
                  <strong>{note.author_name}</strong>
                  <p>{note.note_text}</p>
                </div>
                <span>{new Date(note.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Patient history</p>
              <h3>Unified timeline</h3>
            </div>
          </div>
          <div className="timeline">
            {history.length === 0 ? (
              <div className="empty-state">
                <strong>No history yet</strong>
                <p>Notes and belt activity will build the patient story here.</p>
              </div>
            ) : null}
            {history.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="timeline-item">
                <span className={`timeline-marker ${item.kind === 'note' ? 'clinical' : 'device'}`} />
                <div className="timeline-card">
                  <div className="timeline-topline">
                    <strong>{eventLabel(item)}</strong>
                    <span>{new Date(item.sortTime).toLocaleString()}</span>
                  </div>
                  {item.kind === 'note' ? (
                    <>
                      <p>{item.note_text}</p>
                      <small>{item.author_name} • {item.author_role}</small>
                    </>
                  ) : (
                    <>
                      <p>{item.belt_id} • {item.source}</p>
                      <small>{item.event_type}</small>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
