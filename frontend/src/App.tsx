import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth, type Role } from './auth/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { LoadingScreen } from './ui/LoadingScreen';
import { EventDetailPage, EventFormPage, EventListPage } from './pages/EventsWorkspacePage';
import { AccountsPage, BookingsPage, NotificationsPage, StudentAttendancePage } from './pages/WorkspaceToolsPage';
import { PublicEventDetailPage, PublicEventsPage } from './pages/PublicEventsPage';
import { ExternalSignupPage } from './pages/ExternalSignupPage';
import { ScanPage } from './pages/ScanPage';
import { WorkspaceFrame } from './ui/WorkspaceFrame';

function rolePath(role: Role) {
  return role === 'external' ? '/student' : `/${role}`;
}

function ProtectedRoute({ children, allowed }: { children: ReactNode; allowed?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  if (allowed && !allowed.includes(user.role)) return <Navigate to={rolePath(user.role)} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/events" replace />;
  return <Navigate to={user.mustChangePassword ? '/change-password' : rolePath(user.role)} replace />;
}

function WorkspaceRoute({ role, allowed, children }: { role: Role; allowed: Role[]; children: ReactNode }) {
  return <ProtectedRoute allowed={allowed}><WorkspaceFrame role={role}>{children}</WorkspaceFrame></ProtectedRoute>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<ExternalSignupPage />} />
      <Route path="/events" element={<PublicEventsPage />} />
      <Route path="/events/:eventId" element={<PublicEventDetailPage />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/scan" element={<ProtectedRoute allowed={['student', 'external']}><ScanPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowed={['admin']}><Dashboard role="admin" /></ProtectedRoute>} />
      <Route path="/admin/events" element={<WorkspaceRoute role="admin" allowed={['admin']}><EventListPage role="admin" /></WorkspaceRoute>} />
      <Route path="/admin/events/new" element={<WorkspaceRoute role="admin" allowed={['admin']}><EventFormPage role="admin" /></WorkspaceRoute>} />
      <Route path="/admin/events/:eventId" element={<WorkspaceRoute role="admin" allowed={['admin']}><EventDetailPage role="admin" /></WorkspaceRoute>} />
      <Route path="/admin/accounts" element={<WorkspaceRoute role="admin" allowed={['admin']}><AccountsPage /></WorkspaceRoute>} />
      <Route path="/admin/bookings" element={<WorkspaceRoute role="admin" allowed={['admin']}><BookingsPage role="admin" /></WorkspaceRoute>} />
      <Route path="/admin/notifications" element={<WorkspaceRoute role="admin" allowed={['admin']}><NotificationsPage role="admin" /></WorkspaceRoute>} />
      <Route path="/club" element={<ProtectedRoute allowed={['club']}><Dashboard role="club" /></ProtectedRoute>} />
      <Route path="/club/events" element={<WorkspaceRoute role="club" allowed={['club']}><EventListPage role="club" /></WorkspaceRoute>} />
      <Route path="/club/events/new" element={<WorkspaceRoute role="club" allowed={['club']}><EventFormPage role="club" /></WorkspaceRoute>} />
      <Route path="/club/events/:eventId" element={<WorkspaceRoute role="club" allowed={['club']}><EventDetailPage role="club" /></WorkspaceRoute>} />
      <Route path="/club/notifications" element={<WorkspaceRoute role="club" allowed={['club']}><NotificationsPage role="club" /></WorkspaceRoute>} />
      <Route path="/student" element={<ProtectedRoute allowed={['student', 'external']}><Dashboard role="student" /></ProtectedRoute>} />
      <Route path="/student/events" element={<WorkspaceRoute role="student" allowed={['student', 'external']}><EventListPage role="student" /></WorkspaceRoute>} />
      <Route path="/student/events/:eventId" element={<WorkspaceRoute role="student" allowed={['student', 'external']}><EventDetailPage role="student" /></WorkspaceRoute>} />
      <Route path="/student/bookings" element={<WorkspaceRoute role="student" allowed={['student', 'external']}><BookingsPage role="student" /></WorkspaceRoute>} />
      <Route path="/student/attendance" element={<WorkspaceRoute role="student" allowed={['student', 'external']}><StudentAttendancePage /></WorkspaceRoute>} />
      <Route path="/student/notifications" element={<WorkspaceRoute role="student" allowed={['student', 'external']}><NotificationsPage role="student" /></WorkspaceRoute>} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
