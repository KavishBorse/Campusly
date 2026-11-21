import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Bell, CalendarDays, CircleHelp, Compass, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { api, messageOf } from '../api';
import { useAuth, type Role } from '../auth/AuthContext';
import { LoadingScreen } from '../ui/LoadingScreen';
import { BrandLogo } from '../ui/BrandLogo';
import { NotificationCountBadge, useUnreadNotificationCount } from '../ui/useUnreadNotificationCount';
import { WorkspaceNavigation } from '../ui/WorkspaceNavigation';
import { formatEventDateRange } from '../utils/eventDates';

type Overview = Record<string, string | number>;
type EventItem = { _id: string; title: string; venue: string; startsAt: string; endsAt: string; status: string };

const roleContent: Record<Role, { label: string; title: string; subtitle: string; firstMetric: string; nextTitle: string; nextBody: string }> = {
  admin: { label: 'ADMIN CONSOLE', title: 'Your campus, at a glance.', subtitle: 'A clear view of the people and activity shaping campus life.', firstMetric: 'Active accounts', nextTitle: 'No club submissions need review.', nextBody: 'New club event submissions will appear here for approval. Open event management to publish official events or review all statuses.' },
  club: { label: 'CLUB WORKSPACE', title: 'Make something happen.', subtitle: 'Your space to bring your club’s next idea to campus.', firstMetric: 'Your events', nextTitle: 'Your next gathering starts here.', nextBody: 'Your approved events, registrations, and attendance sessions will live in this workspace.' },
  student: { label: 'STUDENT SPACE', title: 'Find your next thing.', subtitle: 'The campus is full of moments waiting to be yours.', firstMetric: 'Upcoming events', nextTitle: 'A little room for what’s next.', nextBody: 'Published campus events and your registrations will show up here when they are ready.' },
  external: { label: 'STUDENT SPACE', title: 'Find your next thing.', subtitle: 'The campus is full of moments waiting to be yours.', firstMetric: 'Upcoming events', nextTitle: 'A little room for what’s next.', nextBody: 'Published campus events and your registrations will show up here when they are ready.' },
};

