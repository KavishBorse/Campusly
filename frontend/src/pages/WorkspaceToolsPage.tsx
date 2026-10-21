import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, CalendarDays, Check, Download, KeyRound, QrCode, Send, Users } from 'lucide-react';
import { api, jsonBody, messageOf } from '../api';
import type { Role } from '../auth/AuthContext';

type UserRow = { _id: string; username: string; displayName: string; email?: string; enrollmentId?: string; role: string; status: string; emailVerified?: boolean };
type ClubRow = { _id: string; name: string; slug: string; description: string; status: string; user: UserRow };
type NotificationRow = { _id: string; title: string; message: string; createdAt: string; readAt?: string | null; sender?: { displayName: string; role: string }; event?: { title: string } | null };
type SentNotification = { batchId: string; title: string; message: string; createdAt: string; recipientCount: number; eventTitle?: string };
type BookingRow = { _id: string; status: string; paymentType: string; amount: number; ticketCode?: string; createdAt: string; event: { _id: string; title: string; startsAt: string; venue: string; status: string }; user?: { displayName: string; username: string; role: string } };
type PaymentRow = { booking: string; status: string; amount: number; message: string; createdAt: string };

export function AccountsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', description: '' });
  const [resetPassword, setResetPassword] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try { const [userData, clubData] = await Promise.all([api<{ users: UserRow[] }>('/api/admin/users'), api<{ clubs: ClubRow[] }>('/api/admin/clubs')]); setUsers(userData.users); setClubs(clubData.clubs); }
    catch (reason) { setError(messageOf(reason)); }
  }
  useEffect(() => { void load(); }, []);
  async function createClub(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/api/admin/clubs', { method: 'POST', body: jsonBody(form) }); setForm({ name: '', username: '', email: '', password: '', description: '' }); setNotice('Club account created. Share the username and temporary password securely. The club must change it after sign-in.'); await load(); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function resetClub(clubId: string) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/api/admin/clubs/${clubId}/reset-password`, { method: 'POST', body: jsonBody({ password: resetPassword[clubId] }) }); setResetPassword((current) => ({ ...current, [clubId]: '' })); setNotice('Password reset. The club will be asked to choose a new password at next sign-in.'); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function changeStatus(user: UserRow) {
    const status = user.status === 'active' ? 'suspended' : 'active';
    setError('');
    try { await api(`/api/admin/users/${user._id}/status`, { method: 'PATCH', body: jsonBody({ status }) }); setNotice(`${user.displayName} is now ${status}.`); await load(); }
    catch (reason) { setError(messageOf(reason)); }
  }
  return <section className="tool-page"><div className="tool-page-heading"><div><span className="section-kicker">ADMIN CONSOLE</span><h1>Accounts and clubs.</h1><p>Create club workspaces, reset access, and manage account status.</p></div><span className="metric-icon"><Users size={18}/></span></div>{error && <div className="form-alert" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
    <div className="tool-two-column"><section className="tool-panel"><div className="panel-heading"><div><span className="section-kicker">CLUB MANAGEMENT</span><h2>Create a club account</h2></div><Users size={18}/></div><form className="tool-form" onSubmit={createClub}><label>Club name<input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}/></label><label>Username<input required minLength={3} maxLength={120} value={form.username} onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))}/></label><label>Email (optional)<input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}/></label><label>Temporary password<input required type="password" minLength={12} maxLength={256} value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}/><small>At least 12 characters. Club must change it on first login.</small></label><label>Description<textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}/></label><button className="button button--primary" disabled={busy}>Create club <ArrowRight size={15}/></button></form></section>
      <section className="tool-panel"><div className="panel-heading"><div><span className="section-kicker">CLUB WORKSPACES · {clubs.length}</span><h2>Club credentials</h2></div><KeyRound size={18}/></div>{clubs.length ? <div className="club-account-list">{clubs.map((club) => <article className="club-account-row" key={club._id}><div><strong>{club.name}</strong><small>{club.user?.username} · {club.status}</small></div><div className="inline-password-reset"><input aria-label={`New password for ${club.name}`} type="password" minLength={12} placeholder="New password (12+ chars)" value={resetPassword[club._id] ?? ''} onChange={(e) => setResetPassword((current) => ({ ...current, [club._id]: e.target.value }))}/><button className="button button--secondary" disabled={busy || (resetPassword[club._id] ?? '').length < 12} onClick={() => void resetClub(club._id)} type="button">Reset</button></div></article>)}</div> : <div className="tool-empty">No club accounts yet.</div>}</section></div>
    <section className="tool-panel accounts-table-panel"><div className="panel-heading"><div><span className="section-kicker">USER DIRECTORY · {users.length}</span><h2>Campus accounts</h2></div><Users size={18}/></div>{users.length ? <div className="table-scroll"><table className="tool-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Email</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user._id}><td><strong>{user.displayName}</strong>{user.enrollmentId && <small>{user.enrollmentId}</small>}</td><td>{user.username}</td><td>{user.role}{user.role === 'external' && <small>{user.emailVerified ? 'Email verified' : 'Unverified'}</small>}</td><td><span className={`status-pill status-pill--${user.status}`}>{user.status}</span></td><td>{user.email ?? '—'}</td><td>{user.role !== 'admin' && <button className="button button--secondary button--small" type="button" onClick={() => void changeStatus(user)}>{user.status === 'active' ? 'Suspend' : 'Activate'}</button>}</td></tr>)}</tbody></table></div> : <div className="tool-empty">No accounts found.</div>}</section>
  </section>;
}

