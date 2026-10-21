# Campusly implementation plan

This checklist tracks the supplied five-day MERN event-system plan. Days 1–4 features and the Day 5 container/documentation files are implemented and verified locally, including the Docker Compose stack and its persistent database volume.

## Day 1 — Foundation and authentication

- [x] Preserve the supplied plan and record architecture/security boundaries.
- [x] Set up React, Vite, TypeScript, Express, Mongoose, and local environment examples.
- [x] Build the responsive application shell and role-specific overview pages.
- [x] Implement login, logout, current-session lookup, role authorization, and forced password changes.
- [x] Add a development-only idempotent seed script with credentials from `.env`.
- [x] Add and run role middleware and first-login gate tests.
- [x] Run frontend build and static checks.
- [x] Start the API against a running MongoDB instance and verify the login flow end to end.

## Day 2 — Events, clubs, approval, and eligibility

- [x] Add club and event models, admin club provisioning, password resets, and account status management.
- [x] Add admin official-event publishing and club draft/submission/review workflows.
- [x] Add event discovery, search, details, eligibility checks, and validated create/edit forms.
- [x] Enforce club ownership, publication approval, and re-approval for material changes in the API.
- [x] Verify club A cannot read or edit club B’s event against MongoDB.

## Day 3 — Bookings, simulated payments, and notifications

- [x] Add unique event registrations and conditional atomic capacity reservation.
- [x] Add free tickets, server-generated simulated payment success/failure, and payment history.
- [x] Add booking cancellation, simulated refunds, and event cancellation notifications.
- [x] Add per-user in-app inbox, read state, admin audience targeting, and event participant notifications.
- [x] Add admin booking CSV export.
- [x] Exercise free and paid booking, capacity, cancellation, and notification flows against MongoDB.

## Day 4 — Sessions and attendance

- [x] Add multi-session event schedules and cancellation of individual sessions.
- [x] Add five-second server-issued rotating QR tokens and server-side expiry/session checks.
- [x] Require an active student account and confirmed event booking for QR scans; reject duplicate scans.
- [x] Add attendance register, role-scoped corrections, reasoned audit history, and CSV export.
- [x] Add student daily and session summaries that exclude future and cancelled sessions.
- [x] Add a browser camera scan page with a manual token fallback.
- [x] Verify live QR scan, duplicate rejection, authorization, corrections, and summary percentages against MongoDB.

## Day 5 — Docker, integration, polish, and documentation

- [x] Add backend and frontend Dockerfiles, Nginx SPA/API routing, and Compose services.
- [x] Add MongoDB health checks, a persistent volume, localhost-only published ports, and `.dockerignore`.
- [x] Document local setup, Compose startup, Compass connection, accounts, workflows, and MVP limits.
- [x] Add development demo official events and an optional club submission to the seed script.
- [x] Run static checks, frontend build, and available backend tests.
- [x] Run `docker compose up --build`, seed through the API container, and smoke-test all four account types.
- [x] Check database persistence after restarting the Compose services.
- [x] Visually inspect the supplied desktop workspace screenshots and mobile event discovery.

## Verification recorded on 2026-10-22

- `npm run check` — passed.
- `npm run build` — passed.
- `npm test` — passed (5 auth and middleware tests).
- Local integration smoke — passed 84 checks against a disposable MongoDB database, including admin, club, internal student, and verified external student workflows; free and simulated paid booking; one-seat concurrency; notifications; CSV reports; QR timing, expiry and duplicate rejection; attendance correction audit; and attendance summaries.
- `docker compose config --quiet` — passed.
- `docker compose up --build -d` — passed; MongoDB and API reported healthy, frontend started, and `http://localhost:5173/` and `/api/health` returned HTTP 200/`ok`.
- `docker compose exec -T api npm run seed --workspace backend` — passed; admin, internal student, club, and demo events were present.
- Compose account smoke — passed login for admin, internal student, club, and a verified external student; the temporary external test account was removed.
- Compose restart persistence — passed; MongoDB had 3 users and 3 events before and after restarting all services.
- Responsive browser review — no horizontal overflow at 390px or 320px viewport widths; no browser console errors on public event discovery.
- Compose uses the project-scoped `campusly_campusly_mongo_data` volume. The pre-existing `campusly_mongo_data` volume was left untouched.
- The temporary MongoDB data and test accounts used by the integration smoke were removed after verification.

The Docker Compose stack is running locally. See [README.md](./README.md) for app URLs, the Compass connection string, and commands to inspect or stop the services.
