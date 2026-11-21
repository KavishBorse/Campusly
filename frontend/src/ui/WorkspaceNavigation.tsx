import { Activity, Bell, CalendarDays, LayoutDashboard, Mail, UserRound, Users, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { CurrentUser, Role } from '../auth/AuthContext';
import { NotificationCountBadge } from './useUnreadNotificationCount';

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export function WorkspaceNavigation({
  role,
  user,
  unreadCount,
  onNavigate,
}: {
  role: Role;
  user: CurrentUser | null;
  unreadCount: number;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const base = role === 'external' ? '/student' : `/${role}`;
  const items: NavigationItem[] = [
    { label: 'Overview', href: base, icon: LayoutDashboard },
    { label: 'Events', href: `${base}/events`, icon: CalendarDays },
  ];

  if (role === 'admin') {
    items.push(
      { label: 'Accounts', href: '/admin/accounts', icon: Users },
      { label: 'Bookings', href: '/admin/bookings', icon: CalendarDays },
    );
  }

  if (role === 'student' || role === 'external') {
    items.push(
      { label: 'My bookings', href: '/student/bookings', icon: CalendarDays },
      { label: 'Attendance', href: '/student/attendance', icon: Activity },
    );
  }

  if (role === 'student' && user?.accountType === 'internal') {
    items.push({ label: 'College email', href: '/student/email', icon: Mail });
  }

  if (role === 'student' || role === 'external' || role === 'club') {
    items.push({ label: 'My profile', href: `${base}/profile`, icon: UserRound });
  }

  items.push({ label: 'Notifications', href: `${base}/notifications`, icon: Bell });

  return (
    <nav className="side-nav" aria-label="Workspace navigation">
      {items.map((item) => {
        const active = location.pathname === item.href || (item.href !== base && location.pathname.startsWith(`${item.href}/`));
        const isNotifications = item.label === 'Notifications';
        return (
          <Link
            key={item.href}
            onClick={onNavigate}
            className={`side-nav-item ${active ? 'side-nav-item--active' : ''} ${isNotifications ? 'side-nav-item--notifications' : ''}`}
            to={item.href}
            aria-label={isNotifications && unreadCount > 0 ? `Notifications, ${unreadCount} unread` : undefined}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
            {isNotifications && <NotificationCountBadge count={unreadCount} />}
          </Link>
        );
      })}
    </nav>
  );
}
