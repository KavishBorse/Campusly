import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Bell, CalendarDays, Compass, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { useAuth, type Role } from '../auth/AuthContext';
import { BrandLogo } from './BrandLogo';
import { NotificationCountBadge, useUnreadNotificationCount } from './useUnreadNotificationCount';
import { WorkspaceNavigation } from './WorkspaceNavigation';

export function WorkspaceFrame({ role, children }: { role: Role; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  const base = role === 'external' ? '/student' : `/${role}`;
  const initials = user?.displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() ?? 'C';
  async function logout() { await signOut(); window.location.assign('/login'); }
  return <div className="dashboard-layout">
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
      <Link className="brand-lockup sidebar-brand" to={base} aria-label="Campusly home"><BrandLogo className="brand-logo--nav"/></Link>
      <div className="workspace-chip"><span className="workspace-icon">{role === 'admin' ? <ShieldCheck size={15}/> : role === 'club' ? <Users size={15}/> : <Compass size={15}/>}</span><span><small>WORKSPACE</small><strong>{role === 'admin' ? 'ADMIN CONSOLE' : role === 'club' ? 'CLUB WORKSPACE' : 'STUDENT SPACE'}</strong></span></div>
      <div className="nav-section-label">WORKSPACE</div>
      <WorkspaceNavigation role={role} user={user} unreadCount={unreadCount} onNavigate={() => setMenuOpen(false)} />
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
