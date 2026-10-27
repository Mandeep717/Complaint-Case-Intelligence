# PS 26264 — Complaint Case Intelligence

An internal dashboard prototype for institution complaint histories, cross-bureau candidate discovery, and human-reviewed case relationships. The records and example accounts are synthetic. The prototype is not connected to live AICTE systems.

## What is implemented

- React + TypeScript + Vite dashboard with complaint explorer, registration, detail/history, institution profiles, overlap review, complaint search, notifications, and reports.
- Express + TypeScript API with JWT authentication, bcrypt password hashes, Zod request validation, backend role checks, bureau scope checks, and a centralized error response.
- Persisted institutions, users, complaints, action history, case relationships, notifications, and complaint embeddings; uniqueness and query indexes are created at startup.
- Complaint creation saves the complaint and audit row before launching best-effort background overlap analysis.
- Validated status transitions, assignment changes, transfers, append-only case action history, overlap confirm/dismiss/defer, and deduplicated notifications.
- Live dashboard and report aggregates query stored records. Active overdue excludes disposed cases.
- Optional OpenAI-compatible embedding and chat endpoints. With an embedding endpoint, vectors are stored and cosine-ranked locally. Without one, complaint search explicitly reports `keyword_fallback`; this is not represented as semantic search.
- Human review is required for relationships. The LLM receives a bounded two-record evidence bundle, must return a constrained JSON shape, and cannot write case state.

## Architecture and implementation decision

The PDF proposes a modular monolith with React, Express, MongoDB Atlas/Vector Search, and backend-mediated embeddings and LLM comparison. This runnable prototype keeps the frontend/API/service boundaries but uses Node's built-in SQLite adapter as its local operational store. This environment has no MongoDB service or connection configured, and SQLite avoids presenting an unverified Atlas connection as working. Consequently, Atlas persistence and Atlas Vector Search are deferred; compatible embeddings are stored in SQLite and ranked with cosine similarity. A production/hackathon deployment that requires Atlas should replace the storage adapter and run the documented vector index setup before claiming Atlas functionality.

```text
web/                  React UI, API client, charts
server/src/index.ts   Express routes, auth/RBAC, complaint workflows, reports
server/src/db.ts      SQLite schema and indexes
server/src/ai.ts      Embedding, retrieval, evidence-bound LLM comparison
server/src/seed.ts    Synthetic demo records and users
```

## Requirements

- Node.js 22+ (uses the built-in `node:sqlite` module).
- npm 10+.
- No external database required for the local prototype.
- Optional: OpenAI-compatible embeddings endpoint and chat-completion endpoint (Ollama can serve compatible endpoints when configured).

## Setup and run

```powershell
Copy-Item .env.example .env
npm install
npm run seed
npm run dev
```

Open <http://localhost:5173>. The REST API listens at <http://localhost:4000/api/v1>. Seed is repeatable and does not duplicate known synthetic records. Demo password for the seeded users is `Demo@26264`:

| Role | Email |
|---|---|
| Reviewer (default login) | `reviewer@demo.aicte.local` |
| Administrator | `admin@demo.aicte.local` |
| PGRC bureau officer | `officer.pgrc@demo.aicte.local` |
| Regulation bureau officer | `officer.reg@demo.aicte.local` |
| Read-only viewer | `viewer@demo.aicte.local` |

The first run creates `server/data/ps26264.db` (or the path selected with `DATABASE_PATH`). Keep the database file to preserve actions and new complaints. Remove it only when you intentionally want a clean local demo.

The workspace's current local database includes one additional synthetic complaint created through the verified registration flow, on top of the six records from the seed. To return to only seeded records, stop the server, remove `server/data/ps26264.db` and its SQLite `-wal`/`-shm` sidecars, then run `npm run seed` again.

## Environment settings

Copy `.env.example` to `.env`. `PORT`, `DATABASE_PATH`, `WEB_ORIGIN`, `JWT_SECRET`, and `JWT_EXPIRES_IN` configure the local app. Change `JWT_SECRET` before exposing the prototype beyond a trusted local environment. AI variables are optional; blank means the corresponding service is unavailable. Embedding variables are `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, and optional `EMBEDDING_DIMENSIONS`. LLM variables are `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. `AI_TIMEOUT_MS`, `SEMANTIC_TOP_K`, `SIMILARITY_THRESHOLD`, and retry/notification settings are included for deployment planning; the current lightweight in-process job does not yet implement a durable retry queue or scheduled deadline notifications.

