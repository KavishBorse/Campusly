import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Club } from '../models/Club.js';
import { Registration } from '../models/Registration.js';
import { Attendance } from '../models/Attendance.js';
import { QrToken } from '../models/QrToken.js';
import { AuditLog } from '../models/AuditLog.js';
import { mayManage } from './events.js';
import { requireAuth, enforcePasswordChange, requireRole } from '../middleware/auth.js';

const router = Router();
const auth = [requireAuth, enforcePasswordChange];
const hashToken = (value) => createHash('sha256').update(value).digest('hex');
const csvCell = (value) => {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

router.get('/admin/reports/attendance.csv', ...auth, requireRole('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.eventId) {
      if (!mongoose.isValidObjectId(req.query.eventId)) return res.status(400).json({ error: 'Invalid event id.', code: 'INVALID_INPUT' });
      filter.event = req.query.eventId;
    }
    const records = await Attendance.find(filter).populate('event', 'title').populate('user', 'username displayName enrollmentId role').populate('recordedBy', 'displayName role').sort({ recordedAt: -1 }).limit(20000).lean();
    const rows = [['Event', 'Student', 'Username', 'Role', 'Session ID', 'Status', 'Source', 'Recorded by', 'Recorded at']];
    for (const item of records) rows.push([item.event?.title, item.user?.displayName, item.user?.username, item.user?.role, item.sessionId, item.status, item.source, item.recordedBy?.displayName, item.recordedAt.toISOString()]);
    res.type('text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="campusly-attendance.csv"');
    return res.send(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) { return next(error); }
});

router.post('/events/:eventId/sessions', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (event.attendanceEnabled === false) return res.status(409).json({ error: 'Attendance is disabled for this event.', code: 'ATTENDANCE_DISABLED' });
    if (['cancelled', 'completed'].includes(event.status)) return res.status(409).json({ error: 'Sessions cannot be added to a cancelled or completed event.', code: 'EVENT_LOCKED' });
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const date = new Date(req.body?.date);
    const startsAt = new Date(req.body?.startsAt);
    const endsAt = new Date(req.body?.endsAt);
    const attendanceOpensAt = new Date(req.body?.attendanceOpensAt);
    const attendanceClosesAt = new Date(req.body?.attendanceClosesAt);
    const values = [date, startsAt, endsAt, attendanceOpensAt, attendanceClosesAt];
    const attendanceWithinSession = attendanceOpensAt >= startsAt && attendanceClosesAt <= endsAt;
    if (title.length < 2 || title.length > 120 || values.some((item) => Number.isNaN(+item)) || startsAt >= endsAt || attendanceOpensAt >= attendanceClosesAt || !attendanceWithinSession || date < new Date(new Date(event.startsAt).setHours(0, 0, 0, 0)) || date > new Date(new Date(event.endsAt).setHours(23, 59, 59, 999)) || startsAt < event.startsAt || endsAt > event.endsAt) {
      return res.status(400).json({ error: 'Check the session title, event dates, times, and keep its attendance window inside the session.', code: 'INVALID_INPUT' });
    }
    event.sessions.push({ title, date, startsAt, endsAt, attendanceOpensAt, attendanceClosesAt });
    await event.save();
    return res.status(201).json({ session: event.sessions.at(-1) });
  } catch (error) { return next(error); }
});

router.patch('/events/:eventId/sessions/:sessionId', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (event.attendanceEnabled === false) return res.status(409).json({ error: 'Attendance is disabled for this event.', code: 'ATTENDANCE_DISABLED' });
    const session = event.sessions.id(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.', code: 'NOT_FOUND' });
    if (req.body?.status !== 'cancelled') return res.status(400).json({ error: 'Sessions can only be cancelled here.', code: 'INVALID_INPUT' });
    if (session.status === 'cancelled') return res.status(409).json({ error: 'This session is already cancelled.', code: 'INVALID_SESSION_STATE' });
    if (new Date() >= session.attendanceOpensAt) return res.status(409).json({ error: 'A session cannot be cancelled after its attendance window opens.', code: 'SESSION_ALREADY_OPEN' });
    session.status = 'cancelled';
    await session.save();
    await QrToken.deleteMany({ event: event._id, sessionId: session._id });
    return res.json({ session });
  } catch (error) { return next(error); }
});

