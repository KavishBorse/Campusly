import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, UserPlus } from 'lucide-react';
import { api, jsonBody, messageOf } from '../api';
import { BrandLogo } from '../ui/BrandLogo';

export function ExternalSignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ message: string }>('/api/auth/external/register', {
        method: 'POST',
        body: jsonBody({ name, collegeName, email, password }),
      });
      navigate('/login', { state: { notice: result.message, username: email } });
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-utility-page">
    <header className="public-header">
      <Link className="brand-lockup" to="/events" aria-label="Campusly home"><BrandLogo className="brand-logo--nav" /></Link>
      <Link to="/events" className="text-link"><ArrowLeft size={15}/> Back to events</Link>
    </header>
    <section className="auth-utility-card">
      <span className="welcome-icon"><UserPlus size={22}/></span>
      <span className="form-eyebrow">EXTERNAL STUDENT ACCESS</span>
      <h1>Join your campus.</h1>
      <p>Create an account with your name, college, email, and password. You can sign in as soon as your account is created.</p>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <form className="tool-form" onSubmit={signup}>
        <label>Full name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"/></label>
        <label>College name<input required minLength={2} maxLength={160} value={collegeName} onChange={(event) => setCollegeName(event.target.value)}/></label>
        <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"/></label>
        <label>Password<input required type="password" minLength={8} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password"/><small>Use at least 8 characters.</small></label>
        <button className="button button--primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={15}/></button>
      </form>
      <p className="auth-utility-footnote">Already have an account? <Link to="/login">Sign in</Link></p>
    </section>
  </main>;
}
