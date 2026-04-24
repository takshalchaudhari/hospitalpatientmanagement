const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const config = require('./config');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const patientsRoutes = require('./routes/patients');
const profileRoutes = require('./routes/profile');
const { createDeviceRouter } = require('./routes/device');
const { verifyAccessToken } = require('./lib/security');

function getCookieValue(cookieHeader, cookieName) {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(';').map((entry) => entry.trim());
  const target = parts.find((entry) => entry.startsWith(`${cookieName}=`));
  return target ? decodeURIComponent(target.slice(cookieName.length + 1)) : null;
}

async function startServer() {
  await initDb();

  const app = express();
  const server = http.createServer(app);
  const buildId = `shmf-${new Date().toISOString()}`;

  const io = new Server(server, {
    cors: {
      origin: config.frontendOrigins,
      credentials: true
    }
  });

  app.use((req, res, next) => {
    console.info(JSON.stringify({
      level: 'info',
      method: req.method,
      path: req.path,
      ip: req.ip,
      time: new Date().toISOString()
    }));
    next();
  });

  app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...config.frontendOrigins, 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  }));

  app.use(cors({
    origin: config.frontendOrigins,
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json());

  app.use(rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  }));

  app.use((req, res, next) => {
    res.setHeader('X-SHMF-Build', buildId);
    next();
  });

  app.get('/', (req, res) => {
    res.json({ message: 'SHMF backend running', build: buildId, hospital: config.hospitalName });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', build: buildId, now: new Date().toISOString() });
  });

  app.get('/ready', (req, res) => {
    res.json({ status: 'ready' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/patients', patientsRoutes);
  app.use('/api/device', createDeviceRouter(io));

  app.use((err, req, res, next) => {
    console.error('Unhandled error', err);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Internal server error'
    });
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.split(' ')[1]
        || getCookieValue(socket.handshake.headers?.cookie, config.cookieNameAccess);
      if (!token) {
        return next(new Error('Authentication token missing'));
      }
      const payload = verifyAccessToken(token);
      socket.user = {
        id: Number(payload.sub),
        username: payload.username,
        role: payload.role
      };
      return next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('connection_status', { status: 'connected', user: socket.user });
  });

  server.listen(config.port, () => {
    console.log(`SHMF backend listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
