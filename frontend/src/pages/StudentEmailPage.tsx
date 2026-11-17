import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, jsonBody, messageOf } from '../api';

type EmailRequest = { message: string; developmentCode?: string };

export function StudentEmailPage() {
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify' | 'done'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (user?.accountType !== 'internal') return <Navigate to="/student" replace />;

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<EmailRequest>('/api/auth/student/email/request', { method: 'POST', body: jsonBody({ email }) });
      setDevelopmentCode(result.developmentCode ?? '');
      setStep('verify');
      setNotice(result.message);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ message: string }>('/api/auth/student/email/verify', { method: 'POST', body: jsonBody({ code }) });
      await refresh();
      setStep('done');
      setNotice(result.message);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    setBusy(true); setError(''); setNotice(''); setCode('');
    try {
      const result = await api<EmailRequest>('/api/auth/student/email/request', { method: 'POST', body: jsonBody({ email }) });
      setDevelopmentCode(result.developmentCode ?? '');
      setNotice(result.message);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  return <main className="auth-utility-page"><header className="public-header"><Link className="brand-lockup" to="/student"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link><Link to="/student" className="text-link"><ArrowLeft size={15}/> Back to workspace</Link></header><section className="auth-utility-card"><span className="welcome-icon"><MailCheck size={22}/></span><span className="form-eyebrow">MIT STUDENT ACCOUNT</span><h1>{step === 'done' ? 'Email linked.' : step === 'verify' ? 'Check your inbox.' : 'Add your college email.'}</h1><p>{step === 'email' ? `Link the college mailbox that matches your enrollment ID (${user?.enrollmentId ?? user?.username}). We will email you a one-time code.` : step === 'verify' ? `Enter the six-digit code sent to ${email}. Your email is linked only after the code is verified.` : 'Your college email is verified and connected to your student account.'}</p>{error && <div className="form-alert" role="alert">{error}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
    {step === 'email' && <form className="tool-form" onSubmit={requestCode}><label>MIT student email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={`${user?.enrollmentId ?? user?.username}@students.mituniversity.edu.in`}/><small>Use the exact enrollment ID as the part before @, with the students.mituniversity.edu.in domain.</small></label><button className="button button--primary" disabled={busy}>{busy ? 'Sending code…' : 'Send verification code'} <ArrowRight size={15}/></button></form>}
    {step === 'verify' && <form className="tool-form" onSubmit={verifyCode}>{developmentCode && <div className="development-code"><small>LOCAL DEVELOPMENT VERIFICATION CODE</small><strong>{developmentCode}</strong><span>SMTP email delivery is not configured for this local demo.</span></div>}<label>Six-digit code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)}/></label><button className="button button--primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify and link email'} <ArrowRight size={15}/></button><button className="button button--secondary" type="button" disabled={busy} onClick={() => void resendCode()}>Resend code</button><button className="button button--secondary" type="button" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(''); setNotice(''); }}>Use another email</button></form>}
    {step === 'done' && <div className="tool-form"><Link className="button button--primary" to="/student">Return to workspace <ArrowRight size={15}/></Link></div>}
    <p className="auth-utility-footnote">Your enrollment ID is checked against the email address. For an official active-enrollment check, the college must provide a roster or identity-system connection.</p></section></main>;
}
