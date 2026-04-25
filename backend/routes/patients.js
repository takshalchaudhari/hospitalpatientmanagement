const express = require('express');
const { all, get, run } = require('../db');
const { authMiddleware, requireCsrf, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');
const { badRequest } = require('../lib/validation');

const router = express.Router();

router.use(authMiddleware);

router.get('/support-data', requirePermission('patients:read'), async (req, res) => {
  const doctors = await all(
    `SELECT id, username, full_name
     FROM users
     WHERE role = 'doctor' AND status = 'active'
     ORDER BY full_name ASC, username ASC`
  );
  const wards = await all(
    `SELECT DISTINCT room
     FROM patients
     WHERE archived_at IS NULL
     ORDER BY room ASC`
  );
  return res.json({ doctors, wards: wards.map((row) => row.room).filter(Boolean) });
});

router.get('/', requirePermission('patients:read'), async (req, res) => {
  const includeArchived = String(req.query.includeArchived || '') === '1';
  const patients = await all(
    `SELECT p.*, u.full_name AS assigned_doctor_name
     FROM patients p
     LEFT JOIN users u ON u.id = p.assigned_doctor_id
     ${includeArchived ? '' : 'WHERE p.archived_at IS NULL'}
     ORDER BY p.updated_at DESC, p.created_at DESC`
  );
  return res.json({ patients });
});

router.get('/recent-activity', requirePermission('patients:read'), async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const events = await all(
    `SELECT be.id, be.patient_id, be.belt_id, be.event_type, be.timestamp, be.source,
            p.name, p.room, p.bed, p.diagnosis
     FROM belt_events be
     JOIN patients p ON p.id = be.patient_id
     ORDER BY be.timestamp DESC
     LIMIT ?`,
    [limit]
  );
  return res.json({ events });
});

router.get('/:id', requirePermission('patients:read'), async (req, res) => {
  const patientId = Number.parseInt(req.params.id, 10);
  const patient = await get(
    `SELECT p.*, u.full_name AS assigned_doctor_name
     FROM patients p
     LEFT JOIN users u ON u.id = p.assigned_doctor_id
     WHERE p.id = ?`,
    [patientId]
  );
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }
  const notes = await all(
    `SELECT pn.id, pn.note_text, pn.note_type, pn.created_at, u.full_name AS author_name, u.role AS author_role
     FROM patient_notes pn
     JOIN users u ON u.id = pn.author_user_id
     WHERE pn.patient_id = ?
     ORDER BY pn.created_at DESC`,
    [patientId]
  );
  const events = await all(
    `SELECT id, belt_id, event_type, timestamp, source
     FROM belt_events
     WHERE patient_id = ?
     ORDER BY timestamp DESC
     LIMIT 20`,
    [patientId]
  );
  return res.json({ patient, notes, events });
});

