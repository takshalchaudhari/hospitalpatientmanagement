const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const config = require('./config');

const DB_PATH = config.dbPath || path.join(__dirname, 'hospital.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function transaction(work) {
  await run('BEGIN');
  try {
    const result = await work();
    await run('COMMIT');
    return result;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

async function seedPatientsIfNeeded() {
  const row = await get('SELECT COUNT(*) AS count FROM patients');
  if (row.count > 0) {
    return;
  }

  const patients = [
    ['Aarav Sharma', 45, 'Male', 'Post-op Cardiac Monitoring', 'ICU-1', 'Bed 3', 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=640&h=640&fit=crop'],
    ['Sara Khan', 32, 'Female', 'High-Risk Pregnancy', 'Ward-2', 'Bed 7', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=640&h=640&fit=crop'],
    ['Rohan Verma', 60, 'Male', 'COPD Exacerbation', 'ICU-2', 'Bed 1', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=640&h=640&fit=crop']
  ];

  for (const patient of patients) {
    await run(
      `INSERT INTO patients (name, age, gender, diagnosis, room, bed, photo_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'stable')`,
      patient
    );
  }
}

async function resetUsersForProductionization() {
  const users = await all('SELECT id, username, role FROM users ORDER BY id ASC');
  const hasModernAdmin = users.some((user) => user.role === 'admin' && user.username === config.bootstrapAdmin.username);

  if (users.length === 0 || hasModernAdmin) {
    return;
  }

  await run('DELETE FROM refresh_sessions');
  await run('DELETE FROM users');
}

async function ensureBootstrapAdmin() {
  const existingAdmin = await get('SELECT id FROM users WHERE username = ?', [config.bootstrapAdmin.username]);
  if (existingAdmin) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.bootstrapAdmin.password, config.bcryptRounds);
  await run(
    `INSERT INTO users
      (username, full_name, email, password_hash, role, status, must_change_password, created_by)
     VALUES (?, ?, ?, ?, 'admin', 'active', 0, NULL)`,
    [
      config.bootstrapAdmin.username,
      config.bootstrapAdmin.fullName,
      config.bootstrapAdmin.email,
      passwordHash
    ]
  );
}

async function ensureDefaultSettings() {
  const defaults = {
    hospitalName: config.hospitalName,
    logoUrl: '',
    timezone: 'Asia/Calcutta',
    sessionTimeoutMinutes: config.accessTokenTtlMinutes,
    auditRetentionDays: 90,
    beltGatewayMode: 'device_key'
  };

  for (const [key, value] of Object.entries(defaults)) {
    await run(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON CONFLICT(setting_key) DO NOTHING`,
      [key, JSON.stringify(value)]
    );
  }
}

async function ensureColumn(tableName, columnName, definition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function upgradeLegacySchema() {
  await ensureColumn('users', 'full_name', "TEXT NOT NULL DEFAULT 'Unknown User'");
  await ensureColumn('users', 'email', 'TEXT');
  await ensureColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'");
  await ensureColumn('users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('users', 'failed_login_attempts', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('users', 'locked_until', 'DATETIME');
  await ensureColumn('users', 'last_login_at', 'DATETIME');
  await ensureColumn('users', 'password_changed_at', 'DATETIME');
  await ensureColumn('users', 'created_by', 'INTEGER');
  await ensureColumn('users', 'updated_at', 'DATETIME');

  await ensureColumn('patients', 'status', "TEXT NOT NULL DEFAULT 'stable'");
  await ensureColumn('patients', 'assigned_doctor_id', 'INTEGER');
  await ensureColumn('patients', 'created_at', 'DATETIME');
  await ensureColumn('patients', 'updated_at', 'DATETIME');

  await ensureColumn('belt_events', 'event_type', "TEXT NOT NULL DEFAULT 'detected'");
  await ensureColumn('belt_events', 'source', "TEXT NOT NULL DEFAULT 'device'");
  await ensureColumn('belt_events', 'created_at', 'DATETIME');

  await run("UPDATE users SET password_changed_at = COALESCE(password_changed_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP), full_name = CASE WHEN full_name = 'Unknown User' THEN username ELSE full_name END");
  await run("UPDATE patients SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)");
  await run("UPDATE belt_events SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)");
}

async function initDb() {
  await run('PRAGMA foreign_keys = ON');

  await run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const migrations = [
    {
      name: '001_core_schema',
      up: async () => {
        await run(
          `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            must_change_password INTEGER NOT NULL DEFAULT 0,
            failed_login_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until DATETIME,
            last_login_at DATETIME,
            password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        );

        await run(
          `CREATE TABLE IF NOT EXISTS refresh_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            csrf_token TEXT NOT NULL,
            user_agent TEXT,
            ip_address TEXT,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          )`
        );

        await run(
          `CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            room TEXT NOT NULL,
            bed TEXT NOT NULL,
            photo_url TEXT,
            status TEXT NOT NULL DEFAULT 'stable',
            assigned_doctor_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(assigned_doctor_id) REFERENCES users(id)
          )`
        );

        await run(
          `CREATE TABLE IF NOT EXISTS patient_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            author_user_id INTEGER NOT NULL,
            note_text TEXT NOT NULL,
            note_type TEXT NOT NULL DEFAULT 'clinical',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
            FOREIGN KEY(author_user_id) REFERENCES users(id)
          )`
        );

        await run(
          `CREATE TABLE IF NOT EXISTS belt_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            belt_id TEXT NOT NULL,
            event_type TEXT NOT NULL DEFAULT 'detected',
            timestamp DATETIME NOT NULL,
            source TEXT NOT NULL DEFAULT 'device',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(id)
          )`
        );

        await run(
          `CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id INTEGER,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            details_json TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(actor_user_id) REFERENCES users(id)
          )`
        );

        await run(
          `CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`
        );
      }
    }
  ];

  for (const migration of migrations) {
    const applied = await get('SELECT id FROM schema_migrations WHERE name = ?', [migration.name]);
    if (!applied) {
      await transaction(async () => {
        await migration.up();
        await run('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
      });
    }
  }

  await upgradeLegacySchema();
  await resetUsersForProductionization();
  await ensureBootstrapAdmin();
  await ensureDefaultSettings();
  await seedPatientsIfNeeded();
}

module.exports = {
  db,
  run,
  get,
  all,
  transaction,
  initDb
};
