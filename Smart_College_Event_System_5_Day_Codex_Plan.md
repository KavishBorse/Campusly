# Smart Containerized College Event Management System
## 5-Day Codex Execution Plan | MERN + Docker

**Goal:** Deliver roughly 80% of a demonstrable MVP in five focused days. Prioritize end-to-end working flows, a polished role-based frontend, core data integrity, and a repeatable Docker setup. This is a sprint target, not a guarantee; scope must be reduced before compromising correctness or security.

---

## 1. Product brief

Build a responsive web platform for managing official college events and club events, student registrations, demo ticketing, multi-day attendance, rotating QR attendance, student records, and notifications.

### Confirmed roles

1. **Admin**
   - Full platform control.
   - Creates and publishes official college events.
   - Creates club accounts and issues/resets club credentials.
   - Approves or rejects club event submissions.
   - Manages users, event eligibility, bookings, cancellations, simulated refunds, global attendance corrections, notifications, and reports.
2. **Club account**
   - One shared login per club, created by the admin.
   - Can create/edit its own event drafts and submit them for approval.
   - Can manage approved events belonging to its club.
   - Can view registrations for its own events, start attendance sessions, display rotating QR codes, correct attendance for its own events, and notify relevant participants.
   - Must never access or edit another club’s data.
3. **Internal MIT student**
   - Admin-provisioned credentials: Enrollment ID as username and phone number as the initial password.
   - Must change initial password at first login.
   - Can browse eligible events, register/book, view tickets, attendance, and notifications.
4. **External student**
   - Self-registers with name, college details, and email verification.
   - Email verification confirms control of the address, not college enrollment. Stronger college verification can be a later enhancement.
   - Can register only for events whose eligibility permits external students.

### Event types and approval

- Official college event: created and published by Admin.
- Club event: created by Club account, then must be approved by Admin before publication.
- Material changes after approval (date, venue, capacity, price, eligibility) should return the event to pending approval.
- Suggested lifecycle: Draft → Pending Approval → Approved/Published or Changes Requested/Rejected → Completed/Cancelled.

### Ticketing

- Free registration and paid-ticket events are both supported.
- Paid flow uses **simulated/demo payments only**. No real money is charged.
- Backend, not frontend, determines the demo payment outcome.
- Confirm a paid booking only after a successful demo payment result.
- Capacity must not be oversold; expired/failed holds release seats.
- Admin controls cancellations and simulated refund outcomes.

### Attendance

- Events support multiple days and multiple sessions per day.
- Each session has its own date, start/end time, and attendance window.
- Dynamic QR rotates every 5 seconds by default; configurable to 10 seconds.
- Server validates token expiry, active session, student authentication, registration, eligibility, and duplicate attendance.
- Attendance is recorded against a specific session. A student has at most one attendance record per session.
- Display both:
  - Daily attendance = attended event days / event days that have occurred and are eligible.
  - Session attendance = attended eligible sessions / eligible sessions that have occurred.
- Future and cancelled sessions must not count as absences.
- Admin can correct any attendance; a club can correct attendance only for its own event. Store reason, actor/account, timestamp, old value and new value in an audit log.
- Dynamic QR reduces sharing but cannot guarantee prevention of real-time screenshot sharing. Do not claim otherwise. QR scan requires internet in MVP.

### Notifications

- Admin can send platform-wide or targeted in-app notifications.
- Club can notify participants of its own events.
- Target by event, registered participants, student type, or selected eligible students as appropriate.
- Include title, message, sender, timestamp, read/unread status, and notification history.
- Email notifications are optional/later; initial MVP uses in-app notifications.

---

## 2. Recommended stack and architecture

- Frontend: React + Vite + TypeScript (recommended for safer refactoring) or JavaScript if the repository already uses it.
- UI: Tailwind CSS + a consistent component system; use Lucide icons and a chart library only where helpful.
- Backend: Node.js + Express.
- Database: MongoDB + Mongoose.
- Authentication: hashed passwords, short-lived access token or secure session strategy, role middleware, and forced password change for provisioned MIT accounts.
- QR: server-generated short-lived signed/random token; never put secrets in frontend code.
- Docker: frontend container, API container, MongoDB container, Compose network, persistent DB volume, health checks, `.env.example`, `.dockerignore`.
- Optional only if time permits: Redis, real email delivery, cloud deployment, real payment gateway, certificates, GPS attendance.

