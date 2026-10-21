import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardList, MapPin, QrCode, Send, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, jsonBody, messageOf } from '../api';
import type { Role } from '../auth/AuthContext';

type SessionRecord = { _id: string; title: string; date: string; startsAt: string; endsAt: string; attendanceOpensAt: string; attendanceClosesAt: string; status: string; attendanceStatus?: string };
type EventRecord = { _id: string; type: string; title: string; description: string; venue: string; startsAt: string; endsAt: string; registrationDeadline: string; capacity: number; reservedCount: number; eligibility: string; ticketType: 'free' | 'paid'; price: number; status: string; reviewFeedback?: string; club?: { name: string }; sessions?: SessionRecord[]; isEligible?: boolean; canManage?: boolean };
type RegistrationRecord = { _id: string; status: string; ticketCode?: string | null; user: { _id: string; username: string; displayName: string; email?: string; enrollmentId?: string; role: string } };
type AttendanceRecord = { _id: string; sessionId: string; status: string; source: string; recordedAt: string; user: { _id: string; username: string; displayName: string } };
type AuditRecord = { _id: string; action: string; reason: string; createdAt: string; actor?: { displayName: string; role: string }; before?: { status?: string } | null; after?: { status?: string } | null };
type EventDraft = { title: string; description: string; venue: string; startsAt: string; endsAt: string; registrationDeadline: string; capacity: string; eligibility: string; ticketType: 'free' | 'paid'; price: string };

const localDateTime = (value: string) => {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const displayDate = (value: string, time = true) => new Intl.DateTimeFormat('en-IN', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value));
const baseFor = (role: Role) => role === 'external' ? '/student' : `/${role}`;
const attendanceStatusFor = (session: SessionRecord, now = Date.now()) => session.status === 'cancelled'
  ? 'cancelled'
  : now < new Date(session.attendanceOpensAt).getTime()
    ? 'scheduled'
    : now <= new Date(session.attendanceClosesAt).getTime()
      ? 'open'
      : 'closed';