router.post('/events/:eventId/sessions/:sessionId/qr-token', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (event.attendanceEnabled === false) return res.status(409).json({ error: 'Attendance is disabled for this event.', code: 'ATTENDANCE_DISABLED' });
    const session = event.sessions.id(req.params.sessionId);
    if (!session || session.status === 'cancelled') return res.status(404).json({ error: 'Active session not found.', code: 'NOT_FOUND' });
    const now = new Date();
    if (event.status !== 'published' || now < session.attendanceOpensAt || now > session.attendanceClosesAt) return res.status(409).json({ error: 'The attendance window is not open right now.', code: 'ATTENDANCE_WINDOW_CLOSED' });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5000);
    await QrToken.create({ tokenHash: hashToken(token), event: event._id, sessionId: session._id, issuedBy: req.user._id, expiresAt });
    return res.json({ token, expiresAt, rotationSeconds: 5 });
  } catch (error) { return next(error); }
});

router.post('/attendance/scan', ...auth, requireRole('student', 'external'), async (req, res, next) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).json({ error: 'Scan a current Campusly attendance QR code.', code: 'INVALID_QR' });
    const qr = await QrToken.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    if (!qr) return res.status(410).json({ error: 'This QR code has expired. Scan the current code.', code: 'QR_EXPIRED' });
    const event = await Event.findById(qr.event);
    const session = event?.sessions.id(qr.sessionId);
    const now = new Date();
    if (!event || event.attendanceEnabled === false || event.status !== 'published' || !session || session.status === 'cancelled' || now < session.attendanceOpensAt || now > session.attendanceClosesAt) {
      return res.status(409).json({ error: 'This attendance session is closed.', code: 'SESSION_CLOSED' });
    }
    const registration = await Registration.findOne({ event: event._id, user: req.user._id, status: 'confirmed' });
    if (!registration) return res.status(403).json({ error: 'A confirmed event ticket is required to check in.', code: 'REGISTRATION_REQUIRED' });
    try {
      await Attendance.create({ event: event._id, sessionId: session._id, user: req.user._id, status: 'present', source: 'qr', recordedBy: req.user._id });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'Attendance is already recorded for this session.', code: 'DUPLICATE_ATTENDANCE' });
      throw error;
    }
    return res.status(201).json({ message: 'Attendance recorded.', event: event.title, session: session.title });
  } catch (error) { return next(error); }
});

router.get('/student/attendance', ...auth, requireRole('student', 'external'), async (req, res, next) => {
  try {
    const registrations = await Registration.find({ user: req.user._id, status: 'confirmed' }).select('event').lean();
    const events = await Event.find({ _id: { $in: registrations.map((item) => item.event) } }).select('title startsAt endsAt sessions status attendanceEnabled').lean();
    const records = await Attendance.find({ user: req.user._id, status: 'present' }).select('event sessionId recordedAt').lean();
    const recordSet = new Set(records.map((item) => `${item.event}:${item.sessionId}`));
    const now = new Date();
    const summaries = events.filter((event) => event.attendanceEnabled !== false).map((event) => {
      const completed = event.status !== 'cancelled' ? (event.sessions ?? []).filter((session) => session.status !== 'cancelled' && session.attendanceClosesAt <= now) : [];
      const attended = completed.filter((session) => recordSet.has(`${event._id}:${session._id}`));
      const eligibleDays = new Set(completed.map((session) => new Date(session.date).toISOString().slice(0, 10)));
      const attendedDays = new Set(attended.map((session) => new Date(session.date).toISOString().slice(0, 10)));
      return { eventId: event._id, title: event.title, sessionsAttended: attended.length, sessionsOccurred: completed.length, sessionPercent: completed.length ? Math.round(attended.length / completed.length * 100) : null, daysAttended: attendedDays.size, daysOccurred: eligibleDays.size, dailyPercent: eligibleDays.size ? Math.round(attendedDays.size / eligibleDays.size * 100) : null, certificateAvailable: event.endsAt <= now && event.status !== 'cancelled' && attended.length > 0 };
    });
    return res.json({ attendance: summaries });
  } catch (error) { return next(error); }
});