### Suggested collections

- `users`: role, account type, name, email, enrollment ID (internal), phone, password hash, email verification state, must-change-password flag, status.
- `clubs`: name, slug, description, shared account/user reference, status.
- `events`: type, club reference if club event, title, description, poster, venue, start/end dates, registration deadline, capacity, eligibility, ticket type/price, approval state, creator, published state.
- `sessions`: event reference, date, title, start/end time, attendance open/close time, status.
- `registrations`: event/user refs, status, registration timestamp, eligibility snapshot where useful.
- `bookings`: registration/event/user refs, status, ticket code, hold expiry.
- `payments`: booking ref, demo status, amount, simulated provider reference, timestamps.
- `attendance`: event/session/user refs, status, source (QR/manual), recorded time, corrected metadata. Add unique index on session + user.
- `qrSessions` or `qrTokens`: session reference, token hash/identifier, expiry, active state; keep token lifetime short.
- `notifications`: sender, audience rule/target, event ref if applicable, title, message, created time.
- `notificationReads` or per-user read state: notification/user refs, read time.
- `auditLogs`: actor, role, action, target type/id, before/after summary, reason, timestamp.

Keep the schema pragmatic. Avoid creating separate microservices just to appear containerized. A modular monolith is the right five-day scope.

---

## 3. Frontend quality bar

Do not create a generic landing page with nonfunctional dashboard buttons. Build a cohesive product UI with a clear visual identity.

### Visual direction

- Modern university SaaS platform: deep navy/ink base, warm off-white surfaces, one vivid accent (indigo, cobalt, or teal), strong typography, generous spacing, restrained gradients.
- Public event pages should feel editorial and event-focused; dashboards should be information-dense but calm.
- Use consistent design tokens for color, spacing, radius, typography, shadows, and status badges.
- Use real layouts and intentional hierarchy rather than repeating identical cards everywhere.
- Use responsive sidebar navigation on desktop and a drawer/bottom navigation pattern on mobile.
- Add polished loading skeletons, empty states, error states, form validation, toast feedback, confirmation dialogs, and disabled/loading button states.
- Use accessible contrast, visible focus, keyboard navigation, semantic headings and labels.
- Do not use lorem ipsum, fake charts that imply real data, or dead buttons. Seed/demo data should be clearly identifiable.

### Required pages

**Public**
- Home / event discovery
- Event listing with search and filters
- Event details
- Login and registration
- External student signup / email verification state

**Admin**
- Overview dashboard
- Event approvals and event management
- Club management and credential reset
- Student management
- Bookings and demo payments
- Attendance correction and audit trail
- Notifications composer/history
- Reports/settings

**Club**
- Club dashboard
- Create/edit event
- Approval status and feedback
- Registrations/participants
- Attendance sessions and live QR display
- Attendance register/corrections
- Event-specific notifications
- Reports

**Student**
- Student dashboard
- My bookings/tickets
- My attendance (daily + session)
- Notifications
- Profile and password change

For five days, implement all core pages but keep low-priority settings/reporting screens compact. Every visible primary action must work or be explicitly disabled with a reason.

---

## 4. Five-day execution schedule

### Day 1 — Repo audit, foundation, design system, authentication (target: 20%)

**Build**
- Inspect repository and preserve existing work; do not overwrite blindly.
- Create a concise implementation checklist and architecture note.
- Set up frontend/backend folders if missing.
- Configure Vite, routing, Tailwind/component primitives, Express, MongoDB/Mongoose.
- Build app shell, typography, colors, buttons, inputs, tables, modals, toasts, badges, skeletons, empty states.
- Implement login, logout, role routing, backend authorization middleware, password hashing.
- Add admin-provisioned MIT student login (Enrollment ID + initial phone-number password) and forced first-login password change.
- Seed a development admin and demo accounts safely via a seed script; never hardcode production credentials.

