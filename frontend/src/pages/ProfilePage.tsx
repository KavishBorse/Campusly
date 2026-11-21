import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Save, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, jsonBody, messageOf } from '../api';
import { useAuth } from '../auth/AuthContext';

type Profile = {
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    emailVerified: boolean;
    enrollmentId: string | null;
    role: 'student' | 'external' | 'club';
    accountType: string;
    phone: string;
    collegeName: string;
  };
  club: { name: string; description: string; slug: string; status: string } | null;
};

type ProfileForm = { displayName: string; phone: string; email: string; collegeName: string; clubName: string; description: string };
const blankForm: ProfileForm = { displayName: '', phone: '', email: '', collegeName: '', clubName: '', description: '' };

export function ProfilePage() {
  const { user: sessionUser, refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileForm>(blankForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ profile: Profile }>('/api/profile');
      setProfile(data.profile);
      setForm({
        displayName: data.profile.user.displayName,
        phone: data.profile.user.phone,
        email: data.profile.user.email ?? '',
        collegeName: data.profile.user.collegeName,
        clubName: data.profile.club?.name ?? '',
        description: data.profile.club?.description ?? '',
      });
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError('');
    setNotice('');
    const payload: Record<string, string> = { displayName: form.displayName, phone: form.phone };
    if (profile.user.role === 'external') {
      payload.email = form.email;
      payload.collegeName = form.collegeName;
    }
    if (profile.user.role === 'club') {
      payload.email = form.email;
      payload.clubName = form.clubName;
      payload.description = form.description;
    }
    try {
      const data = await api<{ profile: Profile; message: string }>('/api/profile', { method: 'PATCH', body: jsonBody(payload) });
      setProfile(data.profile);
      setForm({
        displayName: data.profile.user.displayName,
        phone: data.profile.user.phone,
        email: data.profile.user.email ?? '',
        collegeName: data.profile.user.collegeName,
        clubName: data.profile.club?.name ?? '',
        description: data.profile.club?.description ?? '',
      });
      await refresh();
      setNotice(data.message);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <section className="tool-page"><div className="tool-empty">Loading your profile…</div></section>;
  if (!profile) return <section className="tool-page"><div className="form-alert" role="alert">{error || 'Your profile could not be loaded.'}<button className="button button--secondary button--small" type="button" onClick={() => void load()}>Retry</button></div></section>;

  const { user } = profile;
  const isInternal = user.role === 'student';
  const isExternal = user.role === 'external';
  const isClub = user.role === 'club';

  return <section className="tool-page profile-page">
    <div className="tool-page-heading">
      <div><span className="section-kicker">ACCOUNT SETTINGS</span><h1>Your profile.</h1><p>Keep your contact and campus details up to date.</p></div>
      <span className="metric-icon"><UserRound size={19}/></span>
    </div>
    {error && <div className="form-alert" role="alert">{error}</div>}
    {notice && <div className="form-success" role="status">{notice}</div>}

    <div className="profile-layout">
      <section className="tool-panel profile-edit-panel">
        <div className="panel-heading"><div><span className="section-kicker">{isClub ? 'CLUB ACCOUNT' : isExternal ? 'EXTERNAL STUDENT' : 'MIT STUDENT'}</span><h2>{isClub ? 'Club and contact details' : 'Personal details'}</h2></div><UserRound size={19}/></div>
        <form className="tool-form" onSubmit={save}>
          {isClub && <label>Club name<input required minLength={2} maxLength={120} value={form.clubName} onChange={(event) => updateField('clubName', event.target.value)} autoComplete="organization"/></label>}
          <label>{isClub ? 'Contact name' : 'Full name'}<input required minLength={2} maxLength={120} value={form.displayName} onChange={(event) => updateField('displayName', event.target.value)} autoComplete="name"/></label>
          {isExternal && <label>College name<input required minLength={2} maxLength={160} value={form.collegeName} onChange={(event) => updateField('collegeName', event.target.value)} autoComplete="organization"/></label>}
          {(isExternal || isClub) && <label>{isClub ? 'Contact email' : 'Email address'}<input type="email" maxLength={254} required={isExternal} value={form.email} onChange={(event) => updateField('email', event.target.value)} autoComplete="email"/><small>{isExternal ? 'This email is also your sign-in username.' : 'This is your club contact email; your sign-in username stays the same.'}</small></label>}
          <label>Phone number<input type="tel" maxLength={25} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} autoComplete="tel" placeholder="Add a phone number"/><small>{isInternal ? 'Contact number only. Your sign-in password is changed separately.' : 'Use 8–15 digits, with an optional country code.'}</small></label>
          {isClub && <label>About the club<textarea rows={5} maxLength={1000} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Tell students what your club does."/></label>}
          <button className="button button--primary profile-save-button" disabled={busy}>{busy ? 'Saving profile…' : 'Save changes'} <Save size={15}/></button>
        </form>
      </section>

      <aside className="tool-panel profile-account-panel">
        <div className="panel-heading"><div><span className="section-kicker">ACCOUNT IDENTIFIERS</span><h2>Fixed account details</h2></div><LockKeyhole size={18}/></div>
        <div className="profile-readonly-row"><span>Sign-in username</span><strong>{user.username}</strong></div>
        {isInternal && <>
          <div className="profile-readonly-row"><span>Enrollment ID</span><strong>{user.enrollmentId ?? user.username}</strong></div>
          <div className="profile-readonly-row"><span>College email</span><strong>{user.emailVerified ? user.email : 'Not linked'}</strong></div>
          <Link className="button button--secondary profile-email-link" to="/student/email">{user.emailVerified ? 'Change college email' : 'Link college email'} <ArrowRight size={14}/></Link>
          <p className="profile-locked-note">Your enrollment ID is assigned by the college and cannot be edited. College email changes must be verified.</p>
        </>}
        {isExternal && <p className="profile-locked-note">When you change your email, it also changes the username you use to sign in.</p>}
        {isClub && <p className="profile-locked-note">Your sign-in username is managed by the campus administrator and cannot be edited here.</p>}
        <div className="profile-account-footer"><span className="status-dot"/><span>Signed in as {sessionUser?.displayName ?? user.displayName}</span></div>
      </aside>
    </div>
  </section>;
}
