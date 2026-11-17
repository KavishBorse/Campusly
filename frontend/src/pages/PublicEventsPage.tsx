import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, MapPin, Search, ShieldCheck, Users } from 'lucide-react';
import { api, messageOf } from '../api';
import { useAuth } from '../auth/AuthContext';
import { formatEventDateRange } from '../utils/eventDates';

type EventRecord = {
  _id: string; title: string; description: string; venue: string; startsAt: string; endsAt: string;
  registrationDeadline: string; capacity: number; reservedCount: number; eligibility: string;
  ticketType: 'free' | 'paid'; price: number; type: string; status?: string; attendanceEnabled?: boolean; club?: { name: string };
};

type PublicClub = { _id: string; name: string };
type PublicEvent = { _id: string; title: string; startsAt: string; endsAt: string; eligibility: 'all' | 'external'; type: string; club?: { name: string } | null };

export function PublicEventsPage() {
  const [clubs, setClubs] = useState<PublicClub[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [clubsError, setClubsError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    let active = true;
    void api<{ clubs: PublicClub[] }>('/api/public/clubs')
      .then((data) => { if (active) setClubs(data.clubs); })
      .catch((reason) => { if (active) setClubsError(messageOf(reason)); })
      .finally(() => { if (active) setClubsLoading(false); });
    void api<{ events: PublicEvent[] }>('/api/public/events')
      .then((data) => { if (active) setEvents(data.events); })
      .catch((reason) => { if (active) setEventsError(messageOf(reason)); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return events;
    return events.filter((event) => `${event.title} ${event.club?.name ?? 'Campus event'}`.toLowerCase().includes(normalized));
  }, [events, query]);

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

  return <main className="public-page campus-landing">
    <header className="public-header landing-header">
      <Link className="brand-lockup" to="/" aria-label="Campusly home"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link>
      <nav className="landing-nav" aria-label="Landing page sections"><a href="#clubs">Clubs</a><a href="#events">Events</a></nav>
      <div className="public-header-actions landing-actions">
        <Link to="/login">Sign in</Link>
        <Link className="button button--primary" to="/signup"><span className="landing-join-full">Create account</span><span className="landing-join-short">Join</span><ArrowRight size={14}/></Link>
      </div>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="landing-kicker"><span /> MIT ADT UNIVERSITY · CAMPUS LIFE</span>
        <h1>Find your place<br/><em>in campus life.</em></h1>
        <p>Campusly brings campus events and student clubs into one place, so you can see what’s happening and find the gatherings open to you.</p>
        <div className="landing-hero-actions">
          <a className="button button--primary" href="#events">Explore open events <ArrowDownRight size={16}/></a>
          <Link className="landing-create-link" to="/signup">Create an external account <ArrowRight size={15}/></Link>
        </div>
        <div className="landing-hero-note"><ShieldCheck size={15}/> External sign-up uses email verification.</div>
      </div>
      <div className="landing-hero-art">
        <img src="/campusly-emblem.png" alt="Campusly — Events, Clubs, Community" />
        <div className="landing-image-caption"><span>EVENTS · CLUBS · COMMUNITY</span><strong>A little more campus, every day.</strong></div>
        {!eventsLoading && events[0] && <Link className="landing-next-event" to={`/events/${events[0]._id}`}>
          <span className="landing-next-label"><span/> NEXT UP · {new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(events[0].startsAt))}</span>
          <strong>{events[0].title}</strong>
          <span className="landing-next-open">Open to external students <ArrowUpRight size={15}/></span>
        </Link>}
      </div>
    </section>

    <section className="landing-intro" aria-labelledby="landing-intro-title">
      <div className="landing-intro-heading"><span className="landing-section-label">A CAMPUS HUB</span><h2 id="landing-intro-title">Campus life,<br/>easier to find.</h2></div>
      <div className="landing-intro-content"><p>From student-run clubs to campus-wide events, Campusly helps you find the people and plans that make university life feel connected.</p>
        <div className="landing-points">
          <article><span>01</span><div><strong>See what’s on</strong><small>Browse upcoming events across campus.</small></div></article>
          <article><span>02</span><div><strong>Meet the clubs</strong><small>Get to know the communities at MIT ADT.</small></div></article>
          <article><span>03</span><div><strong>Know what’s open</strong><small>Public listings are limited to events you can join.</small></div></article>
        </div>
      </div>
    </section>

    <section className="landing-clubs" id="clubs" aria-labelledby="landing-clubs-title">
      <div className="landing-section-heading"><div><span className="landing-section-label">THE PEOPLE BEHIND CAMPUS LIFE</span><h2 id="landing-clubs-title">Clubs at MIT ADT</h2></div><span className="landing-count">{clubsLoading ? '…' : clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}</span></div>
      {clubsError && <p className="landing-error" role="status">Club names couldn’t load right now. Please refresh to try again.</p>}
      {clubsLoading ? <p className="landing-empty">Loading clubs…</p> : clubs.length ? <div className="landing-club-grid">{clubs.map((club, index) => <article className="landing-club" key={club._id}><span className="landing-club-number">{String(index + 1).padStart(2, '0')}</span><h3>{club.name}</h3><span className="landing-club-mark"><Users size={16}/></span></article>)}</div> : !clubsError && <p className="landing-empty">Club listings will appear here as clubs are added to Campusly.</p>}
    </section>

    <section className="landing-events" id="events" aria-labelledby="landing-events-title">
      <div className="landing-section-heading landing-events-heading"><div><span className="landing-section-label">UPCOMING · OPEN TO EXTERNAL STUDENTS</span><h2 id="landing-events-title">Plans worth showing up for.</h2></div><span className="landing-count">{eventsLoading ? '…' : events.length} {events.length === 1 ? 'event' : 'events'}</span></div>
      <div className="landing-events-toolbar"><p>Only published events with open registration are listed here. Each card shows the essentials.</p><label className="landing-search"><Search size={16}/><input aria-label="Search open events" placeholder="Find an event" value={query} onChange={(event) => setQuery(event.target.value)}/></label></div>
      {eventsError && <p className="landing-error" role="status">Upcoming events couldn’t load right now. Please refresh to try again.</p>}
      {eventsLoading ? <p className="landing-empty">Loading upcoming events…</p> : filteredEvents.length ? <div className="landing-event-list">{filteredEvents.map((event, index) => <article className="landing-event" key={event._id}>
        <span className="landing-event-index">{String(index + 1).padStart(2, '0')}</span>
        <div className="landing-event-date"><CalendarDays size={16}/><span>{formatEventDateRange(event.startsAt, event.endsAt, dateOptions, timeOptions)}</span></div>
        <div className="landing-event-main"><h3>{event.title}</h3><span>{event.type === 'club' ? event.club?.name ?? 'Campus club' : 'MIT ADT University'}</span></div>
        <span className={`landing-event-access ${event.eligibility === 'external' ? 'landing-event-access--external' : ''}`}>{event.eligibility === 'external' ? 'EXTERNAL STUDENTS' : 'OPEN TO ALL'}</span>
        <Link to={`/events/${event._id}`} className="landing-event-link" aria-label={`View ${event.title}`}><ArrowRight size={17}/></Link>
      </article>)}</div> : !eventsError ? <p className="landing-empty">{query ? 'No open events match that search.' : 'There are no upcoming events open to external students right now. Check back soon.'}</p> : null}
    </section>

    <section className="landing-cta"><div><span className="landing-section-label">YOUR NEXT CAMPUS DAY STARTS HERE</span><h2>Come be part of it.</h2><p>Create an external student account to register for events that welcome you.</p></div><div className="landing-cta-actions"><Link className="button button--primary" to="/signup">Create external account <ArrowRight size={15}/></Link><Link className="landing-login-link" to="/login">Already have an account? Sign in</Link></div></section>
    <footer className="public-footer landing-footer"><span>MIT ADT UNIVERSITY · PUNE</span><span><ShieldCheck size={13}/> Campusly · Events, clubs, community</span></footer>
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
  return <main className="public-page"><header className="public-header"><Link className="brand-lockup" to="/"><span className="brand-mark brand-mark--small">c</span><span>campusly</span></Link><Link to="/events" className="text-link"><ArrowLeft size={16}/> All events</Link></header><article className="public-detail-card"><span className={`event-type-pill event-type-pill--${event.type}`}>{event.type === 'official' ? 'Campus event' : event.club?.name ?? 'Club event'}</span><h1>{event.title}</h1><p className="public-detail-description">{event.description}</p><div className="event-meta event-meta--large"><span><CalendarDays size={16}/>{formatEventDateRange(event.startsAt, event.endsAt, { dateStyle: 'full' }, { timeStyle: 'short' })}</span><span><MapPin size={16}/>{event.venue}</span><span>{event.reservedCount} / {event.capacity} seats reserved</span></div><div className="event-policy-grid"><div><small>ELIGIBILITY</small><strong>{event.eligibility === 'all' ? 'Internal and external students' : event.eligibility === 'internal' ? 'MIT students' : 'External students'}</strong></div><div><small>REGISTRATION CLOSES</small><strong>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.registrationDeadline))}</strong></div><div><small>TICKET</small><strong>{event.ticketType === 'free' ? 'Free' : `₹${event.price} · simulated demo payment`}</strong></div><div><small>ATTENDANCE</small><strong>{event.attendanceEnabled === false ? 'Not tracked' : 'Check-in tracked · letter after attendance'}</strong></div></div><div className="public-detail-actions"><Link className="button button--primary" to={workspacePath} state={user ? undefined : { from: `/student/events/${event._id}` }}>{user ? 'Open in your workspace' : 'Sign in to register'} <ArrowRight size={15}/></Link>{!user && <Link className="button button--secondary" to="/signup">External student? Create an account</Link>}</div>{event.ticketType === 'paid' && <p className="demo-payment-note">Demo payment only. No real money will be charged.</p>}</article></main>;
}
