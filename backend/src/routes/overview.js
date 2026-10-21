import { Router } from 'express';
import { User } from '../models/User.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Attendance } from '../models/Attendance.js';
import { Club } from '../models/Club.js';
import { Booking } from '../models/Booking.js';
import { enforcePasswordChange, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/admin/overview', requireAuth, enforcePasswordChange, requireRole('admin'), async (_req, res, next) => {
  try {
    const users = await User.countDocuments({ status: 'active' });
    const [events, pendingApprovals] = await Promise.all([
      Event.countDocuments({ status: 'published' }),
      Event.countDocuments({ status: 'pending_approval' }),
    ]);
    return res.json({ role: 'admin', activeAccounts: users, events, pendingApprovals });
  } catch (error) {
    return next(error);
  }
});

router.get('/club/overview', requireAuth, enforcePasswordChange, requireRole('club'), async (req, res, next) => {
  try {
    const club = await Club.findOne({ user: req.user._id }).select('_id');
    if (!club) return res.json({ role: 'club', events: 0, registrations: 0, openSessions: 0 });
    const events = await Event.find({ club: club._id }).select('_id sessions').lean();
    const ids = events.map((event) => event._id);
    const [registrations, openSessions] = await Promise.all([
      Registration.countDocuments({ event: { $in: ids }, status: 'confirmed' }),
      Promise.resolve(events.reduce((total, event) => total + event.sessions.filter((session) => session.status === 'scheduled' && session.attendanceOpensAt <= new Date() && session.attendanceClosesAt >= new Date()).length, 0)),
    ]);
    return res.json({ role: 'club', events: events.length, registrations, openSessions });
  } catch (error) { return next(error); }
});

router.get('/student/overview', requireAuth, enforcePasswordChange, requireRole('student', 'external'), async (req, res, next) => {
  try {
    const now = new Date();
    const [upcomingEvents, bookings, attendanceSessions] = await Promise.all([
      Event.countDocuments({ status: 'published', startsAt: { $gt: now }, registrationDeadline: { $gt: now }, $or: [{ eligibility: 'all' }, { eligibility: req.user.role === 'external' ? 'external' : 'internal' }] }),
      Booking.countDocuments({ user: req.user._id, status: 'confirmed' }),
      Attendance.countDocuments({ user: req.user._id, status: 'present' }),
    ]);
    return res.json({ role: 'student', upcomingEvents, bookings, attendanceSessions });
  } catch (error) { return next(error); }
});

export default router;