router.post('/', requireCsrf, requirePermission('patients:write'), async (req, res) => {
  try {
    const payload = req.body || {};
    const required = ['name', 'age', 'gender', 'diagnosis', 'room', 'bed'];
    for (const key of required) {
      if (!payload[key] && payload[key] !== 0) {
        throw badRequest(`${key} is required`);
      }
    }

    const age = Number.parseInt(payload.age, 10);
    if (!Number.isFinite(age) || age < 0 || age > 130) {
      throw badRequest('Age must be a valid number between 0 and 130');
    }

    const result = await run(
      `INSERT INTO patients (name, age, gender, diagnosis, room, bed, photo_url, status, assigned_doctor_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        String(payload.name).trim(),
        age,
        String(payload.gender).trim(),
        String(payload.diagnosis).trim(),
        String(payload.room).trim(),
        String(payload.bed).trim(),
        payload.photoUrl ? String(payload.photoUrl).trim() : null,
        payload.status ? String(payload.status).trim() : 'stable',
        payload.assignedDoctorId || null
      ]
    );
    const patient = await get('SELECT * FROM patients WHERE id = ?', [result.lastID]);
    await auditLog({
      actorUserId: req.user.id,
      action: 'patients.create',
      targetType: 'patient',
      targetId: String(result.lastID),
      details: { name: patient.name },
      ipAddress: req.ip
    });
    return res.status(201).json({ patient });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Unable to create patient' });
  }
});

router.patch('/:id', requireCsrf, requirePermission('patients:write'), async (req, res) => {
  try {
    const patientId = Number.parseInt(req.params.id, 10);
    const existing = await get('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!existing) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const age = req.body?.age !== undefined
      ? Number.parseInt(req.body.age, 10)
      : existing.age;
    if (!Number.isFinite(age) || age < 0 || age > 130) {
      throw badRequest('Age must be a valid number between 0 and 130');
    }

    await run(
      `UPDATE patients
       SET name = ?, age = ?, gender = ?, diagnosis = ?, room = ?, bed = ?, photo_url = ?, status = ?, assigned_doctor_id = ?, archived_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        req.body?.name !== undefined ? String(req.body.name).trim() : existing.name,
        age,
        req.body?.gender !== undefined ? String(req.body.gender).trim() : existing.gender,
        req.body?.diagnosis !== undefined ? String(req.body.diagnosis).trim() : existing.diagnosis,
        req.body?.room !== undefined ? String(req.body.room).trim() : existing.room,
        req.body?.bed !== undefined ? String(req.body.bed).trim() : existing.bed,
        req.body?.photoUrl !== undefined ? (req.body.photoUrl ? String(req.body.photoUrl).trim() : null) : existing.photo_url,
        req.body?.status !== undefined ? String(req.body.status).trim() : existing.status,
        req.body?.assignedDoctorId !== undefined ? (req.body.assignedDoctorId || null) : existing.assigned_doctor_id,
        req.body?.archivedAt !== undefined ? req.body.archivedAt : existing.archived_at,
        patientId
      ]
    );
    const patient = await get(
      `SELECT p.*, u.full_name AS assigned_doctor_name
       FROM patients p
       LEFT JOIN users u ON u.id = p.assigned_doctor_id
       WHERE p.id = ?`,
      [patientId]
    );
    await auditLog({
      actorUserId: req.user.id,
      action: 'patients.update',
      targetType: 'patient',
      targetId: String(patientId),
      details: { status: patient.status, room: patient.room, bed: patient.bed },
      ipAddress: req.ip
    });
    return res.json({ patient });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Unable to update patient' });
  }
});

router.delete('/:id', requireCsrf, requirePermission('patients:write'), async (req, res) => {
  const patientId = Number.parseInt(req.params.id, 10);
  const existing = await get('SELECT * FROM patients WHERE id = ?', [patientId]);
  if (!existing) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  await run(
    `UPDATE patients
     SET archived_at = CURRENT_TIMESTAMP, status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [patientId]
  );
  await auditLog({
    actorUserId: req.user.id,
    action: 'patients.archive',
    targetType: 'patient',
    targetId: String(patientId),
    details: { name: existing.name },
    ipAddress: req.ip
  });
  return res.json({ message: 'Patient archived' });
});

router.post('/:id/restore', requireCsrf, requirePermission('patients:write'), async (req, res) => {
  const patientId = Number.parseInt(req.params.id, 10);
  const existing = await get('SELECT * FROM patients WHERE id = ?', [patientId]);
  if (!existing) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  await run(
    `UPDATE patients
     SET archived_at = NULL,
         status = CASE WHEN status = 'archived' THEN 'stable' ELSE status END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [patientId]
  );
  await auditLog({
    actorUserId: req.user.id,
    action: 'patients.restore',
    targetType: 'patient',
    targetId: String(patientId),
    details: { name: existing.name },
    ipAddress: req.ip
  });
  const patient = await get(
    `SELECT p.*, u.full_name AS assigned_doctor_name
     FROM patients p
     LEFT JOIN users u ON u.id = p.assigned_doctor_id
     WHERE p.id = ?`,
    [patientId]
  );
  return res.json({ patient });
});

router.post('/:id/notes', requireCsrf, requirePermission('notes:write'), async (req, res) => {
  const patientId = Number.parseInt(req.params.id, 10);
  if (!req.body?.noteText) {
    return res.status(400).json({ message: 'noteText is required' });
  }
  const result = await run(
    'INSERT INTO patient_notes (patient_id, author_user_id, note_text, note_type) VALUES (?, ?, ?, ?)',
    [patientId, req.user.id, String(req.body.noteText).trim(), req.body.noteType || 'clinical']
  );
  const note = await get(
    `SELECT pn.id, pn.note_text, pn.note_type, pn.created_at, u.full_name AS author_name, u.role AS author_role
     FROM patient_notes pn
     JOIN users u ON u.id = pn.author_user_id
     WHERE pn.id = ?`,
    [result.lastID]
  );
  await auditLog({
    actorUserId: req.user.id,
    action: 'patients.add_note',
    targetType: 'patient',
    targetId: String(patientId),
    details: { noteType: note.note_type },
    ipAddress: req.ip
  });
  return res.status(201).json({ note });
});

module.exports = router;