export function NotificationsPage({ role }: { role: Role }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [sentItems, setSentItems] = useState<SentNotification[]>([]);
  const [events, setEvents] = useState<Array<{ _id: string; title: string }>>([]);
  const [targetUsers, setTargetUsers] = useState<UserRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [audience, setAudience] = useState(role === 'admin' ? 'all' : 'event');
  const [eventId, setEventId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const data = await api<{ notifications: NotificationRow[] }>('/api/notifications');
      setItems(data.notifications);
      if (role === 'admin' || role === 'club') {
        const sent = await api<{ messages: SentNotification[] }>('/api/notifications/sent');
        setSentItems(sent.messages);
      }
    }
    catch (reason) { setError(messageOf(reason)); }
  }
  useEffect(() => {
    void load();
    if (role === 'admin' || role === 'club') void api<{ events: Array<{ _id: string; title: string }> }>('/api/events/manage').then((data) => setEvents(data.events.filter((item) => item.title))).catch((reason) => setError(messageOf(reason)));
    if (role === 'admin') {
      void api<{ users: UserRow[] }>('/api/admin/users').then(({ users }) => {
        setTargetUsers(users.filter((item) => item.status === 'active' && (item.role === 'student' || (item.role === 'external' && item.emailVerified))));
      }).catch((reason) => setError(messageOf(reason)));
    }
  }, [role]);
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const endpoint = audience === 'event' && role === 'club' ? `/api/events/${eventId}/notify` : '/api/notifications/send';
      const body = audience === 'event' && role === 'admin' ? { title, message, audience, eventId } : audience === 'event' ? { title, message } : audience === 'selected' ? { title, message, audience, userIds: selectedUserIds } : { title, message, audience };
      const result = await api<{ sent: number }>(endpoint, { method: 'POST', body: jsonBody(body) });
      setNotice(`Sent to ${result.sent} account${result.sent === 1 ? '' : 's'}.`); setTitle(''); setMessage(''); setSelectedUserIds([]); await load();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function markRead(id: string) {
    try { await api(`/api/notifications/${id}/read`, { method: 'PATCH' }); await load(); }
    catch (reason) { setError(messageOf(reason)); }
  }
  return <section className="tool-page"><div className="tool-page-heading"><div><span className="section-kicker">CAMPUS UPDATES</span><h1>Notifications.</h1><p>In-app updates for your account and relevant events.</p></div><Bell size={20}/></div>{error && <div className="form-alert" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
    {(role === 'admin' || role === 'club') && <section className="tool-panel"><div className="panel-heading"><div><span className="section-kicker">MESSAGE COMPOSER</span><h2>{role === 'admin' ? 'Send a campus update' : 'Notify event participants'}</h2></div><Send size={18}/></div><form className="notification-composer" onSubmit={send}><label>Audience<select value={audience} onChange={(e) => setAudience(e.target.value)}>{role === 'admin' ? <><option value="all">All students</option><option value="internal">Internal students</option><option value="external">Verified external students</option><option value="event">Confirmed participants for an event</option><option value="selected">Selected students</option></> : <option value="event">Confirmed participants for my event</option>}</select></label>{audience === 'event' && <label>Event<select required value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Select an event</option>{events.map((event) => <option key={event._id} value={event._id}>{event.title}</option>)}</select></label>}{audience === 'selected' && <label className="selected-students-field">Students · {selectedUserIds.length} selected<select multiple size={5} value={selectedUserIds} onChange={(e) => setSelectedUserIds(Array.from(e.currentTarget.selectedOptions, (option) => option.value))}>{targetUsers.map((user) => <option key={user._id} value={user._id}>{user.displayName} · {user.username}{user.role === 'external' ? ' · external' : ' · internal'}</option>)}</select><small>Choose up to 200 active internal students or verified external students. Use Ctrl or Shift to select several.</small></label>}<label>Title<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}/></label><label>Message<textarea required rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}/></label><button className="button button--primary" disabled={busy || (audience === 'event' && !eventId) || (audience === 'selected' && (selectedUserIds.length === 0 || selectedUserIds.length > 200))}>{busy ? 'Sending…' : 'Send notification'} <Send size={15}/></button></form></section>}
    {(role === 'admin' || role === 'club') && <section className="tool-panel sent-history-panel"><div className="panel-heading"><div><span className="section-kicker">SENT HISTORY · {sentItems.length}</span><h2>Recent messages</h2></div><Send size={18}/></div>{sentItems.length ? <div className="sent-message-list">{sentItems.map((item) => <article className="sent-message-row" key={item.batchId}><div><strong>{item.title}</strong><p>{item.message}</p><small>{item.eventTitle ? `${item.eventTitle} · ` : ''}{item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'} · {new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.createdAt))}</small></div></article>)}</div> : <div className="tool-empty">Messages you send will appear here.</div>}</section>}
    <section className="notification-list">{items.length ? items.map((item) => <article className={`notification-card ${item.readAt ? '' : 'notification-card--unread'}`} key={item._id}><div className="notification-card-icon"><Bell size={16}/></div><div className="notification-card-content"><div className="notification-card-heading"><h2>{item.title}</h2><time>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.createdAt))}</time></div><p>{item.message}</p><small>From {item.sender?.displayName ?? 'Campusly'}{item.event?.title ? ` · ${item.event.title}` : ''}</small></div>{!item.readAt && <button className="button button--secondary button--small" onClick={() => void markRead(item._id)} type="button"><Check size={14}/> Mark read</button>}</article>) : <div className="tool-empty"><Bell size={24}/><strong>You’re all caught up.</strong><span>New event and campus updates will appear here.</span></div>}</section>
  </section>;
}

export function BookingsPage({ role }: { role: Role }) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    try { const data = await api<{ bookings: BookingRow[]; payments: PaymentRow[] }>(role === 'admin' ? '/api/admin/bookings' : '/api/bookings'); setBookings(data.bookings); setPayments(data.payments); }
    catch (reason) { setError(messageOf(reason)); }
  }
  useEffect(() => { void load(); }, [role]);
  async function cancel(id: string) {
    setError('');
    try { const data = await api<{ message: string }>(`/api/bookings/${id}/cancel`, { method: 'POST', body: jsonBody({}) }); setNotice(data.message); await load(); }
    catch (reason) { setError(messageOf(reason)); }
  }
  return <section className="tool-page"><div className="tool-page-heading"><div><span className="section-kicker">{role === 'admin' ? 'ADMIN CONSOLE' : 'YOUR TICKETS'}</span><h1>{role === 'admin' ? 'Bookings and demo payments.' : 'My bookings.'}</h1><p>{role === 'admin' ? 'Review ticket status and simulated payment outcomes.' : 'Your confirmed tickets and their demo payment history.'}</p></div><CalendarDays size={20}/></div>{error && <div className="form-alert" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}{role === 'admin' && <div className="report-downloads"><a className="button button--secondary button--small" href="/api/admin/reports/bookings.csv"><Download size={14}/> Export bookings CSV</a><a className="button button--secondary button--small" href="/api/admin/reports/attendance.csv"><Download size={14}/> Export attendance CSV</a></div>}{bookings.length ? <div className="booking-list">{bookings.map((booking) => { const event = booking.event; const relatedPayments = payments.filter((payment) => payment.booking === booking._id); return <article className="booking-card" key={booking._id}><div className="booking-card-main"><div className="booking-card-icon"><CalendarDays size={20}/></div><div><span className={`status-pill status-pill--${booking.status}`}>{booking.status.replaceAll('_', ' ')}</span><h2>{event?.title ?? 'Event'}</h2><p>{event?.venue} · {event?.startsAt ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.startsAt)) : ''}</p>{role === 'admin' && booking.user && <small>{booking.user.displayName} · {booking.user.username} ({booking.user.role})</small>}</div></div><div className="booking-ticket"><small>TICKET CODE</small><strong>{booking.ticketCode ?? '—'}</strong>{booking.paymentType === 'simulated' && <span>₹{booking.amount} · demo</span>}{relatedPayments.map((payment, index) => <small key={`${payment.status}-${index}`}>Payment: {payment.status} · ₹{payment.amount}</small>)}</div><div className="booking-card-actions"><Link className="text-link" to={`${role === 'admin' ? '/admin' : '/student'}/events/${event?._id}`}>Event details <ArrowRight size={14}/></Link>{booking.status === 'confirmed' && <button className="button button--secondary button--small" onClick={() => void cancel(booking._id)} type="button">{role === 'admin' ? 'Cancel booking' : 'Cancel ticket'}</button>}</div></article>; })}</div> : <div className="tool-empty"><CalendarDays size={24}/><strong>No bookings yet.</strong><span>Browse upcoming events to reserve a seat.</span><Link className="button button--primary" to={role === 'admin' ? '/admin/events' : '/student/events'}>Browse events</Link></div>}</section>;
}

