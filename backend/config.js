require('dotenv').config();

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL;
const frontendOrigins = frontendUrl
  ? frontendUrl.split(',').map((value) => value.trim()).filter(Boolean)
  : ['http://127.0.0.1:5173', 'http://localhost:5173'];

module.exports = {
  isProduction,
  port: toNumber(process.env.PORT, 4000),
  frontendOrigins,
  dbPath: process.env.DB_PATH,
  hospitalName: process.env.HOSPITAL_NAME || 'Sentinel Health Monitoring Framework',
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-me',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me',
  deviceApiKey: process.env.DEVICE_API_KEY || 'device-demo-key-change-me',
  bootstrapAdmin: {
    username: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@123456',
    fullName: process.env.BOOTSTRAP_ADMIN_FULL_NAME || 'System Administrator',
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@shmf.local'
  },
  accessTokenTtlMinutes: toNumber(process.env.ACCESS_TOKEN_TTL_MINUTES, 15),
  refreshTokenTtlDays: toNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  authLockWindowMinutes: toNumber(process.env.AUTH_LOCK_WINDOW_MINUTES, 15),
  authMaxAttempts: toNumber(process.env.AUTH_MAX_ATTEMPTS, 5),
  bcryptRounds: toNumber(process.env.BCRYPT_ROUNDS, 12),
  rateLimitWindowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: toNumber(process.env.RATE_LIMIT_MAX, 120),
  authRateLimitMax: toNumber(process.env.AUTH_RATE_LIMIT_MAX, 20),
  cookieNameAccess: 'shmf_access',
  cookieNameRefresh: 'shmf_refresh',
  cookieNameCsrf: 'shmf_csrf'
};
