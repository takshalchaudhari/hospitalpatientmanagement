const express = require('express');
const { get, run } = require('../db');
const config = require('../config');
const { auditLog } = require('../lib/audit');

function createDeviceRouter(io) {
  const router = express.Router();

  router.post('/belt-events', async (req, res) => {
    const key = req.headers['x-device-key'];
    if (key !== config.deviceApiKey) {
      return res.status(401).json({ message: 'Invalid device credentials' });
    }

    const { patientId, beltId, timestamp, eventType } = req.body || {};
    if (!patientId || !beltId || !timestamp) {
      return res.status(400).json({ message: 'patientId, beltId, and timestamp are required' });
    }

    const patient = await get('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const result = await run(
      `INSERT INTO belt_events (patient_id, belt_id, event_type, timestamp, source)
       VALUES (?, ?, ?, ?, 'device')`,
      [patientId, beltId, eventType || 'detected', timestamp]
    );

    const payload = {
      id: result.lastID,
      patientId: Number(patientId),
      beltId,
      timestamp,
      eventType: eventType || 'detected',
      patient
    };

    io.emit('patient_detected', payload);
    await auditLog({
      action: 'device.belt_event',
      targetType: 'patient',
      targetId: String(patientId),
      details: { beltId, eventType: payload.eventType },
      ipAddress: req.ip
    });
    return res.status(201).json({ event: payload });
  });

  return router;
}

module.exports = {
  createDeviceRouter
};
