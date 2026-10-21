# Architecture

## Stack and deployment

- **Frontend:** React, TypeScript, Vite, React Router, Lucide icons, and a custom responsive CSS system.
- **API:** Node.js 22 and Express 5 using JavaScript ES modules.
- **Database:** MongoDB and Mongoose. Local development uses the URI in `.env`; Compose gives the API the private service URI `mongodb://mongo:27017/campusly` and persists MongoDB data in a named volume.
- **Authentication:** 15-minute HS256 JWT in an HTTP-only, same-site cookie. The API reloads the user for each request and applies role, active-account, first-login-password, and ownership checks server-side.
- **Compose web routing:** Nginx serves the built single-page app and proxies `/api` to the API container. Local Vite uses a development proxy to port 4001.

## Modules

- `auth`: login, logout, current-user lookup, forced password change, external registration and email verification.
- `clubs`: admin-created club accounts, credential resets, account status, and user directory.
- `events`: public discovery, official event publishing, club drafts, admin review, edit permissions, and eligibility.
- `bookings`: capacity-limited registrations, free tickets, server-simulated payments, cancellation/refund records, and CSV exports.
- `notifications`: per-recipient in-app inbox, read state, audience targeting, and event participant messages.
- `attendance`: sessions, five-second server-issued QR tokens, scan checks, attendance summaries, corrections, audit history, and CSV export.
- `overview`: role-specific dashboard counts from persisted records.

The API is a modular monolith. Mongoose indexes are initialized before the server accepts requests so unique registration, attendance, and token constraints are available to the workflows that rely on them.

## Data integrity and authorization

- Passwords are stored as bcrypt hashes. Password hashes and verification hashes are excluded from normal user projections.
- The server checks event eligibility, event ownership, active club ownership, ticket status, QR expiry, session window, and duplicate attendance. Frontend route visibility is not treated as authorization.
- Registration and attendance have unique database indexes. Event capacity is reserved with a conditional atomic update against the event document.
- QR values are generated on the server; MongoDB stores only their SHA-256 hashes and expiry time.
- Attendance corrections record actor, reason, prior status, new status, session, and student in an audit entry.
- CSV exports quote fields and neutralize cells that could be interpreted as spreadsheet formulas.
- Simulated payment results are generated on the server and explicitly identify that no real money is charged.

## Local and production configuration

- `.env` is for local development and Compose variable interpolation; it is ignored by Git and Docker build contexts. `.env.example` contains placeholders only.
- Compose binds published ports to `127.0.0.1`. Defaults are web `5173`, API `4001`, and MongoDB `27019` so they can coexist with common local services using `27017` or `27018`.
- The Compose app runs in development mode so local email verification can be demonstrated without an email provider. Do not expose this stack publicly. A deployment needs HTTPS, secure cookies, production secrets, and an email provider.
- Demo payments, external college affiliation checks, reliable outbound email, production monitoring, and high-scale load testing are outside the MVP.
