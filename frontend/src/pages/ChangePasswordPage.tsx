import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const updatedUser = await changePassword(currentPassword, newPassword);
      navigate(updatedUser.role === 'external' ? '/student' : `/${updatedUser.role}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="password-page">
      <header className="simple-header"><a className="brand-lockup" href="/"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></a><span className="secure-note"><ShieldCheck size={14} /> SECURE CAMPUS ACCESS</span></header>
      <section className="password-card">
        <div className="welcome-icon"><KeyRound size={21} /></div>
        <span className="form-eyebrow">ONE QUICK STEP</span>
        <h1>Set your password.</h1>
        <p className="form-intro">Hi {user?.displayName.split(' ')[0]}, choose a new password to finish setting up your account.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <label className="field-label" htmlFor="current-password">Initial password</label>
          <input className="text-input" id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          <label className="field-label" htmlFor="new-password">New password</label>
          <input className="text-input" id="new-password" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required aria-describedby="password-hint" />
          <span className="field-hint" id="password-hint">Use at least 12 characters.</span>
          <label className="field-label" htmlFor="confirm-password">Confirm new password</label>
          <input className="text-input" id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          <button className="button button--primary login-submit" type="submit" disabled={submitting}>
            <span>{submitting ? 'Saving password…' : 'Save and continue'}</span><ArrowRight size={17} />
          </button>
        </form>
      </section>
      <footer className="simple-footer">Your campus account is protected with encrypted sign-in.</footer>
    </main>
  );
}