Set `LLM_BASE_URL` to the API root for an OpenAI-compatible service (the app appends `/chat/completions`). Set `EMBEDDING_BASE_URL` to an API root that accepts `POST /embeddings` with `{model,input}`. The prototype stores each successful vector and ranks it with cosine similarity. This is not Atlas Vector Search. Test embeddings against representative, labeled paraphrases and choose the model and threshold based on retrieval quality before presenting results as semantic.

## API overview

All routes are under `/api/v1`; all except health and login require a bearer token.

| Area | Routes |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET /users`, `POST /users` (admin) |
| Institutions | `GET/POST /institutions`, `GET/PATCH /institutions/:id`, `GET /institutions/:id/complaints`, `GET /institutions/:id/summary` |
| Complaints | `GET/POST /complaints`, `GET /complaints/:id`, `PATCH /complaints/:id/assignment`, `PATCH /complaints/:id/status`, `POST /complaints/:id/transfer`, `POST /complaints/:id/actions`, `GET /complaints/:id/actions` |
| Analysis | `POST /complaints/:id/analyze-overlaps`, `GET /complaints/:id/overlap-suggestions`, `POST /search/complaints` |
| Review | `GET /overlaps`, `GET /overlaps/:id`, `POST /overlaps/:id/confirm`, `/dismiss`, `/defer` |
| Dashboard | `GET /dashboard/summary`, `/dashboard/bureau-workload`, `/dashboard/pendency` |
| Operations | `GET /notifications`, `PATCH /notifications/:id/read`, `GET /reports/complaints`, `/reports/overlaps`, `GET /audit-logs` |

Complaint list supports `page`, `limit`, `q`, `status`, `bureauId`, `category`, and `institutionId`. Search accepts `{query,mode,filters}`. API access rules are enforced on the server; demo roles are intentionally simple and should be reviewed before real use.

## Seed scenario

The synthetic seed contains institutions in North, South, and West regions; cases across PGRC and Regulation; varied categories, statuses and due dates; a reviewable cross-bureau relationship; and a notification for the reviewer. Two complaints describe delayed graduation documents with different wording. A separate faculty-advertisement case at the same institution acts as a same-institution but unrelated example. The seeded review pair is a reproducible example; new AI-generated analysis depends on optional services and configured thresholds.

## Build and checks

```powershell
npm install
npm run build
npm run seed
npm run smoke
```

`npm run smoke` is a read-only API integration smoke test; start the API first with `npm run dev` or `npm start`. It verifies login, persisted dashboard and institution reads, overlap queue authorization, explicit keyword fallback, and logout revocation. The complaint registration path was also manually exercised through the API: the record persisted, its initial audit action was recorded, and background analysis completed. Build success checks TypeScript compilation and frontend bundling, not all acceptance criteria. Automated unit/frontend suites remain deferred.

## Deployment and limitations

`Dockerfile` builds the web frontend and API for a single-container demonstration, with a mounted data volume for SQLite. Use a persistent volume and set the environment securely. This is a prototype deployment only; it has not been hardened for production.

Known limitations and deferred items:

- MongoDB Atlas, Atlas Vector Search index setup, and a Mongoose storage adapter are not implemented in this runnable local version.
- Without an embedding provider, semantic mode degrades to keyword matching and labels that fallback. Lexical overlap is not semantic retrieval.
- No provider is configured by default. LLM explanations for fresh suggestions are absent until configured; a seeded synthetic review explanation is provided for demo purposes.
- Jobs run in-process after the API response. There is no durable queue, backoff/retry worker, scheduled deadline scan, or deadline notification generator yet. Failed analysis is visible on the complaint and can be retried manually.
- Attachments, production-grade regional resource restrictions, refresh-token invalidation, comprehensive account administration UI, test suites, and live-system integration are deferred.
- Demo credentials and synthetic records must never be reused in a deployed environment.
- The initial package installation reported three npm audit findings (two moderate and one high); review and update dependencies before deployment.
