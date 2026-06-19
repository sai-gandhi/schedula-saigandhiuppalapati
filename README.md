# Schedula — Doctor Appointment Scheduling System

A backend system for managing doctor availability, appointment booking, 
and scheduling, built with NestJS, TypeORM, and PostgreSQL. Supports two 
appointment scheduling strategies — STREAM (exact-time bookings) and 
WAVE (token-based group bookings) — along with rescheduling, cancellation, 
and intelligent slot suggestions.

## Tech Stack

- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL (via TypeORM, migrations only — `synchronize: false`)
- **Auth:** JWT (Passport.js), role-based guards (DOCTOR / PATIENT)
- **Deployment:** Render (API) + Neon (managed PostgreSQL)

## Live Server

**Base URL:** https://schedula-saigandhiuppalapati-1.onrender.com

Health check:
GET /
Returns: `Schedula API is running successfully! 🚀 | Developer: Uppalapati Sai Gandhi`

## Project Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL (local) or a Neon/managed Postgres instance
- npm

### Installation

```bash
git clone https://github.com/sai-gandhi/schedula-saigandhiuppalapati.git
cd schedula-saigandhiuppalapati
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/schedula
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1d
PORT=3000
```

For local development, no `sslmode` is needed. For production (Neon), 
append `?sslmode=require` to `DATABASE_URL` and ensure `ssl: { rejectUnauthorized: false }` 
is set in the TypeORM config (already configured in `app.module.ts` 
and `data-source.ts`).

### Run Migrations

```bash
npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts
```

### Start the Server

```bash
npm run start:dev
```

Server runs on `http://localhost:3000` by default.

## Features Implemented

### Authentication & Authorization
- Signup/login with email + password (bcrypt hashing)
- JWT-based authentication
- Role-based access control (DOCTOR, PATIENT)

### Doctor & Patient Profiles
- Profile creation, retrieval, and update for both roles
- Public doctor discovery with search/filter/pagination

### Doctor Availability
- Recurring weekly availability (multiple time windows per day)
- Custom date overrides (including marking a date fully unavailable)
- Overlap and invalid time-range validation

### Slot Generation
- Configurable slot duration
- Slot generation from recurring or override availability
- Future-only, available-only slots returned to patients

### Advanced Scheduling (STREAM & WAVE)
- Doctors choose a scheduling strategy: STREAM (exact appointment 
  times with optional buffer) or WAVE (token-based, capacity-limited 
  time windows)
- Sequential token assignment for WAVE bookings
- Real-time wave availability (`available / maxCapacity`)
- Conflicting-schedule guards: prevents regenerating slots or 
  switching scheduling type while active bookings exist for a date

### Appointment Booking & Management
- Book, view (patient and doctor sides), and cancel appointments
- Unified booking flow for both STREAM and WAVE (single service, 
  branching by scheduling type — no duplicated booking logic)
- Duplicate booking prevention
- Atomic capacity increments for WAVE bookings to prevent race 
  conditions under concurrent requests

### Appointment Rescheduling
- Reschedule to a new date/time following the same validation 
  rules as initial booking (STREAM and WAVE)
- Old slot/wave released and new slot/wave reserved consistently
- 30-minute cutoff rule: appointments cannot be cancelled or 
  rescheduled within 30 minutes of the start time
- "Suggest next available slot" — if the requested slot/wave is 
  unavailable, the system searches forward across days and 
  returns the next open slot or wave window with capacity

## API Collection

The full Postman collection covering all implemented APIs (auth, 
doctor/patient profiles, availability, slots, scheduling, 
appointments, rescheduling) is available here:

**[Schedula API Collection](https://github.com/sai-gandhi/schedula-saigandhiuppalapati/blob/main/src/postman/Schedula.postman_collection.json)**

To import: open Postman → Import → paste the link or upload the 
exported `.json` file from this repo at `/postman/Schedula.postman_collection.json`.

## Project Structure
src/

├── auth/              # JWT auth, guards, roles

├── users/             # Base user entity

├── doctor/            # Doctor profile CRUD + discovery

├── patient/           # Patient profile CRUD

├── availability/       # Recurring + override availability

├── slots/             # Slot generation and patient slot view

├── scheduling/         # STREAM/WAVE scheduling type + generation

├── appointments/       # Booking, cancellation, rescheduling

├── database/

│   └── migrations/     # All TypeORM migrations (synchronize: false)

├── app.module.ts

├── app.controller.ts

└── data-source.ts      # TypeORM CLI data source for migrations


## Branching Strategy

- Each day's task is developed on its own `feature/*` branch
- Branches with interdependent work (e.g. appointment booking 
  depending on slot generation) are branched off the relevant 
  in-progress feature branch rather than `main`, until that 
  branch is merged
- PRs are kept small (~15 files) with a clear description per PR
- No self-merging — every PR requires mentor review and approval 
  before merging to `main`

## Author

**Uppalapati Sai Gandhi**
Repository: https://github.com/sai-gandhi/schedula-saigandhiuppalapati
