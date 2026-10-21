# Campusly

Campusly is a role-based college event platform built with React, Express, and MongoDB. The MVP includes event discovery, admin and club event workflows, student bookings with simulated payments, in-app notifications, and session-based QR attendance.

## Run with Docker Compose

Docker Compose starts MongoDB, the API, and the built web app. It uses a named volume so database records survive container restarts.

1. Install Docker Desktop and start its engine. Stop any local `npm run dev` processes first; Compose uses host ports `5173` and `4001` by default.
2. In PowerShell, open the project folder:

   ```powershell
   cd C:\Users\Kavish\Desktop\Campusly
   ```

3. Make sure the root `.env` has a random `JWT_SECRET` with at least 32 characters and the seed account values described in [Development accounts](#development-accounts). The seed admin password and any configured club password must each have at least 12 characters. If the three optional `SEED_CLUB_*` values are used, set all three.
4. Start the stack:

   ```powershell
   docker compose up --build -d
   docker compose ps
   ```

5. Create any missing development accounts and the demo events:

   ```powershell
   docker compose exec api npm run seed --workspace backend
   ```

   Seeding keeps existing accounts and events; it does not reset their passwords.
6. Open [http://localhost:5173](http://localhost:5173). Check API readiness at [http://localhost:4001/api/health](http://localhost:4001/api/health).

### Connect MongoDB Compass

For the Compose database, create a Compass connection with:

```text
mongodb://127.0.0.1:27019/campusly
```

The default host port is `27019` so Campusly can run alongside MongoDB services already using `27017` or `27018`. To change it, set `MONGODB_HOST_PORT` in `.env` before starting Compose. If the web or API host ports are already in use, set `WEB_HOST_PORT` or `API_HOST_PORT` there too. Compass is a database client; Docker Compose must be running the MongoDB server for the connection to work. Compose binds MongoDB to localhost only.

Useful commands:

```powershell
docker compose logs -f api
docker compose logs -f mongo
docker compose down
```

`docker compose down` keeps the database volume. Removing the named volume deletes the stored Campusly database.

## Run locally without Docker

Requirements: Node.js 20.19+ and a MongoDB server reachable at `MONGODB_URI` in the root `.env`.

1. Install workspace dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` if you do not already have a local `.env`. Set `MONGODB_URI`, a random `JWT_SECRET`, and development seed account values. Keep `.env` private.
3. Start MongoDB separately. If using Compass, connect Compass to the same MongoDB URI configured in `.env`; opening Compass alone does not start MongoDB.
4. Create accounts and demo events once MongoDB is running:

   ```powershell
   npm run seed --workspace backend
   ```

5. Start the API and Vite frontend:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173). The local API listens on port `4001` by default, and Vite proxies `/api` requests to it.

## Development accounts

The seed script reads credentials from `.env` and runs only when `NODE_ENV=development`.

- **Admin:** `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`.
- **Internal student:** `SEED_STUDENT_ENROLLMENT` is the username. `SEED_STUDENT_PHONE` is the initial password; the student must change it at first sign-in.
- **Optional demo club:** `SEED_CLUB_USERNAME` and `SEED_CLUB_PASSWORD`. Configure `SEED_CLUB_NAME` too. A club account created later from Admin → Accounts requires a password change at first sign-in.

Seeding is idempotent for existing accounts. If an account already exists, the script preserves its current password. To change a club account password, use the admin account management page.

Two demo official events are seeded: a free event and a paid event with server-generated simulated payment outcomes. When a demo club account is configured, a pending club event is seeded for the approval workflow. No real payment is collected. In local development, external signup returns a verification code in the response so the flow can be demonstrated without an email provider; this is not email delivery.

## Main workflows

- Admin creates official events, provisions club workspaces, reviews club submissions, manages account status, cancels bookings/events, sends campus notifications, and exports bookings/attendance CSV files.
- Club accounts create event drafts, submit them for approval, then manage their own published event sessions, registrations, rotating QR codes, attendance corrections, and participant notifications.
- Internal and verified external students browse eligible published events, reserve free or simulated paid tickets, cancel bookings, scan current session QR codes, view attendance summaries, and read notifications.
- API authorization and ownership checks enforce these rules even when a client bypasses the UI.

## Checks

Run the frontend build, static checks, and available backend tests:

```powershell
npm run check
npm run build
npm test
```

## Docker layout and ports

- Web app: `http://localhost:5173` (`WEB_HOST_PORT` can change the host port).
- API: `http://localhost:4001` (`API_HOST_PORT` can change the host port).
- MongoDB for Compass: `127.0.0.1:27019` (`MONGODB_HOST_PORT` can change the host port).
- Compose database URI from the API container: `mongodb://mongo:27017/campusly`.
- Persistent Compose volume with the default project name: `campusly_campusly_mongo_data` (`campusly` project prefix plus the `campusly_mongo_data` volume key). `docker compose down` keeps this volume; `docker compose down -v` removes it.

The Compose stack is intended for local demonstration. It uses development mode for the local verification-code workflow and HTTP cookies; deploy with production secrets, HTTPS, secure cookies, and a real email verification provider before exposing the app publicly.

## Demo walkthrough

1. Sign in as Admin and review the seeded club submission.
2. Approve the club event and create an additional official event.
3. Sign in as the club and add one or more event sessions.
4. Sign in as a student and reserve a free ticket or try the simulated paid event.
5. Open the live attendance QR for a session and scan it as a registered student during the attendance window. Camera scanning requires browser support and camera permission; the scan page also accepts a pasted QR token for local troubleshooting.
6. Review attendance and make a reasoned correction as the Admin or owning club account.
7. Send an event participant notification and confirm it appears in the student inbox.
8. Restart the Compose services and confirm the event and booking records remain.

## Known MVP limits

- Demo payment success/failure and refund records are simulated; no gateway or money movement is connected.
- Development verification codes are shown to support local demos. No outbound email provider is configured.
- Email verification confirms access to the address only; it does not verify external college enrollment.
- QR attendance requires an active internet connection and a confirmed ticket. Short-lived rotating QR codes reduce reuse but cannot prevent real-time sharing.
- Reports are CSV exports and summary counts. This is a demonstration MVP, not a production identity, payments, or high-scale ticketing system.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestone status and [ARCHITECTURE.md](./ARCHITECTURE.md) for system boundaries.
