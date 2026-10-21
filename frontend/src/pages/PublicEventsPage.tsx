import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Search, ShieldCheck } from 'lucide-react';
import { api, messageOf } from '../api';
import { useAuth } from '../auth/AuthContext';

type EventRecord = {
  _id: string; title: string; description: string; venue: string; startsAt: string; endsAt: string;
  registrationDeadline: string; capacity: number; reservedCount: number; eligibility: string;
  ticketType: 'free' | 'paid'; price: number; type: string; status?: string; club?: { name: string };
};

export function PublicEventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load(search = '') {
    setLoading(true);
    try { const data = await api<{ events: EventRecord[] }>(`/api/events${search ? `?q=${encodeURIComponent(search)}` : ''}`); setEvents(data.events); setError(''); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  function search(event: FormEvent) { event.preventDefault(); void load(query.trim()); }
  return <main className="public-page">
    <header className="public-header"><Link className="brand-lockup" to="/"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link><div className="public-header-actions"><Link to="/signup">External student signup</Link><Link className="button button--primary" to="/login">Sign in <ArrowRight size={15} /></Link></div></header>
    <section className="public-hero"><span className="eyebrow"><CalendarDays size={14} /> CAMPUS, IN MOTION</span><h1>Find your next thing.</h1><p>Discover gatherings, ideas, and experiences across your campus.</p>
      <form className="event-search" onSubmit={search}><Search size={18} /><input aria-label="Search events" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, places, or ideas"/><button className="button button--primary" type="submit">Search</button></form>
    </section>
    <section className="public-events-section"><div className="tool-section-heading"><div><span className="section-kicker">OPEN TO YOUR CAMPUS</span><h2>Upcoming events</h2></div><span>{events.length} {events.length === 1 ? 'event' : 'events'}</span></div>
      {error && <div className="form-alert" role="alert">{error}</div>}{loading ? <div className="tool-empty">Loading events…</div> : events.length ? <div className="public-event-grid">{events.map((event) => <article className="public-event-card" key={event._id}><div className="public-event-card-top"><span className={`event-type-pill event-type-pill--${event.type}`}>{event.type === 'official' ? 'Campus event' : event.club?.name ?? 'Club event'}</span><span className="event-status-pill">{event.ticketType === 'free' ? 'Free' : `₹${event.price}`}</span></div><h3>{event.title}</h3><p>{event.description}</p><div className="event-meta"><span><CalendarDays size={14}/>{new Intl.DateTimeFormat('en-IN',{weekday:'short',month:'short',day:'numeric'}).format(new Date(event.startsAt))}</span><span><MapPin size={14}/>{event.venue}</span></div><Link className="text-link" to={`/events/${event._id}`}>View event <ArrowRight size={15}/></Link></article>)}</div> : <div className="tool-empty"><CalendarDays size={24}/><strong>No upcoming events yet</strong><span>Try another search or check back soon.</span></div>}
    </section>
    <footer className="public-footer"><span>MADE FOR THE MOMENTS BETWEEN CLASSES.</span><span><ShieldCheck size={13}/> Campusly keeps your campus connected.</span></footer>
  </main>;
}

export function PublicEventDetailPage() {
  const { eventId = '' } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api<{ event: EventRecord }>(`/api/events/${eventId}`).then((data) => setEvent(data.event)).catch((reason) => setError(messageOf(reason))); }, [eventId]);
  if (error) return <main className="public-page"><header className="public-header"><Link to="/events" className="text-link"><ArrowLeft size={16}/> Browse events</Link></header><div className="tool-empty">{error}</div></main>;
  if (!event) return <main className="public-page"><div className="tool-empty">Loading event…</div></main>;
  const workspacePath = user ? `/${user.role === 'external' ? 'student' : user.role}/events/${event._id}` : '/login';
  return <main className="public-page"><header className="public-header"><Link className="brand-lockup" to="/"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link><Link to="/events" className="text-link"><ArrowLeft size={16}/> All events</Link></header><article className="public-detail-card"><span className={`event-type-pill event-type-pill--${event.type}`}>{event.type === 'official' ? 'Campus event' : event.club?.name ?? 'Club event'}</span><h1>{event.title}</h1><p className="public-detail-description">{event.description}</p><div className="event-meta event-meta--large"><span><CalendarDays size={16}/>{new Intl.DateTimeFormat('en-IN',{dateStyle:'full',timeStyle:'short'}).format(new Date(event.startsAt))}</span><span><MapPin size={16}/>{event.venue}</span><span>{event.reservedCount} / {event.capacity} seats reserved</span></div><div className="event-policy-grid"><div><small>ELIGIBILITY</small><strong>{event.eligibility === 'all' ? 'Internal and external students' : event.eligibility === 'internal' ? 'MIT students' : 'External students'}</strong></div><div><small>REGISTRATION CLOSES</small><strong>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.registrationDeadline))}</strong></div><div><small>TICKET</small><strong>{event.ticketType === 'free' ? 'Free' : `₹${event.price} · simulated demo payment`}</strong></div></div><div className="public-detail-actions"><Link className="button button--primary" to={workspacePath} state={user ? undefined : { from: `/student/events/${event._id}` }}>{user ? 'Open in your workspace' : 'Sign in to register'} <ArrowRight size={15}/></Link>{!user && <Link className="button button--secondary" to="/signup">External student? Create an account</Link>}</div>{event.ticketType === 'paid' && <p className="demo-payment-note">Demo payment only. No real money will be charged.</p>}</article></main>;
}