export function Dashboard({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadNotificationCount();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [overviewError, setOverviewError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const content = roleContent[role];
  const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' })
    .format(new Date()).toUpperCase();

  useEffect(() => {
    let active = true;
    const endpoint = role === 'external' ? 'student' : role;
    setOverviewLoading(true);
    setOverviewError('');
    void api<Overview>(`/api/${endpoint}/overview`)
      .then((data) => { if (active) setOverview(data); })
      .catch((reason: unknown) => { if (active) setOverviewError(messageOf(reason)); })
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [role, reloadKey]);

  useEffect(() => {
    let active = true;
    const endpoint = role === 'admin'
      ? '/api/events/manage?status=pending_approval&limit=3'
      : role === 'club' ? '/api/events/manage' : '/api/events';
    setEventsLoading(true);
    setEventsError('');
    void api<{ events: EventItem[] }>(endpoint)
      .then((data) => { if (active) setEvents((data.events ?? []).slice(0, 3)); })
      .catch((reason: unknown) => { if (active) { setEventsError(messageOf(reason)); setEvents([]); } })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [role, reloadKey]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    window.location.assign('/login');
  }

  if (!user) return <LoadingScreen />;

  const accountInitials = user.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const basePath = role === 'external' ? '/student' : `/${role}`;
  const metricValue = role === 'admin'
    ? overview?.activeAccounts
    : role === 'club'
      ? overview?.events
      : overview?.upcomingEvents;

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <a className="brand-lockup sidebar-brand" href="/" aria-label="Campusly home"><BrandLogo className="brand-logo--nav" /></a>
        <div className="workspace-chip"><span className="workspace-icon">{role === 'admin' ? <ShieldCheck size={15} /> : role === 'club' ? <Users size={15} /> : <Compass size={15} />}</span><span><small>WORKSPACE</small><strong>{content.label}</strong></span></div>
        <div className="nav-section-label">WORKSPACE</div>
        <WorkspaceNavigation role={role} user={user} unreadCount={unreadCount} onNavigate={() => setMenuOpen(false)} />
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><Activity size={15} /></span><div><strong>Your campus, connected.</strong><span>One place for every gathering.</span></div></div><a className="side-nav-item help-link" href="/events"><CircleHelp size={17} /><span>Browse campus events</span></a></div>
      </aside>

      {menuOpen && <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setMenuOpen(false)} type="button"><X size={20} /></button>}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} type="button">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="breadcrumb"><span>Campusly</span><span className="breadcrumb-divider">/</span><strong>Overview</strong></div>
          <div className="topbar-actions"><span className="topbar-date">{formattedDate}</span><span className="topbar-divider" /><a className="icon-button notification-icon-button" href={`${basePath}/notifications`} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'} title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Open notifications'}><Bell size={18} /><NotificationCountBadge count={unreadCount} /></a><button className="profile-button" onClick={handleSignOut} type="button" disabled={signingOut} title="Sign out"><span className="avatar">{accountInitials}</span><span className="profile-name">{user.displayName}</span><LogOut size={15} className="profile-logout" /></button></div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row"><div><div className="eyebrow dashboard-eyebrow"><span className="status-dot" /> {content.label}</div><h1>{content.title}</h1><p>{content.subtitle}</p></div><div className="welcome-decoration"><span className="decoration-circle decoration-circle--large" /><span className="decoration-circle decoration-circle--small" /><span className="decoration-star">✳</span><span className="decoration-label">CAMPUS<br />IN MOTION</span></div></section>

          {overviewError && <div className="form-alert" role="alert">{overviewError} <button className="button button--secondary button--small" type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button></div>}

          <section className="overview-grid" aria-label="Workspace overview">
            <article className="metric-card metric-card--accent"><div className="metric-card-top"><span>{content.firstMetric}</span><span className="metric-icon"><CalendarDays size={17} /></span></div><div className="metric-value">{overview ? metricValue ?? 0 : '—'}</div><div className="metric-footnote">{overview ? 'Current workspace' : overviewLoading ? 'Loading account data' : 'Account data unavailable'}</div><span className="metric-watermark">✳</span></article>
            <article className="metric-card"><div className="metric-card-top"><span>{role === 'admin' ? 'Events published' : role === 'club' ? 'Registrations' : 'My bookings'}</span><span className="metric-icon metric-icon--soft"><Users size={17} /></span></div><div className="metric-value">{overview ? (role === 'admin' ? overview.events : role === 'club' ? overview.registrations : overview.bookings) ?? 0 : '—'}</div><div className="metric-footnote">{overview ? role === 'admin' ? 'Published campus events' : role === 'club' ? 'Confirmed registrations' : 'Confirmed bookings' : overviewLoading ? 'Loading activity' : 'Activity data unavailable'}</div><span className="metric-watermark metric-watermark--soft">◌</span></article>
            <article className="metric-card"><div className="metric-card-top"><span>{role === 'admin' ? 'Needs approval' : role === 'club' ? 'Live sessions' : 'Attendance sessions'}</span><span className="metric-icon metric-icon--warm"><Activity size={17} /></span></div><div className="metric-value">{overview ? (role === 'admin' ? overview.pendingApprovals : role === 'club' ? overview.openSessions : overview.attendanceSessions) ?? 0 : '—'}</div><div className="metric-footnote">{overview ? role === 'admin' ? Number(overview.pendingApprovals) ? 'Club submissions to review' : 'Nothing waiting right now' : role === 'club' ? 'Currently open check-ins' : 'Recorded check-ins' : overviewLoading ? 'Loading activity' : 'Activity data unavailable'}</div><span className="metric-watermark metric-watermark--warm">⌁</span></article>
          </section>

          <section className="dashboard-lower">
            <article className="empty-panel"><div className="panel-heading"><div><span className="section-kicker">{role === 'admin' ? 'APPROVAL QUEUE' : 'YOUR CAMPUS, RIGHT NOW'}</span><h2>{events.length ? role === 'admin' ? 'Club events awaiting review.' : 'Upcoming campus activity.' : content.nextTitle}</h2></div><span className="panel-heading-icon"><CalendarDays size={18} /></span></div>{events.length ? <div className="dashboard-event-list">{events.map((event) => <a key={event._id} className="dashboard-event-row" href={`${basePath}/events/${event._id}`}><span><strong>{event.title}</strong><small>{event.venue} · {formatEventDateRange(event.startsAt, event.endsAt)}</small></span><span className="event-status-pill">{event.status.replaceAll('_', ' ')}</span></a>)}</div> : <div className="empty-state"><div className="empty-art"><span className="empty-art-ring empty-art-ring--one" /><span className="empty-art-ring empty-art-ring--two" /><span className="empty-art-center"><CalendarDays size={22} /></span><span className="empty-art-spark">✦</span></div><p>{eventsLoading ? 'Loading event activity…' : eventsError || content.nextBody}</p>{eventsError && <button className="button button--secondary" type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>}<a className="button button--secondary" href={role === 'admin' ? '/admin/events?status=pending_approval' : `${basePath}/events`}>{role === 'admin' ? 'Review event queue' : 'Browse events'} <ArrowUpRight size={14} /></a></div>}</article>
            <article className="account-panel"><span className="section-kicker">YOUR ACCOUNT</span><div className="account-identity"><span className="avatar avatar--large">{accountInitials}</span><div><h2>{user.displayName}</h2><span>{user.role === 'external' ? 'External student' : `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)} account`}</span></div></div><div className="account-detail"><span>USERNAME</span><strong>{user.username}</strong></div>{user.enrollmentId && <div className="account-detail"><span>ENROLLMENT ID</span><strong>{user.enrollmentId}</strong></div>}{user.accountType === 'internal' && user.emailVerified && user.email && <div className="account-detail"><span>COLLEGE EMAIL</span><strong>{user.email}</strong></div>}<div className="account-detail"><span>ACCOUNT STATUS</span><strong className="account-status"><span className="status-dot" /> Active</strong></div>{(role === 'student' || role === 'external' || role === 'club') && <a className="account-signout" href={`${basePath}/profile`}>Manage profile <ArrowUpRight size={15} /></a>}{user.accountType === 'internal' && !user.emailVerified && <a className="account-signout" href="/student/email">Link your college email <ArrowUpRight size={15} /></a>}<button className="account-signout" onClick={handleSignOut} type="button" disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}<ArrowUpRight size={15} /></button></article>
          </section>
          <footer className="dashboard-footer"><span>MADE FOR THE MOMENTS BETWEEN CLASSES.</span><span>YOUR CAMPUS, IN MOTION <span className="footer-star">✳</span></span></footer>
        </div>
      </main>
    </div>
  );
}
