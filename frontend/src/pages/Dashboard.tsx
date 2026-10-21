import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Bell, CalendarDays, CircleHelp, Compass, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { useAuth, type Role } from '../auth/AuthContext';
import { LoadingScreen } from '../ui/LoadingScreen';

type Overview = Record<string, string | number>;
type EventItem = { _id: string; title: string; venue: string; startsAt: string; status: string };

const roleContent: Record<Role, { label: string; title: string; subtitle: string; firstMetric: string; nextTitle: string; nextBody: string }> = {
  admin: { label: 'ADMIN CONSOLE', title: 'Your campus, at a glance.', subtitle: 'A clear view of the people and activity shaping campus life.', firstMetric: 'Active accounts', nextTitle: 'The foundation is in place.', nextBody: 'Once events and clubs are added, this is where approvals and campus activity will come together.' },
  club: { label: 'CLUB WORKSPACE', title: 'Make something happen.', subtitle: 'Your space to bring your club’s next idea to campus.', firstMetric: 'Your events', nextTitle: 'Your next gathering starts here.', nextBody: 'Your approved events, registrations, and attendance sessions will live in this workspace.' },
  student: { label: 'STUDENT SPACE', title: 'Find your next thing.', subtitle: 'The campus is full of moments waiting to be yours.', firstMetric: 'Upcoming events', nextTitle: 'A little room for what’s next.', nextBody: 'Published campus events and your registrations will show up here when they are ready.' },
  external: { label: 'STUDENT SPACE', title: 'Find your next thing.', subtitle: 'The campus is full of moments waiting to be yours.', firstMetric: 'Upcoming events', nextTitle: 'A little room for what’s next.', nextBody: 'Published campus events and your registrations will show up here when they are ready.' },
};

