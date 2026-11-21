import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Bell, CalendarDays, Compass, LayoutDashboard, LogOut, Mail, Menu, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { useAuth, type Role } from '../auth/AuthContext';
import { BrandLogo } from './BrandLogo';
import { NotificationCountBadge, useUnreadNotificationCount } from './useUnreadNotificationCount';

export function WorkspaceFrame({ role, children }: { role: Role; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  const base = role === 'external' ? '/student' : `/${role}`;
  const entries = [
    { label: 'Overview', href: base, icon: LayoutDashboard },
    { label: 'Events', href: `${base}/events`, icon: CalendarDays },
    ...(role === 'admin' ? [{ label: 'Accounts', href: '/admin/accounts', icon: Users }, { label: 'Bookings', href: '/admin/bookings', icon: CalendarDays }] : []),
    ...(role === 'student' || role === 'external' ? [{ label: 'My bookings', href: '/student/bookings', icon: CalendarDays }, { label: 'Attendance', href: '/student/attendance', icon: Activity }] : []),
    ...(role === 'student' && user?.accountType === 'internal' ? [{ label: 'College email', href: '/student/email', icon: Mail }] : []),
    ...(role === 'student' || role === 'external' || role === 'club' ? [{ label: 'My profile', href: `${base}/profile`, icon: UserRound }] : []),
    { label: 'Notifications', href: `${base}/notifications`, icon: Bell },
  ];
  const initials = user?.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'C';
  async function logout() { await signOut(); window.location.assign('/login'); }
  return <div className="dashboard-layout">
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
      <Link className="brand-lockup sidebar-brand" to={base} aria-label="Campusly home"><BrandLogo className="brand-logo--nav"/></Link>
      <div className="workspace-chip"><span className="workspace-icon">{role === 'admin' ? <ShieldCheck size={15}/> : role === 'club' ? <Users size={15}/> : <Compass size={15}/>}</span><span><small>WORKSPACE</small><strong>{role === 'admin' ? 'ADMIN CONSOLE' : role === 'club' ? 'CLUB WORKSPACE' : 'STUDENT SPACE'}</strong></span></div>
      <div className="nav-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace navigation">
        {entries.map((item) => {
          const active = location.pathname === item.href || (item.href !== base && location.pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} onClick={() => setMenuOpen(false)} className={`side-nav-item ${active ? 'side-nav-item--active' : ''} ${item.label === 'Notifications' ? 'side-nav-item--notifications' : ''}`} to={item.href} aria-label={item.label === 'Notifications' && unreadCount > 0 ? `Notifications, ${unreadCount} unread` : undefined}>
            <item.icon size={17}/><span>{item.label}</span>{item.label === 'Notifications' && <NotificationCountBadge count={unreadCount}/>}
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><Activity size={15}/></span><div><strong>Your campus, connected.</strong><span>One place for every gathering.</span></div></div><Link className="side-nav-item help-link" to="/events"><CalendarDays size={17}/><span>Browse campus events</span></Link></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20}/></button>}
    <main className="dashboard-main">
      <header className="dashboard-topbar">
        <button className="mobile-menu-button" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
        <div className="breadcrumb"><Link to={base}>Campusly</Link><span className="breadcrumb-divider">/</span><strong>{location.pathname.split('/').filter(Boolean).slice(1).join(' / ') || 'Overview'}</strong></div>
        <div className="topbar-actions">
          <span className="topbar-date">{new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'2-digit'}).format(new Date()).toUpperCase()}</span><span className="topbar-divider"/>
          <Link className="icon-button notification-icon-button" to={`${base}/notifications`} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'} title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}><Bell size={18}/><NotificationCountBadge count={unreadCount}/></Link>
          <button className="profile-button" type="button" onClick={() => void logout()} title="Sign out"><span className="avatar">{initials}</span><span className="profile-name">{user?.displayName}</span><LogOut size={15} className="profile-logout"/></button>
        </div>
      </header>
      <div className="dashboard-content workspace-frame-content">{children}</div>
    </main>
  </div>;
}
