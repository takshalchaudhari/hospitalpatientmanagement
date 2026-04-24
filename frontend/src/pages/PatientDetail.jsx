import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { PatientAPI } from '../services/api';

function eventLabel(item) {
  if (item.kind === 'note') {
    return item.note_type === 'clinical' ? 'Clinical note' : 'Staff handoff';
  }
  return item.event_type || 'Belt event';
}

export default function PatientDetail() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');

  async function loadDetail() {
    try {
      const res = await PatientAPI.getPatient(patientId);
      setDetail(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load patient');
    }
  }

  useEffect(() => {
    loadDetail();
  }, [patientId]);

  async function saveNote(event) {
    event.preventDefault();
    try {
      await PatientAPI.addNote(patientId, noteText, user.role === 'doctor' ? 'clinical' : 'handoff');
      setNoteText('');
      await loadDetail();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save note');
    }
  }

  if (error) {
    return <div className="panel error-text">{error}</div>;
  }

  if (!detail) {
    return <div className="panel">Loading patient record...</div>;
  }

  const { patient, notes, events } = detail;
  const history = [
    ...notes.map((note) => ({ ...note, kind: 'note', sortTime: note.created_at })),
    ...events.map((item) => ({ ...item, kind: 'event', sortTime: item.timestamp }))
  ].sort((left, right) => new Date(right.sortTime) - new Date(left.sortTime));

  return (
    <div className="page-grid">
      <section className="panel wide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Patient profile</p>
            <h3>{patient.name}</h3>
          </div>
          <span className="status-pill neutral">{patient.status}</span>
        </div>
        <div className="detail-grid">
          <div className="detail-box"><span>Diagnosis</span><strong>{patient.diagnosis}</strong></div>
          <div className="detail-box"><span>Location</span><strong>{patient.room} / {patient.bed}</strong></div>
          <div className="detail-box"><span>Age</span><strong>{patient.age}</strong></div>
          <div className="detail-box"><span>Gender</span><strong>{patient.gender}</strong></div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Clinical notes</p>
            <h3>Care annotations</h3>
          </div>
        </div>
        {user.role !== 'staff' ? (
          <form className="inline-form" onSubmit={saveNote}>
            <textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Add a clinical note or escalation handoff"
              required
            />
            <button className="primary-btn" type="submit">Save note</button>
          </form>
        ) : (
          <p className="muted-copy">Staff can review notes but cannot create clinical annotations.</p>
        )}
        <div className="list-stack">
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
            <h3>Unified care timeline</h3>
          </div>
        </div>
        <div className="timeline">
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
  );
}