export function Dashboard({ role }: { role: Role }) {
  const { user, signOut } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const content = roleContent[role];
  const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: '2-digit' })
    .format(new Date()).toUpperCase();

  useEffect(() => {
    const endpoint = role === 'external' ? 'student' : role;
    fetch(`/api/${endpoint}/overview`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not load your workspace.');
        setOverview(data as Overview);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load your workspace.'));
  }, [role]);

  useEffect(() => {
    const endpoint = role === 'admin' || role === 'club' ? '/api/events/manage' : '/api/events';
    fetch(endpoint, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not load events.');
        setEvents((data.events ?? []).slice(0, 3));
      })
      .catch(() => setEvents([]));
  }, [role]);

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
        <a className="brand-lockup sidebar-brand" href="/"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></a>
        <div className="workspace-chip"><span className="workspace-icon">{role === 'admin' ? <ShieldCheck size={15} /> : role === 'club' ? <Users size={15} /> : <Compass size={15} />}</span><span><small>WORKSPACE</small><strong>{content.label}</strong></span></div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="side-nav-item side-nav-item--active" href={basePath}><LayoutDashboard size={17} /><span>Overview</span></a>
          <a className="side-nav-item" href={`${basePath}/events`}><CalendarDays size={17} /><span>Events</span></a>
          {role === 'admin' && <a className="side-nav-item" href={`${basePath}/accounts`}><Users size={17} /><span>Accounts</span></a>}
          {(role === 'student' || role === 'external') && <a className="side-nav-item" href={`${basePath}/bookings`}><CalendarDays size={17} /><span>My bookings</span></a>}
          <a className="side-nav-item" href={`${basePath}/notifications`}><Bell size={17} /><span>Notifications</span></a>
          {(role === 'student' || role === 'external') && <a className="side-nav-item" href={`${basePath}/attendance`}><Activity size={17} /><span>Attendance</span></a>}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><Activity size={15} /></span><div><strong>Your campus, connected.</strong><span>One place for every gathering.</span></div></div><a className="side-nav-item help-link" href="/events"><CircleHelp size={17} /><span>Browse campus events</span></a></div>
      </aside>

      {menuOpen && <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setMenuOpen(false)} type="button"><X size={20} /></button>}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} type="button">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="breadcrumb"><span>Campusly</span><span className="breadcrumb-divider">/</span><strong>Overview</strong></div>
          <div className="topbar-actions"><span className="topbar-date">{formattedDate}</span><span className="topbar-divider" /><a className="icon-button" href={`${basePath}/notifications`} aria-label="Notifications" title="Open notifications"><Bell size={18} /></a><button className="profile-button" onClick={handleSignOut} type="button" disabled={signingOut} title="Sign out"><span className="avatar">{accountInitials}</span><span className="profile-name">{user.displayName}</span><LogOut size={15} className="profile-logout" /></button></div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row"><div><div className="eyebrow dashboard-eyebrow"><span className="status-dot" /> {content.label}</div><h1>{content.title}</h1><p>{content.subtitle}</p></div><div className="welcome-decoration"><span className="decoration-circle decoration-circle--large" /><span className="decoration-circle decoration-circle--small" /><span className="decoration-star">✳</span><span className="decoration-label">CAMPUS<br />IN MOTION</span></div></section>

          <section className="overview-grid" aria-label="Workspace overview">
            <article className="metric-card metric-card--accent"><div className="metric-card-top"><span>{content.firstMetric}</span><span className="metric-icon"><CalendarDays size={17} /></span></div><div className="metric-value">{overview ? metricValue ?? 0 : '—'}</div><div className="metric-footnote">{overview ? 'Current workspace' : 'Loading account data'}</div><span className="metric-watermark">✳</span></article>
            <article className="metric-card"><div className="metric-card-top"><span>{role === 'admin' ? 'Events published' : role === 'club' ? 'Registrations' : 'My bookings'}</span><span className="metric-icon metric-icon--soft"><Users size={17} /></span></div><div className="metric-value">{overview ? (role === 'admin' ? overview.events : role === 'club' ? overview.registrations : overview.bookings) ?? 0 : '—'}</div><div className="metric-footnote">No event activity yet</div><span className="metric-watermark metric-watermark--soft">◌</span></article>
            <article className="metric-card"><div className="metric-card-top"><span>{role === 'admin' ? 'Needs approval' : role === 'club' ? 'Live sessions' : 'Attendance sessions'}</span><span className="metric-icon metric-icon--warm"><Activity size={17} /></span></div><div className="metric-value">{overview ? (role === 'admin' ? overview.pendingApprovals : role === 'club' ? overview.openSessions : overview.attendanceSessions) ?? 0 : '—'}</div><div className="metric-footnote">Nothing waiting right now</div><span className="metric-watermark metric-watermark--warm">⌁</span></article>
          </section>

          <section className="dashboard-lower">
            <article className="empty-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR CAMPUS, RIGHT NOW</span><h2>{events.length ? 'Upcoming campus activity.' : content.nextTitle}</h2></div><span className="panel-heading-icon"><CalendarDays size={18} /></span></div>{events.length ? <div className="dashboard-event-list">{events.map((event) => <a key={event._id} className="dashboard-event-row" href={`${basePath}/events/${event._id}`}><span><strong>{event.title}</strong><small>{event.venue} · {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(event.startsAt))}</small></span><span className="event-status-pill">{event.status.replaceAll('_', ' ')}</span></a>)}</div> : <div className="empty-state"><div className="empty-art"><span className="empty-art-ring empty-art-ring--one" /><span className="empty-art-ring empty-art-ring--two" /><span className="empty-art-center"><CalendarDays size={22} /></span><span className="empty-art-spark">✦</span></div><p>{error ? error : content.nextBody}</p><a className="button button--secondary" href={`${basePath}/events`}>Browse events <ArrowUpRight size={14} /></a></div>}</article>
            <article className="account-panel"><span className="section-kicker">YOUR ACCOUNT</span><div className="account-identity"><span className="avatar avatar--large">{accountInitials}</span><div><h2>{user.displayName}</h2><span>{user.role === 'external' ? 'External student' : `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)} account`}</span></div></div><div className="account-detail"><span>USERNAME</span><strong>{user.username}</strong></div>{user.enrollmentId && <div className="account-detail"><span>ENROLLMENT ID</span><strong>{user.enrollmentId}</strong></div>}<div className="account-detail"><span>ACCOUNT STATUS</span><strong className="account-status"><span className="status-dot" /> Active</strong></div><button className="account-signout" onClick={handleSignOut} type="button" disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}<ArrowUpRight size={15} /></button></article>
          </section>
          <footer className="dashboard-footer"><span>MADE FOR THE MOMENTS BETWEEN CLASSES.</span><span>YOUR CAMPUS, IN MOTION <span className="footer-star">✳</span></span></footer>
        </div>
      </main>
    </div>
  );
}
