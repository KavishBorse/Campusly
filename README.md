# Campusly

Campusly is a role-based college event platform built with React, Express, and MongoDB. The MVP includes event discovery, admin and club event workflows, student bookings with simulated payments, in-app notifications, and session-based QR attendance.

## Run with Docker Compose

Docker Compose starts MongoDB, the API, and the built web app. It uses a named volume so database records survive container restarts.

1. Install Docker Desktop and start its engine. Stop any local `npm run dev` processes first; Compose uses host ports `5173` and `4001` by default.
2. In PowerShell, open the project folder:

   ```powershell
   cd C:\Users\Kavish\Desktop\Campusly
   ```

3. Make sure the root `.env` has a random `JWT_SECRET` with at least 32 characters and the seed account values described in [Development accounts](#development-accounts). The seed admin password and any configured club password must each have at least 8 characters. If the three optional `SEED_CLUB_*` values are used, set all three.
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

Requirements: Node.js 24+ and a MongoDB server reachable at `MONGODB_URI` in the root `.env`.

1. Install workspace dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` if you do not already have a local `.env`. Set `MONGODB_URI`, a random `JWT_SECRET`, and development seed account values. Keep `.env` private. External signup creates the account immediately without email verification. MIT students still use an email code when linking their college address to their enrollment ID.
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

## Deploy to Vercel, Render, and MongoDB Atlas

The deployment setup uses Vercel for the React site, Render for the Express API, and Atlas for MongoDB. The Render Blueprint runs on the free web-service plan for a demo; it can sleep after inactivity and may take about a minute to wake. Render's free web services block SMTP ports, so hosted verification email uses Resend's HTTPS API instead.

1. Push the project to the GitHub repository connected to these providers. Keep `.env` and provider credentials out of Git.
2. In MongoDB Atlas, create a cluster and a database user with read/write access to the Campusly database. Add the Render service's outbound IP addresses to the Atlas network access list; do not use `0.0.0.0/0`. Copy the Atlas connection URI and include `/campusly` as the database name.
3. In Render, create a Blueprint from this repository. The root `render.yaml` creates `campusly-api` and generates `JWT_SECRET`. Set `MONGODB_URI` to the Atlas URI and `FRONTEND_ORIGIN` to the exact production Vercel origin, such as `https://campusly.vercel.app`.
4. Email delivery is used only when MIT students link their college email. For production, use Resend with a verified sending domain: set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` in Render, and keep the key only in Render's environment settings. For temporary testing, SendGrid supports a verified single sender over HTTPS: set `EMAIL_PROVIDER=sendgrid`, `SENDGRID_API_KEY`, and `EMAIL_FROM` to that verified address. SendGrid describes single-sender verification as testing-only, and public Gmail/Yahoo sender addresses may fail DMARC, so use an authorized college sender or verified domain for reliable delivery.
5. In Vercel, import the same GitHub repository with the repository root as the project root. The root `vercel.json` builds `frontend/dist`, serves the client-side routes, and proxies `/api/*` to `https://campusly-api.onrender.com`. If Render assigns a different service URL, update that destination in `vercel.json` and push the change. Set `FRONTEND_ORIGIN` in Render to the final Vercel production domain.
6. After Atlas and Render are reachable, create the first production admin from this project folder in PowerShell. The script prompts for the Atlas URI and admin credentials without echoing secrets, refuses to add a second admin, and creates no demo accounts or events:

   ```powershell
   $env:NODE_ENV = "production"
   npm run create-admin --workspace backend
   Remove-Item Env:NODE_ENV
   ```

7. Open the Vercel URL, check the public event page, create an external account, and sign in. The Vercel API proxy keeps the browser session cookie on the same site.

The admin setup command writes only to the Atlas URI entered at its prompt. Do not run the development seed command against production; it creates demo accounts and events and intentionally only runs in development mode.

### Provision internal students in Atlas

After a college administrator verifies the enrollment IDs against the official roster, run the bulk provisioner from the project folder in an interactive PowerShell terminal. It prompts for the Atlas URI and each student's name, enrollment ID, and initial phone password. The URI and phone inputs are hidden; passwords are bcrypt-hashed, and students must change them at first sign-in. A preview run makes no database changes; `--apply` still requires typing `PROVISION` after reviewing the list. The command aborts if an enrollment ID or username already exists and inserts the batch in one transaction.

```powershell
$env:NODE_ENV = "production"
npm run provision-students --workspace backend -- --apply
Remove-Item Env:NODE_ENV
```

The command prints a preview and asks for the exact word `PROVISION` before writing. To preview without the ability to write, omit `-- --apply`.

Run this from a trusted computer and use a database URI with write access to `campusly`. If Atlas rejects the connection, add the current computer's IP under Atlas → Network Access; avoid allowing access from every IP. Never paste the phone values into `passwordHash` directly or commit them to a file.

## Development accounts

The seed script reads credentials from `.env` and runs only when `NODE_ENV=development`.

- **Admin:** `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`.
- **Internal student:** `SEED_STUDENT_ENROLLMENT` is the username. `SEED_STUDENT_PHONE` is the initial password; the student must change it at first sign-in.
- **Optional demo club:** `SEED_CLUB_USERNAME` and `SEED_CLUB_PASSWORD`. Configure `SEED_CLUB_NAME` too. A club account created later from Admin → Accounts requires a password change at first sign-in.

Seeding is idempotent for existing accounts. If an account already exists, the script preserves its current password. To change a club account password, use the admin account management page. Internal MIT students change their initial phone-number password, then link an email at `students.mituniversity.edu.in` whose part before `@` exactly matches their stored enrollment ID; Campusly sends an OTP before saving it as verified.

Two demo official events are seeded: a free event and a paid event with server-generated simulated payment outcomes. When a demo club account is configured, a pending club event is seeded for the approval workflow. No real payment is collected. When SMTP settings are absent in development, internal student email linking returns a verification code for local demos; this is not email delivery. SMTP settings are passed through Compose from `.env` using `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. Use port `587` with `SMTP_SECURE=false` for STARTTLS or port `465` with `SMTP_SECURE=true`. `INTERNAL_STUDENT_EMAIL_DOMAIN` defaults to `students.mituniversity.edu.in` and applies only to internal student email linking.

## Main workflows

- Admin creates official events, provisions club workspaces, reviews club submissions, manages account status, cancels bookings/events, sends campus notifications, and exports bookings/attendance CSV files.
- Club accounts create event drafts, submit them for approval, then manage their own published event sessions, registrations, rotating QR codes, attendance corrections, and participant notifications.
- Event creators choose whether to track attendance. For tracked events, participants with a recorded check-in can open a formatted attendance letter after the event ends and print or save it as a PDF.
- Internal and external students browse eligible published events, reserve free or simulated paid tickets, cancel bookings, scan current session QR codes, view attendance summaries, and read notifications.
- External accounts can sign up and sign in without email verification. Internal MIT students can link a verified college email only when its local part matches their stored enrollment ID.
- API authorization and ownership checks enforce these rules even when a client bypasses the UI.
- The web app uses responsive layouts for phones and desktops. Camera QR scanning uses a browser decoder fallback; camera access still requires browser permission and a secure context (HTTPS or localhost). A manual token field remains available.

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

The Compose stack is intended for local demonstration. It uses development mode and HTTP cookies; deploy with production secrets and HTTPS before exposing the app publicly. Email OTP settings are used only for MIT students linking a college email.

## Demo walkthrough

1. Sign in as Admin and review the seeded club submission.
2. Approve the club event and create an additional official event.
3. Sign in as the club and add one or more event sessions.
4. Sign in as a student and reserve a free ticket or try the simulated paid event.
5. Open the live attendance QR for a session and scan it as a registered student during the attendance window. Camera scanning requires a secure browser context (HTTPS or localhost) and camera permission; the scan page also accepts a pasted QR token for local troubleshooting.
6. Review attendance and make a reasoned correction as the Admin or owning club account.
7. Send an event participant notification and confirm it appears in the student inbox.
8. Restart the Compose services and confirm the event and booking records remain.

## Known MVP limits

- Demo payment success/failure and refund records are simulated; no gateway or money movement is connected.
- Email delivery for MIT student college-email linking supports SMTP, Resend, and SendGrid. External signup does not require email verification. The internal email code confirms mailbox access and checks that the address matches the configured MIT domain and enrollment ID format; this is not a live enrollment-status check, which requires an official college roster, SIS API, or identity provider.
- QR attendance requires an active internet connection and a confirmed ticket. The scan page uses a browser QR decoder and asks for camera permission; camera access needs HTTPS or localhost. On a phone visiting a local development server over plain LAN HTTP, use the manual code field or serve the app over HTTPS. Short-lived rotating QR codes reduce reuse but cannot prevent real-time sharing.
- Reports are CSV exports and summary counts. This is a demonstration MVP, not a production identity, payments, or high-scale ticketing system.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for milestone status and [ARCHITECTURE.md](./ARCHITECTURE.md) for system boundaries.