**Day 1 acceptance**
- App starts locally.
- Login routes users to correct dashboards.
- Backend rejects unauthorized role access.
- MIT user is forced to change initial password.
- No secrets are committed.

### Day 2 — Events, clubs, approval, eligibility (target: 40%)

**Build**
- Club model/account creation and reset credentials.
- Admin creates official events and publishes them.
- Club creates event drafts and submits for approval.
- Admin approves/rejects with feedback.
- Event listing/details and student-facing eligibility display.
- Event fields: schedule, venue, capacity, registration deadline, eligibility, free/paid type, price.
- Edit permissions and re-approval for material changes.
- Add search/filter/sort and realistic seed events.

**Day 2 acceptance**
- Official event creation works.
- Club events cannot be published before approval.
- Club A cannot read/update Club B’s event by changing IDs.
- External eligibility is enforced server-side.
- Frontend forms show validation and useful errors.

### Day 3 — Registrations, bookings, demo payment, notifications (target: 60%)

**Build**
- Student registration for eligible events.
- Duplicate registration prevention.
- Capacity-safe reservation/booking logic.
- Free registration confirmation and ticket code.
- Simulated payment success/failure and payment history.
- Cancellation by admin and simulated refund record.
- In-app notifications for admin and club, with correct audience scoping.
- Student notification list and read/unread state.

**Day 3 acceptance**
- Free and paid-demo booking flows work end to end.
- Failed demo payment does not confirm the booking.
- Capacity is not oversold in normal concurrent tests.
- Club notifications are limited to its event audience.
- Admin can notify appropriate student groups.
- All payment/refund screens clearly state that they are simulated.

### Day 4 — Multi-day sessions, rotating QR, attendance (target: 75%)

**Build**
- Create multiple sessions per event/day.
- Session lifecycle: scheduled → open → closed.
- QR display that requests/refreshes short-lived server tokens every five seconds.
- Student scan page (mobile camera where supported; allow manual camera permission troubleshooting).
- Backend validation of token, session window, login, registration and duplicate status.
- Attendance register with QR/manual source.
- Admin global corrections; club corrections only for its own events.
- Audit log for corrections.
- Daily and session attendance calculations that exclude future/cancelled sessions.
- Student attendance dashboard.

**Day 4 acceptance**
- Expired QR is rejected.
- A student cannot mark attendance twice for one session.
- Unregistered students cannot mark attendance.
- A club cannot correct another club’s attendance.
- Corrections create audit entries.
- Multi-day percentages are accurate against completed eligible sessions/days.
- QR scan works on a real phone on the same reachable network or deployed environment.

### Day 5 — Docker, integration testing, polish, documentation (target: 80%+)

**Build**
- Dockerfiles for frontend/backend and `compose.yaml`.
- MongoDB persistent volume and private service network.
- Health checks, restart policies and environment configuration.
- `.env.example`, `.gitignore`, `.dockerignore`.
- Validate clean startup with `docker compose up --build`.
- Smoke-test all four roles and core workflows.
- Fix critical UI defects and mobile layout.
- Add README with setup, seeded accounts, features, architecture, API overview, Docker commands, demo limitations and troubleshooting.
- Prepare a 3–5 minute demonstration script.

**Day 5 acceptance**
- Fresh clone can be started using documented commands.
- Data survives MongoDB container restart.
- Core end-to-end flows pass.
- No known critical authorization or booking bugs.
- Frontend works at desktop and mobile widths.
- Project can be demonstrated without manually editing database records.

**Definition of “80% complete”:** all core MVP workflows above are implemented and demonstrable. It does not mean production-ready, fully audited, deployed at scale, or complete with real email/payment integrations.

---

## 5. Prioritization if time runs short

### Must ship
1. Role-based authentication and API permissions.
2. Official/club event creation and approval.
3. Student eligibility and registration.
4. Free booking and simulated paid booking.
5. Multi-day/session attendance with dynamic QR and correction audit.
6. Student notifications.
7. Docker Compose with persistent database.
8. Cohesive responsive frontend.