export function EventListPage({ role }: { role: Role }) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const base = baseFor(role);
  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (filter !== 'all' && (role === 'admin' || role === 'club')) params.set('status', filter);
      const queryString = params.toString();
      const suffix = queryString ? `?${queryString}` : '';
      const data = await api<{ events: EventRecord[] }>(role === 'admin' || role === 'club' ? `/api/events/manage${suffix}` : `/api/events${suffix}`);
      setEvents(data.events); setError('');
    } catch (reason) { setError(messageOf(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [role]);
  const filtered = useMemo(() => events.filter((event) => filter === 'all' || event.status === filter), [events, filter]);
  return <section className="tool-page"><div className="tool-page-heading"><div><span className="section-kicker">{role === 'admin' ? 'CAMPUS EVENT MANAGEMENT' : role === 'club' ? 'YOUR CLUB PROGRAMME' : 'DISCOVER YOUR CAMPUS'}</span><h1>{role === 'admin' ? 'Events and approvals.' : role === 'club' ? 'Your events.' : 'Find your next thing.'}</h1><p>{role === 'admin' ? 'Publish official events and review club submissions.' : role === 'club' ? 'Create an event draft, submit it, and manage approved gatherings.' : 'Browse events you can attend and keep your tickets in one place.'}</p></div>{(role === 'admin' || role === 'club') && <Link className="button button--primary" to={`${base}/events/new`}><CalendarDays size={16}/> Create event</Link>}</div>
    <div className="tool-toolbar"><form className="tool-search" onSubmit={(event) => { event.preventDefault(); void load(); }}><input aria-label="Search events" placeholder="Search events or venues" value={query} onChange={(event) => setQuery(event.target.value)}/><button className="button button--secondary">Search</button></form><select aria-label="Filter events" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="pending_approval">Pending approval</option><option value="draft">Draft</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected</option></select></div>
    {error && <div className="form-alert" role="alert">{error}</div>}{loading ? <div className="tool-empty">Loading events…</div> : filtered.length ? <div className="workspace-event-grid">{filtered.map((event) => <article className="workspace-event-card" key={event._id}><div className="public-event-card-top"><span className={`event-type-pill event-type-pill--${event.type}`}>{event.type === 'official' ? 'Campus event' : event.club?.name ?? 'Club event'}</span><span className={`status-pill status-pill--${event.status}`}>{event.status.replaceAll('_', ' ')}</span></div><h2>{event.title}</h2><p>{event.description}</p><div className="event-meta"><span><CalendarDays size={14}/>{displayDate(event.startsAt, false)}</span><span><MapPin size={14}/>{event.venue}</span></div><div className="workspace-event-footer"><span>{event.reservedCount} / {event.capacity} seats · {event.ticketType === 'free' ? 'Free' : `₹${event.price} demo`}</span><Link className="text-link" to={`${base}/events/${event._id}`}>Open <ArrowRight size={14}/></Link></div>{event.reviewFeedback && <div className="review-feedback"><strong>Review feedback</strong><span>{event.reviewFeedback}</span></div>}</article>)}</div> : <div className="tool-empty"><CalendarDays size={24}/><strong>No events match this view.</strong><span>Create a new event or change the status filter.</span></div>}
  </section>;
}

const emptyDraft: EventDraft = { title: '', description: '', venue: '', startsAt: '', endsAt: '', registrationDeadline: '', capacity: '100', eligibility: 'all', ticketType: 'free', price: '0' };

export function EventFormPage({ role }: { role: Role }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<EventDraft>(emptyDraft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = baseFor(role);
  function update<K extends keyof EventDraft>(key: K, value: EventDraft[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api<{ event: EventRecord }>('/api/events', { method: 'POST', body: jsonBody({ ...form, capacity: Number(form.capacity), price: Number(form.price), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), registrationDeadline: new Date(form.registrationDeadline).toISOString() }) });
      navigate(`${base}/events/${data.event._id}`);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  return <section className="tool-page"><Link className="back-link" to={`${base}/events`}><ArrowLeft size={15}/> Back to events</Link><div className="tool-page-heading"><div><span className="section-kicker">{role === 'admin' ? 'OFFICIAL CAMPUS EVENT' : 'CLUB EVENT DRAFT'}</span><h1>{role === 'admin' ? 'Create a campus event.' : 'Start a new gathering.'}</h1><p>{role === 'admin' ? 'Official events publish immediately after creation.' : 'Club events stay in draft until your admin approves them.'}</p></div></div>{error && <div className="form-alert" role="alert">{error}</div>}
    <form className="tool-form tool-form--wide" onSubmit={save}><div className="tool-form-grid"><label>Event title<input required minLength={5} maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)}/></label><label>Venue<input required minLength={2} maxLength={240} value={form.venue} onChange={(e) => update('venue', e.target.value)}/></label><label className="tool-field-full">Description<textarea required minLength={20} maxLength={5000} rows={5} value={form.description} onChange={(e) => update('description', e.target.value)}/></label><label>Starts at<input type="datetime-local" required value={form.startsAt} onChange={(e) => update('startsAt', e.target.value)}/></label><label>Ends at<input type="datetime-local" required value={form.endsAt} onChange={(e) => update('endsAt', e.target.value)}/></label><label>Registration deadline<input type="datetime-local" required value={form.registrationDeadline} onChange={(e) => update('registrationDeadline', e.target.value)}/></label><label>Capacity<input type="number" required min={1} max={100000} value={form.capacity} onChange={(e) => update('capacity', e.target.value)}/></label><label>Eligibility<select value={form.eligibility} onChange={(e) => update('eligibility', e.target.value)}><option value="all">Internal and external students</option><option value="internal">Internal MIT students</option><option value="external">External students</option></select></label><label>Ticket type<select value={form.ticketType} onChange={(e) => { update('ticketType', e.target.value as EventDraft['ticketType']); if (e.target.value === 'free') update('price', '0'); }}><option value="free">Free</option><option value="paid">Paid · demo payment</option></select></label>{form.ticketType === 'paid' && <label>Price (₹)<input type="number" min={1} step="1" max={10000000} value={form.price} onChange={(e) => update('price', e.target.value)}/><small>Payment outcomes are simulated by the server. No real money is collected.</small></label>}</div><div className="tool-form-actions"><button className="button button--primary" disabled={busy}>{busy ? 'Saving…' : role === 'admin' ? 'Publish official event' : 'Save club draft'} <ArrowRight size={15}/></button></div></form>
  </section>;
}

function EventEditForm({ event, onSave, onCancel, busy }: { event: EventRecord; onSave: (body: Record<string, unknown>) => void; onCancel: () => void; busy: boolean }) {
  const [form, setForm] = useState<EventDraft>({ title: event.title, description: event.description, venue: event.venue, startsAt: localDateTime(event.startsAt), endsAt: localDateTime(event.endsAt), registrationDeadline: localDateTime(event.registrationDeadline), capacity: String(event.capacity), eligibility: event.eligibility, ticketType: event.ticketType, price: String(event.price) });
  function update<K extends keyof EventDraft>(key: K, value: EventDraft[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function save(eventForm: FormEvent) {
    eventForm.preventDefault();
    onSave({ ...form, capacity: Number(form.capacity), price: Number(form.price), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), registrationDeadline: new Date(form.registrationDeadline).toISOString() });
  }
  return <form className="tool-form tool-form--wide event-edit-form" onSubmit={save}><div className="tool-page-heading"><div><span className="section-kicker">EVENT DETAILS</span><h2>Edit event</h2></div><button className="button button--secondary button--small" type="button" onClick={onCancel}>Close</button></div><div className="tool-form-grid"><label>Title<input required minLength={5} maxLength={140} value={form.title} onChange={(e) => update('title', e.target.value)}/></label><label>Venue<input required value={form.venue} onChange={(e) => update('venue', e.target.value)}/></label><label className="tool-field-full">Description<textarea required minLength={20} maxLength={5000} rows={4} value={form.description} onChange={(e) => update('description', e.target.value)}/></label><label>Starts at<input type="datetime-local" required value={form.startsAt} onChange={(e) => update('startsAt', e.target.value)}/></label><label>Ends at<input type="datetime-local" required value={form.endsAt} onChange={(e) => update('endsAt', e.target.value)}/></label><label>Registration deadline<input type="datetime-local" required value={form.registrationDeadline} onChange={(e) => update('registrationDeadline', e.target.value)}/></label><label>Capacity<input type="number" required min={1} max={100000} value={form.capacity} onChange={(e) => update('capacity', e.target.value)}/></label><label>Eligibility<select value={form.eligibility} onChange={(e) => update('eligibility', e.target.value)}><option value="all">All students</option><option value="internal">Internal students</option><option value="external">External students</option></select></label><label>Ticket type<select value={form.ticketType} onChange={(e) => { update('ticketType', e.target.value as EventDraft['ticketType']); if (e.target.value === 'free') update('price', '0'); }}><option value="free">Free</option><option value="paid">Paid · demo payment</option></select></label>{form.ticketType === 'paid' && <label>Price (₹)<input type="number" min={1} step="1" value={form.price} onChange={(e) => update('price', e.target.value)}/></label>}</div><button className="button button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></form>;
}

function QrSession({ eventId, session, attendanceStatus }: { eventId: string; session: SessionRecord; attendanceStatus: string }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (attendanceStatus !== 'open') {
      if (open) { setOpen(false); setToken(''); }
      return;
    }
    if (!open) return;
    let active = true;
    const refresh = async () => {
      try { const data = await api<{ token: string }>(`/api/events/${eventId}/sessions/${session._id}/qr-token`, { method: 'POST' }); if (active) { setToken(data.token); setError(''); } }
      catch (reason) { if (active) { setToken(''); setError(messageOf(reason)); } }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 4500);
    return () => { active = false; window.clearInterval(interval); };
  }, [eventId, session._id, open, attendanceStatus]);
  if (attendanceStatus === 'scheduled') return <p className="session-window-state">QR check-in opens {displayDate(session.attendanceOpensAt)}.</p>;
  if (attendanceStatus !== 'open') return <p className="session-window-state">The attendance window is closed.</p>;
  if (!open) return <button className="button button--secondary" type="button" onClick={() => setOpen(true)}><QrCode size={14}/> Open rotating QR</button>;
  return <div className="qr-session-card"><div><span className="section-kicker">ROTATING CHECK-IN CODE · REFRESHES EVERY 5 SECONDS</span><h3>{session.title}</h3><p>{displayDate(session.attendanceOpensAt)} – {displayDate(session.attendanceClosesAt)}</p><button className="button button--secondary" type="button" onClick={() => { setOpen(false); setToken(''); }}><QrCode size={14}/> Close QR</button></div>{token ? <div className="qr-code-box"><QRCodeSVG value={token} size={164} level="M" includeMargin/><small>Students scan at <b>/scan</b></small></div> : <div className="qr-code-placeholder">{error || 'Preparing current code…'}</div>}</div>;
}

