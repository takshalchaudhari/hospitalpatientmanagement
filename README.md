# SHMF

> Sentinel Health Monitoring Framework  
> A secure, role-based hospital monitoring workspace for patient visibility, event history, and operational control.

## Overview

SHMF is a full-stack hospital dashboard focused on secure clinical access, patient event monitoring, and cleaner patient history review. It combines:

- Cookie-based authentication with refresh sessions and CSRF protection
- Admin-controlled account lifecycle for `admin`, `doctor`, and `staff`
- Patient timelines that unify clinical notes and belt/device events
- Secure device ingestion for belt events
- Docker-friendly deployment structure for VPS hosting

## Why It Stands Out

- Premium hospital UI with a calmer visual system and more intentional hierarchy
- Unified patient history flow instead of fragmented notes and event views
- Administrative controls for users, settings, and audit review
- GitHub-ready project structure with deployment assets and environment templates

## Product Surfaces

### Secure Login
- Clean sign-in experience
- Hospital-grade access messaging
- Administrator-only account provisioning

### Clinical Overview
- High-level patient and room metrics
- Recent event feed
- Quick navigation into patient history

### Patient History
- Unified timeline of:
  - clinical notes
  - staff handoffs
  - belt/device events
- Faster review for real-world hospital workflows

### Admin Operations
- User lifecycle management
- System settings
- Audit trail visibility

## Tech Stack

### Frontend
- React
- React Router
- Axios
- Socket.IO client
- Vite

### Backend
- Node.js
- Express
- SQLite
- Socket.IO
- Helmet
- Rate limiting
- Cookie-based session flow

## Project Structure

```text
PGS/
├─ backend/
│  ├─ routes/
│  ├─ middleware/
│  ├─ lib/
│  ├─ tests/
│  └─ server.js
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ pages/
│  │  └─ services/
│  └─ vite.config.mjs
├─ docker-compose.yml
└─ README.md
```

## Local Setup

### 1. Backend

```bash
cd backend
npm install
npm start
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the app

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4000`

## Environment

Use:

- `backend/.env.example`
- `frontend/.env.example`

Important backend values include:

- bootstrap admin credentials
- access and refresh token secrets
- device API key
- rate-limit values
- session timing

## Docker / VPS Deployment

Build and run the stack:

```bash
docker compose up --build
```

Included assets:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.yml`

## Role Model

- `admin`
  - manage users
  - review audits
  - edit system settings
  - access all patient workflows

- `doctor`
  - review patient records
  - write clinical notes
  - work inside patient timelines

- `staff`
  - access patient workflows
  - support operational updates
  - review patient history with narrower permissions

## Secure Device Ingestion

Device events are sent through a dedicated authenticated route instead of reusing human login flows.

Relevant files:

- `backend/routes/device.js`
- `backend/bluetooth_gateway.py`
- `backend/belt-simulator.js`

## Verification

Frontend:

```bash
cd frontend
npm run build
```

Backend tests:

```bash
cd backend
npm test
```

## Roadmap Ideas

- richer patient assignment workflows
- patient status filtering and search refinement
- email-based password reset
- production Postgres migration path
- expanded reporting and analytics exports

## Design Note

This repository now aims for a more polished, hospital-appropriate product direction: secure, readable, and visually elevated without becoming noisy or gimmicky.
