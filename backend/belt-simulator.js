require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4000';
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'device-demo-key-change-me';

async function fetchPatients() {
  const login = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@123456'
  }, { withCredentials: true });

  const cookie = login.headers['set-cookie']?.map((entry) => entry.split(';')[0]).join('; ');
  const res = await axios.get(`${BASE_URL}/api/patients`, {
    headers: {
      Cookie: cookie
    },
    withCredentials: true
  });
  return res.data.patients;
}

async function sendRandomEvent(patients) {
  if (!patients.length) {
    console.log('No patients available to simulate belt event.');
    return;
  }

  const patient = patients[Math.floor(Math.random() * patients.length)];
  const payload = {
    patientId: patient.id,
    beltId: `BELT-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    eventType: 'detected'
  };

  const res = await axios.post(`${BASE_URL}/api/device/belt-events`, payload, {
    headers: {
      'x-device-key': DEVICE_API_KEY
    }
  });
  console.log('Simulated device event:', res.data.event);
}

async function main() {
  try {
    const patients = await fetchPatients();
    console.log(`Loaded ${patients.length} patients.`);
    console.log('Starting belt simulation every 8 seconds...');
    setInterval(() => {
      sendRandomEvent(patients).catch((error) => {
        console.error('Simulation error:', error.response?.data || error.message);
      });
    }, 8000);
  } catch (error) {
    console.error('Failed to start simulator:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