router.get('/student/attendance/:eventId/letter', ...auth, requireRole('student', 'external'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId).select('title mode venue startsAt endsAt status sessions attendanceEnabled').lean();
    if (!event || event.attendanceEnabled === false) return res.status(404).json({ error: 'Attendance letter not found.', code: 'NOT_FOUND' });
    if (event.status === 'cancelled') return res.status(409).json({ error: 'Attendance letters are unavailable for cancelled events.', code: 'EVENT_CANCELLED' });
    const issuedAt = new Date();
    if (event.endsAt > issuedAt) return res.status(409).json({ error: 'The attendance letter will be available after the event ends.', code: 'EVENT_NOT_FINISHED' });

    const completedSessions = (event.sessions ?? []).filter((session) => session.status !== 'cancelled' && session.endsAt <= issuedAt);
    const completedSessionIds = completedSessions.map((session) => session._id);
    const records = completedSessionIds.length
      ? await Attendance.find({ event: event._id, user: req.user._id, status: 'present', sessionId: { $in: completedSessionIds } }).select('sessionId').lean()
      : [];
    const attendedIds = new Set(records.map((record) => String(record.sessionId)));
    if (!attendedIds.size) return res.status(403).json({ error: 'An attendance record is required before a letter can be issued.', code: 'ATTENDANCE_REQUIRED' });

    const attendedSessions = completedSessions
      .filter((session) => attendedIds.has(String(session._id)))
      .map((session) => ({ title: session.title, date: session.date, startsAt: session.startsAt, endsAt: session.endsAt }));
    return res.json({ letter: {
      studentName: req.user.displayName,
      enrollmentId: req.user.accountType === 'internal' ? req.user.enrollmentId ?? null : null,
      collegeName: req.user.accountType === 'external' ? req.user.collegeName ?? null : null,
      eventTitle: event.title,
      mode: event.mode ?? 'in_person',
      venue: event.venue,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      sessionsAttended: attendedSessions.length,
      sessionsOccurred: completedSessions.length,
      attendedSessions,
      issuedAt,
    } });
  } catch (error) { return next(error); }
});

router.get('/events/:eventId/attendance', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId).populate('club', 'name');
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const registrations = await Registration.find({ event: event._id, status: 'confirmed' }).populate('user', 'username displayName email enrollmentId role').lean();
    const attendance = await Attendance.find({ event: event._id }).populate('user', 'username displayName email enrollmentId role').sort({ recordedAt: -1 }).lean();
    const audit = await AuditLog.find({ targetType: 'attendance', targetId: event._id }).populate('actor', 'displayName role').sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ event, registrations, attendance, audit });
  } catch (error) { return next(error); }
});

router.post('/events/:eventId/attendance/correction', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    const { sessionId, userId, status, reason } = req.body ?? {};
    if (!mongoose.isValidObjectId(req.params.eventId) || !mongoose.isValidObjectId(sessionId) || !mongoose.isValidObjectId(userId) || !['present', 'absent'].includes(status) || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 1000) {
      return res.status(400).json({ error: 'Choose a session, student, status, and correction reason.', code: 'INVALID_INPUT' });
    }
    const event = await Event.findById(req.params.eventId);
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (event.attendanceEnabled === false) return res.status(409).json({ error: 'Attendance is disabled for this event.', code: 'ATTENDANCE_DISABLED' });
    const session = event.sessions.id(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.', code: 'NOT_FOUND' });
    if (session.status === 'cancelled' || session.attendanceClosesAt > new Date()) return res.status(409).json({ error: 'Corrections are limited to completed, non-cancelled sessions.', code: 'SESSION_NOT_COMPLETED' });
    const registration = await Registration.findOne({ event: event._id, user: userId, status: 'confirmed' });
    if (!registration) return res.status(409).json({ error: 'Only registered participants can be corrected.', code: 'REGISTRATION_REQUIRED' });
    const existing = await Attendance.findOne({ event: event._id, sessionId, user: userId });
    const before = existing ? { status: existing.status, source: existing.source } : null;
    const after = { status, source: 'manual' };
    const attendance = await Attendance.findOneAndUpdate(
      { event: event._id, sessionId, user: userId },
      { $set: { status, source: 'manual', recordedBy: req.user._id, recordedAt: new Date() }, $setOnInsert: { event: event._id, sessionId, user: userId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    await AuditLog.create({ actor: req.user._id, action: 'attendance.corrected', targetType: 'attendance', targetId: event._id, reason: reason.trim(), before, after: { ...after, sessionId, userId } });
    return res.json({ attendance });
  } catch (error) { return next(error); }
});

router.get('/student/attendance/summary', ...auth, requireRole('student', 'external'), async (req, res, next) => {
  try {
    const registered = await Registration.find({ user: req.user._id, status: 'confirmed' }).select('event').lean();
    const events = await Event.find({ _id: { $in: registered.map((item) => item.event) } }).select('title sessions').lean();
    const records = await Attendance.find({ user: req.user._id }).select('event sessionId status').lean();
    return res.json({ events, attendance: records });
  } catch (error) { return next(error); }
});

export default router;