export function EventDetailPage({ role }: { role: Role }) {
  const { eventId = '' } = useParams();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [bookings, setBookings] = useState<Array<{ _id: string; status: string; event: string | { _id: string }; ticketCode?: string }>>([]);
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [sessionForm, setSessionForm] = useState({ title: '', date: '', startsAt: '', endsAt: '', attendanceOpensAt: '', attendanceClosesAt: '' });
  const [correction, setCorrection] = useState({ sessionId: '', userId: '', status: 'present', reason: '' });
  const [notifyForm, setNotifyForm] = useState({ title: '', message: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const base = baseFor(role);
  const managerRole = role === 'admin' || role === 'club';
  const manager = managerRole && Boolean(event?.canManage);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function load() {
    setError('');
    try {
      const result = await api<{ event: EventRecord }>(`/api/events/${eventId}`);
      setEvent(result.event);
      const canManageEvent = managerRole && Boolean(result.event.canManage);
      if (!canManageEvent) {
        const data = await api<{ bookings: Array<{ _id: string; status: string; event: string | { _id: string }; ticketCode?: string }> }>('/api/bookings');
        setBookings(data.bookings.filter((item) => (typeof item.event === 'string' ? item.event : item.event?._id) === eventId));
      } else {
        const [registrationData, attendanceData] = await Promise.all([
          api<{ registrations: RegistrationRecord[] }>(`/api/events/${eventId}/registrations`),
          api<{ attendance: AttendanceRecord[]; audit: AuditRecord[] }>(`/api/events/${eventId}/attendance`),
        ]);
        setRegistrations(registrationData.registrations);
        setAttendance(attendanceData.attendance);
        setAudit(attendanceData.audit);
      }
    } catch (reason) { setError(messageOf(reason)); }
  }
  useEffect(() => { void load(); }, [eventId, role]);

  async function action(path: string, body: unknown, success: string): Promise<boolean> {
    setBusy(true); setError(''); setMessage('');
    try { const result = await api<{ message?: string }>(path, { method: 'POST', body: jsonBody(body) }); setMessage(result.message ?? success); await load(); return true; }
    catch (reason) { setError(messageOf(reason)); return false; }
    finally { setBusy(false); }
  }

  async function saveEdit(body: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('');
    try { await api(`/api/events/${eventId}`, { method: 'PATCH', body: jsonBody(body) }); setMessage('Event changes saved. Material changes to approved club events are now waiting for admin approval.'); setEditOpen(false); await load(); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function cancelSession(sessionId: string) {
    setBusy(true); setError(''); setMessage('');
    try { await api(`/api/events/${eventId}/sessions/${sessionId}`, { method: 'PATCH', body: jsonBody({ status: 'cancelled' }) }); setMessage('Session cancelled. It will not count toward attendance.'); await load(); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function submitSession(e: FormEvent) {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(sessionForm).map(([key, value]) => [key, key === 'title' ? value : new Date(key === 'date' ? `${value}T12:00:00` : value).toISOString()]));
    if (await action(`/api/events/${eventId}/sessions`, body, 'Session added.')) {
      setSessionForm({ title: '', date: '', startsAt: '', endsAt: '', attendanceOpensAt: '', attendanceClosesAt: '' });
    }
  }

  async function correctAttendance(e: FormEvent) {
    e.preventDefault();
    if (await action(`/api/events/${eventId}/attendance/correction`, correction, 'Attendance correction saved and audited.')) {
      setCorrection((current) => ({ ...current, reason: '' }));
    }
  }

  if (error && !event) return <section className="tool-page"><Link className="back-link" to={`${base}/events`}><ArrowLeft size={15}/> Back to events</Link><div className="form-alert">{error}</div></section>;
  if (!event) return <section className="tool-page"><div className="tool-empty">Loading event…</div></section>;
  const activeBooking = bookings.find((booking) => booking.status === 'confirmed');
  const eventSessions = event.sessions ?? [];
  const completedSessions = eventSessions.filter((session) => attendanceStatusFor(session, clock) === 'closed');
  const registrationOpen = event.status === 'published' && new Date(event.startsAt).getTime() > clock && new Date(event.registrationDeadline).getTime() > clock;
  return <section className="tool-page"><Link className="back-link" to={`${base}/events`}><ArrowLeft size={15}/> Back to events</Link>{error && <div className="form-alert" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}
    <article className="event-detail-workspace"><div className="event-detail-overline"><span className={`event-type-pill event-type-pill--${event.type}`}>{event.type === 'official' ? 'Campus event' : event.club?.name ?? 'Club event'}</span><span className={`status-pill status-pill--${event.status}`}>{event.status.replaceAll('_', ' ')}</span></div><h1>{event.title}</h1><p className="event-detail-description">{event.description}</p><div className="event-meta event-meta--large"><span><CalendarDays size={16}/>{displayDate(event.startsAt)}</span><span><MapPin size={16}/>{event.venue}</span><span><Users size={16}/>{event.reservedCount} / {event.capacity} seats</span></div>
      <div className="event-policy-grid"><div><small>ELIGIBILITY</small><strong>{event.eligibility === 'all' ? 'Internal and external students' : event.eligibility === 'internal' ? 'Internal MIT students' : 'External students'}</strong></div><div><small>REGISTRATION CLOSES</small><strong>{displayDate(event.registrationDeadline)}</strong></div><div><small>TICKET</small><strong>{event.ticketType === 'free' ? 'Free' : `₹${event.price} · simulated`}</strong></div></div>{eventSessions.length > 0 && <div className="public-session-list"><span className="section-kicker">EVENT SCHEDULE</span>{eventSessions.map((session) => <div className="public-session-row" key={session._id}><strong>{session.title}</strong><span>{displayDate(session.startsAt)} – {displayDate(session.endsAt)}</span><small>{session.status === 'cancelled' ? 'Cancelled' : `Attendance window · ${displayDate(session.attendanceOpensAt)} – ${displayDate(session.attendanceClosesAt)}`}</small></div>)}</div>}{event.reviewFeedback && <div className="review-feedback"><strong>Admin feedback</strong><span>{event.reviewFeedback}</span></div>}
      {!managerRole && <div className="event-register-box">{activeBooking ? <div className="form-success"><strong>Ticket confirmed · {activeBooking.ticketCode}</strong><span>Open My bookings to see payment history and cancel before the event.</span></div> : <><span>{event.ticketType === 'paid' ? `₹${event.price} · simulated demo payment, no real money charged.` : 'Free registration. Your ticket will be issued after confirmation.'}</span><button className="button button--primary" disabled={busy || !event.isEligible || !registrationOpen} onClick={() => void action(`/api/events/${eventId}/register`, {}, 'Registration processed.')}>{busy ? 'Processing…' : event.ticketType === 'paid' ? 'Try demo payment' : 'Register for free'} <ArrowRight size={15}/></button>{!event.isEligible && <small>This event is not eligible for your account type.</small>}{event.isEligible && !registrationOpen && <small>Registration is closed for this event.</small>}</>}</div>}
      {manager && event.status !== 'cancelled' && event.status !== 'completed' && <div className="button-row"><button className="button button--secondary" type="button" onClick={() => setEditOpen((open) => !open)}>Edit event</button>{role === 'admin' && event.status !== 'cancelled' && <button className="button button--danger" type="button" disabled={busy} onClick={() => void action(`/api/events/${eventId}/cancel`, { reason: 'Cancelled by campus administrator.' }, 'Event cancelled; bookings and simulated refunds were processed.')}>Cancel event</button>}{role === 'club' && ['draft', 'changes_requested', 'rejected'].includes(event.status) && <button className="button button--primary" disabled={busy} onClick={() => void action(`/api/events/${eventId}/submit`, {}, 'Event submitted for admin approval.')}>Submit for approval <ArrowRight size={15}/></button>}</div>}
      {manager && editOpen && <EventEditForm event={event} busy={busy} onCancel={() => setEditOpen(false)} onSave={(body) => void saveEdit(body)}/>}
      {manager && role === 'admin' && event.status === 'pending_approval' && <div className="review-box"><h2>Review club submission</h2><label>Feedback <textarea rows={3} value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} placeholder="Add feedback when requesting changes or rejecting."/></label><div className="button-row"><button className="button button--primary" disabled={busy} onClick={() => void action(`/api/events/${eventId}/review`, { decision: 'approve', feedback: reviewFeedback }, 'Event approved and published.')}>Approve and publish</button><button className="button button--secondary" disabled={busy || reviewFeedback.trim().length < 3} onClick={() => void action(`/api/events/${eventId}/review`, { decision: 'changes_requested', feedback: reviewFeedback }, 'Changes requested.')}>Request changes</button><button className="button button--danger" disabled={busy || reviewFeedback.trim().length < 3} onClick={() => void action(`/api/events/${eventId}/review`, { decision: 'reject', feedback: reviewFeedback }, 'Event rejected.')}>Reject</button></div></div>}
    </article>

    {manager && <div className="tool-two-column"><section className="tool-panel"><div className="panel-heading"><div><span className="section-kicker">EVENT SCHEDULE</span><h2>Sessions and check-in</h2></div><CalendarDays size={18}/></div>{eventSessions.length ? <div className="session-list">{eventSessions.map((session) => { const attendanceStatus = attendanceStatusFor(session, clock); return <article className="session-card" key={session._id}><div className="session-card-heading"><div><h3>{session.title}</h3><p>{displayDate(session.startsAt)} – {displayDate(session.endsAt)}</p><small>Attendance: {displayDate(session.attendanceOpensAt)} – {displayDate(session.attendanceClosesAt)}</small></div><span className={`status-pill status-pill--${attendanceStatus}`}>{attendanceStatus}</span></div>{attendanceStatus !== 'cancelled' && <QrSession eventId={eventId} session={session} attendanceStatus={attendanceStatus}/>}<div className="button-row"><button className="button button--secondary" type="button" disabled={busy || attendanceStatus !== 'closed'} onClick={() => setCorrection((current) => ({ ...current, sessionId: session._id }))}>{attendanceStatus === 'closed' ? 'Correct attendance' : 'Corrections open after session'}</button>{attendanceStatus !== 'cancelled' && <button className="button button--danger" type="button" disabled={busy} onClick={() => void cancelSession(session._id)}>Cancel session</button>}</div></article>; })}</div> : <div className="tool-empty">Add a session to enable attendance check-in.</div>}
      <form className="tool-form session-form" onSubmit={submitSession}><h3>Add an attendance session</h3><div className="tool-form-grid"><label>Session title<input required value={sessionForm.title} onChange={(e) => setSessionForm((current) => ({ ...current, title: e.target.value }))}/></label><label>Session date<input type="date" required value={sessionForm.date} onChange={(e) => setSessionForm((current) => ({ ...current, date: e.target.value }))}/></label><label>Starts at<input type="datetime-local" required value={sessionForm.startsAt} onChange={(e) => setSessionForm((current) => ({ ...current, startsAt: e.target.value }))}/></label><label>Ends at<input type="datetime-local" required value={sessionForm.endsAt} onChange={(e) => setSessionForm((current) => ({ ...current, endsAt: e.target.value }))}/></label><label>Attendance opens<input type="datetime-local" required value={sessionForm.attendanceOpensAt} onChange={(e) => setSessionForm((current) => ({ ...current, attendanceOpensAt: e.target.value }))}/></label><label>Attendance closes<input type="datetime-local" required value={sessionForm.attendanceClosesAt} onChange={(e) => setSessionForm((current) => ({ ...current, attendanceClosesAt: e.target.value }))}/></label></div><button className="button button--primary" disabled={busy}>Add session</button></form>
    </section><section className="tool-panel"><div className="panel-heading"><div><span className="section-kicker">PARTICIPANTS</span><h2>Registrations · {registrations.filter((item) => item.status === 'confirmed').length}</h2></div><ClipboardList size={18}/></div>{registrations.length ? <div className="table-scroll"><table className="tool-table"><thead><tr><th>Student</th><th>Account</th><th>Ticket</th></tr></thead><tbody>{registrations.map((item) => <tr key={item._id}><td><strong>{item.user.displayName}</strong><small>{item.user.username}</small></td><td>{item.user.role}</td><td>{item.ticketCode ?? item.status}</td></tr>)}</tbody></table></div> : <div className="tool-empty">No registrations yet.</div>}
      <form className="tool-form notify-event-form" onSubmit={async (e) => { e.preventDefault(); if (await action(`/api/events/${eventId}/notify`, notifyForm, 'Notification sent to confirmed participants.')) setNotifyForm({ title: '', message: '' }); }}><h3>Notify participants</h3><label>Title<input required maxLength={120} value={notifyForm.title} onChange={(e) => setNotifyForm((current) => ({ ...current, title: e.target.value }))}/></label><label>Message<textarea required maxLength={2000} rows={3} value={notifyForm.message} onChange={(e) => setNotifyForm((current) => ({ ...current, message: e.target.value }))}/></label><button className="button button--secondary" disabled={busy}><Send size={14}/> Send update</button></form>
    </section></div>}

    {manager && <section className="tool-panel attendance-manager-panel"><div className="panel-heading"><div><span className="section-kicker">ATTENDANCE REGISTER</span><h2>Check-ins and corrections</h2></div><Users size={18}/></div>{attendance.length ? <div className="table-scroll"><table className="tool-table"><thead><tr><th>Student</th><th>Session</th><th>Status</th><th>Source</th><th>Recorded</th></tr></thead><tbody>{attendance.map((item) => <tr key={item._id}><td>{item.user.displayName}<small>{item.user.username}</small></td><td>{eventSessions.find((session) => session._id === item.sessionId)?.title ?? 'Session'}</td><td>{item.status}</td><td>{item.source}</td><td>{displayDate(item.recordedAt)}</td></tr>)}</tbody></table></div> : <div className="tool-empty">No check-ins recorded yet.</div>}
      <form className="correction-form" onSubmit={correctAttendance}><label>Session<select required value={correction.sessionId} onChange={(e) => setCorrection((current) => ({ ...current, sessionId: e.target.value }))}><option value="">Choose a completed session</option>{completedSessions.map((session) => <option key={session._id} value={session._id}>{session.title} · {displayDate(session.date, false)}</option>)}</select></label><label>Registered student<select required value={correction.userId} onChange={(e) => setCorrection((current) => ({ ...current, userId: e.target.value }))}><option value="">Choose a student</option>{registrations.filter((item) => item.status === 'confirmed').map((item) => <option key={item.user._id} value={item.user._id}>{item.user.displayName} · {item.user.username}</option>)}</select></label><label>Mark as<select value={correction.status} onChange={(e) => setCorrection((current) => ({ ...current, status: e.target.value }))}><option value="present">Present</option><option value="absent">Absent</option></select></label><label>Reason<input required minLength={3} maxLength={1000} value={correction.reason} onChange={(e) => setCorrection((current) => ({ ...current, reason: e.target.value }))} placeholder="Explain the correction"/></label><button className="button button--primary" disabled={busy || completedSessions.length === 0}>Save correction</button>{completedSessions.length === 0 && <small>Corrections are available after an attendance window closes.</small>}</form>{audit.length > 0 && <div className="audit-history"><h3>Correction audit history</h3>{audit.map((item) => <div className="audit-row" key={item._id}><strong>{item.actor?.displayName ?? 'Administrator'}</strong><span>{item.before?.status ?? 'no record'} → {item.after?.status ?? 'updated'}</span><p>{item.reason}</p><time>{displayDate(item.createdAt)}</time></div>)}</div>}
    </section>}
  </section>;
}
