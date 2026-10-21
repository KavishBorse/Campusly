import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { api, jsonBody, messageOf } from '../api';

export function ExternalSignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function signup(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ message: string; developmentCode?: string }>('/api/auth/external/register', { method: 'POST', body: jsonBody({ name, collegeName, email, password }) });
      setDevelopmentCode(result.developmentCode ?? '');
      setStep('verify');
      setNotice(result.message);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api<{ message: string }>('/api/auth/external/verify', { method: 'POST', body: jsonBody({ email, code }) }); setNotice(result.message); navigate('/login', { state: { notice: result.message, username: email } }); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    setBusy(true); setError(''); setNotice(''); setCode('');
    try {
      const result = await api<{ message: string; developmentCode?: string }>('/api/auth/external/resend-code', { method: 'POST', body: jsonBody({ email }) });
      setDevelopmentCode(result.developmentCode ?? '');
      setNotice(result.message);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  return <main className="auth-utility-page"><header className="public-header"><Link className="brand-lockup" to="/events"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link><Link to="/events" className="text-link"><ArrowLeft size={15}/> Back to events</Link></header><section className="auth-utility-card"><span className="welcome-icon"><MailCheck size={22}/></span><span className="form-eyebrow">EXTERNAL STUDENT ACCESS</span><h1>{step === 'signup' ? 'Join your campus.' : 'Verify your email.'}</h1><p>{step === 'signup' ? 'Create an account with your name, college, and email. Email verification confirms control of the address.' : `We created an account for ${email}. Enter the six-digit email verification code.`}</p>{error && <div className="form-alert" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
      {step === 'signup' ? <form className="tool-form" onSubmit={signup}><label>Full name<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"/></label><label>College name<input required minLength={2} maxLength={160} value={collegeName} onChange={(event) => setCollegeName(event.target.value)}/></label><label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"/></label><label>Password<input required type="password" minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password"/><small>Use at least 12 characters.</small></label><button className="button button--primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={15}/></button></form> : <form className="tool-form" onSubmit={verify}>{developmentCode && <div className="development-code"><small>LOCAL DEVELOPMENT VERIFICATION CODE</small><strong>{developmentCode}</strong><span>Email delivery is not configured for this demo.</span></div>}<label>Six-digit code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code"/></label><button className="button button--primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify email'} <ArrowRight size={15}/></button><button className="button button--secondary" type="button" disabled={busy} onClick={() => void resendCode()}>Resend verification code</button><button className="button button--secondary" type="button" disabled={busy} onClick={() => { setStep('signup'); setNotice(''); setError(''); }}>Back to details</button></form>}
      <p className="auth-utility-footnote">Already have an account? <Link to="/login">Sign in</Link></p></section></main>;
}