### Simplify, but do not fake
- Analytics: basic counts and simple charts.
- Reports: CSV export instead of complex report builder.
- Email: show verification workflow in development using a safe local/dev method; document delivery setup.
- Camera scanning: use a maintained QR scanner library; provide clear permission/error states.
- QR token storage: store only necessary token metadata/hash where practical.
- Notifications: in-app only in MVP.
- Refunds: simulated records only.

### Defer
- Real payment gateway.
- SMS/WhatsApp.
- GPS/geofencing.
- Certificates and automated PDF generation.
- Redis, microservices and Kubernetes.
- Production cloud deployment and high-scale load testing.

Never defer backend authorization, password hashing, input validation, database constraints, or clear demo-payment labeling.

---

## 6. Codex working protocol

Use Codex as an iterative coding agent, not as a one-shot code generator.

### Initial instruction to Codex

> Read this entire plan before coding. First inspect the current repository, identify existing frameworks/files and report the proposed implementation sequence. Preserve working code. Do not replace the project wholesale. Create or update `IMPLEMENTATION_PLAN.md` with a checkbox task list and `ARCHITECTURE.md` with the chosen architecture. Then implement Day 1 only. Run the available lint/build/tests and report exact commands and results. Do not claim a check passed unless you ran it.

### Daily loop

1. Ask Codex to implement one milestone only.
2. Review changed files and inspect any authentication, permissions, booking or attendance logic carefully.
3. Run the app and the milestone acceptance tests.
4. Fix failures before moving forward.
5. Commit a working checkpoint to Git.
6. Update the implementation checklist with completed and blocked items.
7. Start the next milestone.

### End-of-day prompt

> Compare the current repository against the relevant day’s acceptance criteria in this plan. Run tests/builds that are available, list passed and failed checks, identify security or data-integrity gaps, and fix critical issues before adding more features. Update `IMPLEMENTATION_PLAN.md`. Do not mark unfinished features as complete.

### Avoid these Codex failure modes

- Generating every page before the data model/API exists.
- Using localStorage as the real database or authorization mechanism.
- Hardcoding users, passwords, payment success, attendance or analytics into production flows.
- Building decorative buttons with no behavior.
- Allowing a frontend role check to replace backend authorization.
- Using a static QR code or trusting the browser to decide attendance.
- Overwriting a repository without inspecting it.
- Adding many libraries or microservices without a clear need.
- Claiming features or tests are complete without verifying them.

---

## 7. Git and delivery checkpoints

Suggested commits:
- `chore: establish MERN app structure and design system`
- `feat: add authentication and role permissions`
- `feat: add event and club approval workflows`
- `feat: add registrations and demo ticketing`
- `feat: add notifications`
- `feat: add session-based QR attendance`
- `feat: add attendance audit and summaries`
- `chore: containerize app and document setup`
- `fix: resolve final integration issues`

Keep `.env` and credentials out of Git. Use `.env.example` with placeholder values only.

---

## 8. Final demonstration script

1. Log in as Admin and create a club account.
2. Log in as that Club and create a three-day event with multiple sessions.
3. Submit it for approval; show the Admin approval step.
4. Log in as a student, register for the event, and demonstrate a free booking or simulated paid booking.
5. Start a session and show the rotating QR code.
6. Scan from a student device and show the attendance record.
7. Attempt a duplicate scan and show it is rejected.
8. Demonstrate an authorized manual correction and its audit record.
9. Show daily attendance and session attendance on the student dashboard.
10. Send a notification and show it on the student account.
11. Restart the Docker Compose stack and demonstrate persisted event/booking data.

---

## 9. Final scope and honest limitations

This is a focused MVP plan for a five-day sprint. The biggest risks are QR attendance edge cases, permissions, capacity races, and frontend/backend integration. If time is lost, reduce visual extras and advanced reports first; do not weaken security or data integrity.

The initial system is a student mini-project, not a production-ready ticketing or identity-verification service. Real payment processing, reliable outbound email delivery, strong external college verification, and anti-proxy attendance measures need separate validation before real-world use.
