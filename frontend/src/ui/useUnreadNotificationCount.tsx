import { useEffect, useState } from 'react';
import { api } from '../api';

const unreadCountEvent = 'campusly:unread-notifications';

export function publishUnreadNotificationCount(count: number) {
  window.dispatchEvent(new CustomEvent(unreadCountEvent, { detail: count }));
}

export function useUnreadNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const data = await api<{ unreadCount: number }>('/api/notifications');
        if (active) setUnreadCount(Math.max(0, data.unreadCount ?? 0));
      } catch {
        // Keep the latest known badge when the network is temporarily unavailable.
      } finally {
        refreshing = false;
      }
    }

    function onCountUpdate(event: Event) {
      const count = (event as CustomEvent<number>).detail;
      if (Number.isFinite(count)) setUnreadCount(Math.max(0, count));
      else void refresh();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refresh();
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 20_000);
    window.addEventListener('focus', refresh);
    window.addEventListener(unreadCountEvent, onCountUpdate);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(unreadCountEvent, onCountUpdate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return unreadCount;
}

export function NotificationCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="notification-count-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>;
}