type AttendanceSummary = { eventId: string; title: string; sessionsAttended: number; sessionsOccurred: number; sessionPercent: number | null; daysAttended: number; daysOccurred: number; dailyPercent: number | null };
export function StudentAttendancePage() {
  const [items, setItems] = useState<AttendanceSummary[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void api<{ attendance: AttendanceSummary[] }>('/api/student/attendance').then((data) => setItems(data.attendance)).catch((reason) => setError(messageOf(reason))); }, []);
  return <section className="tool-page"><div className="tool-page-heading"><div><span className="section-kicker">STUDENT SPACE</span><h1>My attendance.</h1><p>Only completed, eligible sessions and event days count in these summaries.</p></div><Link className="button button--primary" to="/scan"><QrCode size={15}/> Scan attendance QR</Link></div>{error && <div className="form-alert" role="alert">{error}</div>}{items.length ? <div className="attendance-summary-grid">{items.map((item) => <article className="attendance-summary-card" key={item.eventId}><span className="section-kicker">EVENT ATTENDANCE</span><h2>{item.title}</h2><div className="attendance-percent-grid"><div><strong>{item.dailyPercent === null ? '—' : `${item.dailyPercent}%`}</strong><small>Event days · {item.daysAttended}/{item.daysOccurred}</small></div><div><strong>{item.sessionPercent === null ? '—' : `${item.sessionPercent}%`}</strong><small>Sessions · {item.sessionsAttended}/{item.sessionsOccurred}</small></div></div></article>)}</div> : <div className="tool-empty"><CalendarDays size={24}/><strong>No attendance summary yet.</strong><span>After booking an event and checking in, your completed sessions will appear here.</span></div>}</section>;
}

