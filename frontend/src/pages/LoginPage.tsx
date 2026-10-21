import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type Role } from '../auth/AuthContext';
import { LoadingScreen } from '../ui/LoadingScreen';

function destination(role: Role, mustChangePassword: boolean) {
  if (mustChangePassword) return '/change-password';
  return role === 'external' ? '/student' : `/${role}`;
}

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { from?: string; notice?: string; username?: string } | null;
  const [username, setUsername] = useState(routeState?.username ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to={destination(user.role, user.mustChangePassword)} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const signedInUser = await signIn(username, password);
      const requestedPath = routeState?.from;
      navigate(signedInUser.mustChangePassword ? '/change-password' : requestedPath || destination(signedInUser.role, false), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-story" aria-label="About Campusly">
        <div className="story-topline"><span className="brand-mark">c</span><span className="brand-name">campusly</span><span className="story-label">CAMPUS, IN MOTION</span></div>
        <div className="story-content">
          <div className="eyebrow"><Sparkles size={15} strokeWidth={2.3} /> THE CAMPUSLY EXPERIENCE</div>
          <h1>Make room for<br /><em>what brings</em><br />you together.</h1>
          <p>One home for the moments, people, and ideas that make campus life yours.</p>
          <div className="story-event-card">
            <div className="event-card-art"><span className="art-orbit art-orbit--one" /><span className="art-orbit art-orbit--two" /><span className="art-sun" /><span className="art-caption">FIND YOUR<br />NEXT THING</span></div>
            <div className="event-card-details"><div><span className="card-overline">MADE FOR YOUR CAMPUS</span><strong>Every gathering<br />starts somewhere.</strong></div><span className="event-card-arrow"><ArrowRight size={16} /></span></div>
          </div>
        </div>
        <div className="story-footer"><span>01 / YOUR CAMPUS, CONNECTED</span><span>© CAMPUSLY 2026</span></div>
      </section>

      <section className="login-panel">
        <div className="login-panel-top"><span className="mobile-brand"><span className="brand-mark brand-mark--small">c</span> campusly</span><span className="secure-note"><ShieldCheck size={14} /> SECURE CAMPUS ACCESS</span></div>
        <div className="login-form-wrap">
          <div className="welcome-icon"><CalendarDays size={22} strokeWidth={1.7} /></div>
          <span className="form-eyebrow">YOUR CAMPUS IS WAITING</span>
          <h2>Welcome back.</h2>
          <p className="form-intro">Sign in to see what’s happening around you.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            {routeState?.notice && <div className="form-success" role="status">{routeState.notice}</div>}
            {error && <div className="form-alert" role="alert">{error}</div>}
            <label className="field-label" htmlFor="username">Username</label>
            <input id="username" className="text-input" autoComplete="username" placeholder="Enrollment ID or account name" value={username} onChange={(event) => setUsername(event.target.value)} required />
            <div className="password-label-row"><label className="field-label" htmlFor="password">Password</label></div>
            <input id="password" className="text-input" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="button button--primary login-submit" type="submit" disabled={submitting}>
              <span>{submitting ? 'Signing in…' : 'Sign in to Campusly'}</span><ArrowRight size={17} />
            </button>
          </form>

          <div className="login-trust"><span><Check size={13} /> Your account stays protected</span><span className="trust-dot" /><span>Need access? Contact your campus admin.</span></div>
        </div>
        <div className="login-panel-footer"><span>BUILT FOR EVERY SIDE OF CAMPUS LIFE</span><span>ASK YOUR CAMPUS ADMIN FOR ACCESS</span></div>
      </section>
    </main>
  );
}
