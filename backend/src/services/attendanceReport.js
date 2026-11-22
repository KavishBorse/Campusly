const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const dateTime = (value) => value
  ? new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
  : 'Not provided';

const modeLabel = (mode) => ({
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
}[mode] ?? 'In person');

const eligibilityLabel = (eligibility) => ({
  all: 'Internal and external students',
  internal: 'Internal MIT students',
  external: 'External students',
}[eligibility] ?? 'Not specified');

const accountLabel = (user) => user?.accountType === 'internal'
  ? 'Internal student'
  : user?.accountType === 'external' || user?.role === 'external'
    ? 'External student'
    : 'Student';

function summaryCard(label, value, caption) {
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(caption)}</small></article>`;
}

function participantRow(registration, record) {
  const user = registration.user;
  const name = user?.displayName || 'Account unavailable';
  const accountId = user?.enrollmentId || user?.username || 'Not provided';
  const status = record?.status === 'present' ? 'Present' : record?.status === 'absent' ? 'Marked absent' : 'No check-in';
  const statusClass = record?.status === 'present' ? 'present' : record?.status === 'absent' ? 'absent' : 'missing';
  const source = record ? (record.source === 'qr' ? 'QR check-in' : 'Manual correction') : '—';
  const recordedAt = record ? dateTime(record.recordedAt) : '—';

  return `<tr>
    <td><strong>${escapeHtml(name)}</strong></td>
    <td>${escapeHtml(accountId)}</td>
    <td>${escapeHtml(accountLabel(user))}</td>
    <td><span class="result result--${statusClass}">${status}</span></td>
    <td>${escapeHtml(recordedAt)}</td>
    <td>${escapeHtml(source)}</td>
  </tr>`;
}

export function buildAttendanceReportHtml({ event, registrations, attendance, generatedAt = new Date() }) {
  const activeSessions = (event.sessions ?? [])
    .filter((session) => session.status !== 'cancelled' && new Date(session.attendanceClosesAt) <= generatedAt)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const registered = registrations.filter((registration) => registration.user);
  const recordMap = new Map(attendance.map((record) => [`${record.sessionId}:${record.user}`, record]));
  const opportunities = registered.length * activeSessions.length;
  const presentCount = activeSessions.reduce((count, session) => count + registered.filter((registration) => {
    const record = recordMap.get(`${session._id}:${registration.user._id}`);
    return record?.status === 'present';
  }).length, 0);
  const attendanceRate = opportunities ? `${Math.round((presentCount / opportunities) * 100)}%` : 'N/A';
  const cancelledSessions = (event.sessions ?? []).filter((session) => session.status === 'cancelled').length;
  const sessionRows = activeSessions.map((session, index) => {
    const present = registered.filter((registration) => recordMap.get(`${session._id}:${registration.user._id}`)?.status === 'present').length;
    const rate = registered.length ? `${Math.round((present / registered.length) * 100)}%` : 'N/A';
    const sessionMode = session.mode ?? (event.mode === 'online' ? 'online' : 'in_person');
    const sessionVenue = sessionMode === 'online' ? 'Online' : session.venue || event.venue || 'Not provided';
    return `<tr>
      <td><span class="session-number">${String(index + 1).padStart(2, '0')}</span> ${escapeHtml(session.title)}</td>
      <td>${escapeHtml(dateTime(session.startsAt))} – ${escapeHtml(dateTime(session.endsAt))}</td>
      <td>${escapeHtml(modeLabel(sessionMode))} · ${escapeHtml(sessionVenue)}</td>
      <td>${present} / ${registered.length}</td>
      <td>${rate}</td>
    </tr>`;
  }).join('');

  const sessionSections = activeSessions.map((session, index) => {
    const rows = registered
      .slice()
      .sort((a, b) => String(a.user?.displayName ?? '').localeCompare(String(b.user?.displayName ?? '')))
      .map((registration) => participantRow(registration, recordMap.get(`${session._id}:${registration.user._id}`)))
      .join('');
    const present = registered.filter((registration) => recordMap.get(`${session._id}:${registration.user._id}`)?.status === 'present').length;
    const sessionMode = session.mode ?? (event.mode === 'online' ? 'online' : 'in_person');
    const sessionVenue = sessionMode === 'online' ? 'Online session' : session.venue || event.venue || 'Not provided';
    return `<section class="session-detail">
      <div class="session-heading">
        <div><span class="eyebrow">SESSION ${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(session.title)}</h2></div>
        <div class="session-count"><strong>${present}</strong><span>of ${registered.length} present</span></div>
      </div>
      <p class="session-meta"><strong>Format</strong> ${escapeHtml(modeLabel(sessionMode))} · ${escapeHtml(sessionVenue)}<br><strong>Event time</strong> ${escapeHtml(dateTime(session.startsAt))} – ${escapeHtml(dateTime(session.endsAt))}<br><strong>Check-in window</strong> ${escapeHtml(dateTime(session.attendanceOpensAt))} – ${escapeHtml(dateTime(session.attendanceClosesAt))}</p>
      ${registered.length ? `<div class="table-wrap"><table><thead><tr><th>Participant</th><th>Enrollment ID / username</th><th>Account</th><th>Result</th><th>Recorded (IST)</th><th>Method</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">There were no confirmed participants for this session.</p>'}
    </section>`;
  }).join('');

  const noSessionRoster = activeSessions.length === 0 && registered.length
    ? `<section class="session-detail"><div class="session-heading"><div><span class="eyebrow">PARTICIPANT REGISTER</span><h2>No attendance sessions recorded</h2></div><div class="session-count"><strong>${registered.length}</strong><span>confirmed</span></div></div><p class="empty">No completed attendance session was configured for this event. The participant list is included for event documentation; attendance cannot be determined.</p><div class="table-wrap"><table><thead><tr><th>Participant</th><th>Enrollment ID / username</th><th>Account</th><th>Attendance result</th></tr></thead><tbody>${registered.slice().sort((a, b) => String(a.user?.displayName ?? '').localeCompare(String(b.user?.displayName ?? ''))).map((registration) => `<tr><td><strong>${escapeHtml(registration.user?.displayName || 'Account unavailable')}</strong></td><td>${escapeHtml(registration.user?.enrollmentId || registration.user?.username || 'Not provided')}</td><td>${escapeHtml(accountLabel(registration.user))}</td><td><span class="result result--missing">Not recorded</span></td></tr>`).join('')}</tbody></table></div></section>`
    : '';

  const host = event.club?.name || (event.type === 'official' ? 'Campus administration' : 'Campusly club');
  const eventType = event.type === 'official' ? 'Campus event' : 'Club event';
  const venue = event.mode === 'online' ? 'Online event' : event.venue || 'Not provided';
  const filenameTitle = String(event.title ?? 'event').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || 'event';
  const title = escapeHtml(event.title || 'Campus event');
  const generatedLabel = dateTime(generatedAt);
  const summary = activeSessions.length
    ? `${presentCount} check-ins from ${opportunities} participant-session opportunities across ${activeSessions.length} completed session${activeSessions.length === 1 ? '' : 's'}.`
    : 'Attendance results are unavailable because this event has no completed attendance sessions.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${title} — Campusly attendance report</title>
  <style>
    :root{--navy:#172d59;--ink:#17243a;--muted:#66758d;--gold:#c6a15b;--line:#dfe4eb;--paper:#fff;--canvas:#eef1f5;--green:#18794e;--red:#a13d37}
    *{box-sizing:border-box}
    body{margin:0;background:var(--canvas);color:var(--ink);font-family:Inter,"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.5}
    .toolbar{position:sticky;top:0;z-index:3;display:flex;justify-content:flex-end;gap:10px;padding:14px max(20px,calc((100vw - 1080px)/2));background:#fff;border-bottom:1px solid var(--line)}
    .print-hint{align-self:center;color:var(--muted);font-size:12px}
    main{width:min(1080px,calc(100% - 32px));margin:26px auto 42px;padding:42px;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 14px 36px rgba(23,45,89,.08)}
    .masthead{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:21px;border-bottom:3px solid var(--gold)}
    .brand{color:var(--navy);font-size:16px;font-weight:800;letter-spacing:2px}.brand span{color:var(--gold)}
    .doc-kind{text-align:right;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    h1{max-width:820px;margin:26px 0 8px;color:var(--navy);font-family:Georgia,"Times New Roman",serif;font-size:34px;line-height:1.15;font-weight:600}
    .lede{margin:0;color:var(--muted);font-size:14px}
    .generated{margin-top:13px;color:#77849a;font-size:11px}
    .section-title{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:30px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
    .section-title h2{margin:0;color:var(--navy);font-family:Georgia,"Times New Roman",serif;font-size:20px;font-weight:600}
    .section-title span{color:var(--muted);font-size:11px}
    .event-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .detail{min-height:75px;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:#fbfcfe}
    .detail span,.metric span,.eyebrow{display:block;color:#79869c;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
    .detail strong{display:block;margin-top:4px;color:var(--ink);font-size:13px;font-weight:650;overflow-wrap:anywhere}
    .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
    .metric{display:flex;min-height:103px;flex-direction:column;justify-content:space-between;padding:14px;border-radius:9px;background:var(--navy);color:#fff}
    .metric span{color:#ccd5e6}.metric strong{font-size:26px;line-height:1.1}.metric small{color:#c2cde0;font-size:10px}
    .note{margin-top:14px;padding:12px 14px;border-left:3px solid var(--gold);background:#fbf8f0;color:#5c6471;font-size:12px}
    .table-wrap{width:100%;overflow:visible}
    table{width:100%;border-collapse:collapse;font-size:11px}
    thead{display:table-header-group}
    th{padding:9px 8px;background:#eff2f7;color:#53627a;text-align:left;font-size:9px;letter-spacing:.45px;text-transform:uppercase}
    td{padding:8px;border-bottom:1px solid #e8ebf0;color:#445269;vertical-align:top}
    td strong{color:#1d2c45;font-weight:650}
    tr{break-inside:avoid}
    .session-number{display:inline-grid;place-items:center;width:25px;height:22px;margin-right:5px;border-radius:5px;background:#f4ead4;color:#7d622e;font-size:10px;font-weight:700}
    .session-detail{margin-top:28px}
    .session-heading{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:8px}
    .session-heading h2{margin:4px 0 0;color:var(--navy);font-family:Georgia,"Times New Roman",serif;font-size:21px;font-weight:600}
    .session-count{display:flex;align-items:baseline;gap:6px;color:var(--muted);font-size:11px}
    .session-count strong{color:var(--navy);font-size:22px}
    .session-meta{margin:0 0 12px;color:var(--muted);font-size:11px;line-height:1.8}
    .session-meta strong{margin-right:5px;color:#445269}
    .result{display:inline-block;padding:3px 7px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
    .result--present{background:#e8f5ee;color:var(--green)}.result--absent{background:#fbecea;color:var(--red)}.result--missing{background:#f0f2f5;color:#68758a}
    .empty{padding:14px;border:1px dashed #cbd2dd;border-radius:8px;color:var(--muted);font-size:12px}
    footer{display:flex;justify-content:space-between;gap:20px;margin-top:36px;padding-top:12px;border-top:1px solid var(--line);color:#758198;font-size:10px}
    @media(max-width:700px){main{padding:22px;margin:14px auto}.event-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.masthead{flex-direction:column}.doc-kind{text-align:left}h1{font-size:28px}.table-wrap{overflow-x:auto}table{min-width:720px}}
    @page{size:A4 landscape;margin:13mm}
    @media print{body{background:white;font-size:10px}.toolbar{display:none}main{width:100%;max-width:none;margin:0;padding:0;border:0;border-radius:0;box-shadow:none}.masthead{padding-bottom:12px}h1{margin-top:17px;font-size:27px}.section-title{margin-top:20px}.detail{min-height:62px;padding:9px 11px}.metric{min-height:76px;padding:10px}.metric strong{font-size:21px}.session-detail{break-before:page;margin-top:0}.session-detail:first-of-type{break-before:auto}table{font-size:9px}th{padding:7px 6px;font-size:8px}td{padding:6px}footer{margin-top:20px;break-inside:avoid}}
  </style>
</head>
<body>
  <div class="toolbar"><span class="print-hint">To download a PDF copy, press Ctrl+P (or choose Print in your browser), then select “Save as PDF”.</span></div>
  <main>
    <header class="masthead"><div class="brand">CAMPUS<span>LY</span></div><div class="doc-kind">Event documentation<br>Attendance register</div></header>
    <h1>${title}</h1>
    <p class="lede">Official event attendance report</p>
    <p class="generated">Generated ${escapeHtml(generatedLabel)} IST · This report reflects Campusly records at the time it was prepared.</p>

    <div class="section-title"><h2>Event details</h2><span>${escapeHtml(eventType)} · ${escapeHtml(event.status)}</span></div>
    <section class="event-grid">
      <div class="detail"><span>Event schedule</span><strong>${escapeHtml(dateTime(event.startsAt))} – ${escapeHtml(dateTime(event.endsAt))} IST</strong></div>
      <div class="detail"><span>Format</span><strong>${escapeHtml(modeLabel(event.mode))}</strong></div>
      <div class="detail"><span>Location</span><strong>${escapeHtml(venue)}</strong></div>
      <div class="detail"><span>Organised by</span><strong>${escapeHtml(host)}</strong></div>
      <div class="detail"><span>Eligibility</span><strong>${escapeHtml(eligibilityLabel(event.eligibility))}</strong></div>
      <div class="detail"><span>Capacity</span><strong>${registered.length} confirmed · ${Number(event.capacity) || '—'} seats</strong></div>
    </section>

    <section class="metrics">
      ${summaryCard('Confirmed participants', registered.length, 'Active event registrations')}
      ${summaryCard('Completed sessions', activeSessions.length, cancelledSessions ? `${cancelledSessions} cancelled session${cancelledSessions === 1 ? '' : 's'} excluded` : 'Cancelled sessions excluded')}
      ${summaryCard('Recorded present', `${presentCount} / ${opportunities}`, 'Present check-ins across session places')}
      ${summaryCard('Overall attendance', attendanceRate, 'Present records ÷ participant-session places')}
    </section>
    <p class="note">${escapeHtml(summary)} “No check-in” means no attendance record was present when this report was generated. The displayed results include saved corrections and are a snapshot of Campusly records at preparation time.</p>

    <div class="section-title"><h2>Session overview</h2><span>Times shown in Indian Standard Time (IST)</span></div>
    ${activeSessions.length ? `<div class="table-wrap"><table><thead><tr><th>Session</th><th>Scheduled time</th><th>Format / location</th><th>Present / confirmed</th><th>Attendance</th></tr></thead><tbody>${sessionRows}</tbody></table></div>` : '<p class="empty">No completed attendance sessions were recorded for this event.</p>'}
    ${sessionSections}
    ${noSessionRoster}
    <footer><span>Campusly · Event organizer copy</span><span>${escapeHtml(filenameTitle)} · Generated ${escapeHtml(generatedLabel)} IST</span></footer>
  </main>
</body>
</html>`;
}
