import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api, messageOf } from '../api';
import { formatEventDateRange } from '../utils/eventDates';
import { BrandLogo } from '../ui/BrandLogo';

type AttendanceLetter = {
  studentName: string;
  enrollmentId: string | null;
  collegeName: string | null;
  eventTitle: string;
  mode?: 'in_person' | 'online' | 'hybrid';
  venue: string;
  eventStartsAt: string;
  eventEndsAt: string;
  sessionsAttended: number;
  sessionsOccurred: number;
  attendedSessions: Array<{ title: string; date: string; startsAt: string; endsAt: string }>;
  issuedAt: string;
};

const fullDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(value));

export function AttendanceLetterPage() {
  const { eventId = '' } = useParams();
  const [letter, setLetter] = useState<AttendanceLetter | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void api<{ letter: AttendanceLetter }>(`/api/student/attendance/${eventId}/letter`)
      .then((data) => { if (active) setLetter(data.letter); })
      .catch((reason) => { if (active) setError(messageOf(reason)); });
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    if (!letter) return;
    const previousTitle = document.title;
    document.title = `Attendance letter - ${letter.eventTitle}`;
    return () => { document.title = previousTitle; };
  }, [letter]);

  if (error || !letter) {
    return <main className="attendance-letter-page"><div className="attendance-letter-actions"><Link className="text-link" to="/student/attendance"><ArrowLeft size={15}/> My attendance</Link></div><div className="tool-empty">{error || 'Preparing your attendance letter…'}</div></main>;
  }

  const eventDescription = letter.mode === 'online'
    ? <>attended <strong>{letter.eventTitle}</strong>, held online on {formatEventDateRange(letter.eventStartsAt, letter.eventEndsAt, { dateStyle: 'long' }, { timeStyle: 'short' })}.</>
    : letter.mode === 'hybrid'
      ? <>attended <strong>{letter.eventTitle}</strong>, held at <strong>{letter.venue}</strong> with an online option on {formatEventDateRange(letter.eventStartsAt, letter.eventEndsAt, { dateStyle: 'long' }, { timeStyle: 'short' })}.</>
      : <>attended <strong>{letter.eventTitle}</strong>, held at <strong>{letter.venue}</strong> on {formatEventDateRange(letter.eventStartsAt, letter.eventEndsAt, { dateStyle: 'long' }, { timeStyle: 'short' })}.</>;

  return <main className="attendance-letter-page">
    <div className="attendance-letter-actions">
      <Link className="text-link" to="/student/attendance"><ArrowLeft size={15}/> My attendance</Link>
      <button className="button button--primary" type="button" onClick={() => window.print()}><Printer size={15}/> Print / Save as PDF</button>
    </div>
    <article className="attendance-letter">
      <header className="attendance-letter-header">
        <span className="attendance-letter-brand"><BrandLogo className="brand-logo--letter" /></span>
        <span className="attendance-letter-issuer">MIT ADT UNIVERSITY · PUNE</span>
      </header>
      <div className="attendance-letter-rule" />
      <p className="attendance-letter-kicker">EVENT PARTICIPATION RECORD</p>
      <h1>Letter of Attendance</h1>
      <p className="attendance-letter-date">Issued {fullDate(letter.issuedAt)}</p>
      <p className="attendance-letter-to">To whom it may concern,</p>
      <p className="attendance-letter-body">
        This letter confirms that <strong>{letter.studentName}</strong>
        {letter.enrollmentId && <> (Enrollment ID: <strong>{letter.enrollmentId}</strong>)</>}
        {letter.collegeName && <> from <strong>{letter.collegeName}</strong></>} {eventDescription}
      </p>
      <p className="attendance-letter-body">
        Campusly recorded this attendee as present at <strong>{letter.sessionsAttended} of {letter.sessionsOccurred}</strong> scheduled attendance {letter.sessionsOccurred === 1 ? 'session' : 'sessions'}.
      </p>
      <section className="attendance-letter-sessions">
        <h2>Attendance recorded</h2>
        {letter.attendedSessions.map((session, index) => <div className="attendance-letter-session" key={`${session.title}-${session.startsAt}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{session.title}</strong><small>{formatEventDateRange(session.startsAt, session.endsAt, { dateStyle: 'long' }, { timeStyle: 'short' })}</small></div></div>)}
      </section>
      <p className="attendance-letter-closing">This letter was generated from the attendance records maintained in Campusly for this event.</p>
      <footer className="attendance-letter-footer"><span>Campusly · Events, clubs, community</span><span>Generated {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(letter.issuedAt))}</span></footer>
    </article>
  </main>;
}
