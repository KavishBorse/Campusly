import { Router } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Club } from '../models/Club.js';
import { Booking } from '../models/Booking.js';
import { Registration } from '../models/Registration.js';
import { Payment } from '../models/Payment.js';
import { Notification } from '../models/Notification.js';
import { NotificationBatch } from '../models/NotificationBatch.js';
import { Attendance } from '../models/Attendance.js';
import { AuditLog } from '../models/AuditLog.js';
import { QrToken } from '../models/QrToken.js';
import { randomBytes } from 'node:crypto';
import { requireAuth, enforcePasswordChange, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const auth = [requireAuth, enforcePasswordChange];
const objectId = (value) => mongoose.isValidObjectId(value);
const dateValue = (value) => value ? new Date(value) : null;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function visibleAudiences(user) {
  if (user?.role === 'admin' || user?.role === 'club') return ['all', 'internal', 'external'];
  if (user?.role === 'student' && user.accountType === 'internal') return ['all', 'internal'];
  return ['all', 'external'];
}

function audiencesForQuery(audience) {
  if (audience === 'all') return ['all'];
  if (audience === 'internal') return ['all', 'internal'];
  if (audience === 'external') return ['all', 'external'];
  return null;
}

function canViewPublishedEvent(event, user, manager) {
  if (manager || user?.role === 'admin') return true;
  if (!user) return ['all', 'external'].includes(event.eligibility);
  if (user.role === 'student' && user.accountType === 'internal') return ['all', 'internal'].includes(event.eligibility);
  return ['all', 'external'].includes(event.eligibility);
}

function withSessionStates(event, now = Date.now()) {
  return {
    ...event,
    sessions: (event.sessions ?? []).map((session) => ({
      ...session,
      attendanceStatus: session.status === 'cancelled'
        ? 'cancelled'
        : now < new Date(session.attendanceOpensAt).getTime()
          ? 'scheduled'
          : now <= new Date(session.attendanceClosesAt).getTime()
            ? 'open'
            : 'closed',
    })),
  };
}

function eligibleFor(event, user) {
  if (!user) return false;
  if (event.eligibility === 'all') return (user.role === 'student' && user.accountType === 'internal') || user.role === 'external';
  if (event.eligibility === 'internal') return user.role === 'student' && user.accountType === 'internal';
  return user.role === 'external';
}

async function mayManage(user, event) {
  if (user.role === 'admin') return true;
  if (user.role !== 'club' || !event.club) return false;
  const clubId = event.club._id ?? event.club;
  const club = await Club.findById(clubId).select('user status');
  return Boolean(club && club.status === 'active' && String(club.user) === String(user._id));
}

function eventPayload(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const venue = typeof body?.venue === 'string' ? body.venue.trim() : '';
  const startsAt = dateValue(body?.startsAt);
  const endsAt = dateValue(body?.endsAt);
  const registrationDeadline = dateValue(body?.registrationDeadline);
  const capacity = Number(body?.capacity);
  const eligibility = body?.eligibility;
  const ticketType = body?.ticketType;
  const price = ticketType === 'free' ? 0 : Number(body?.price);
  const attendanceEnabled = body?.attendanceEnabled === undefined ? true : body.attendanceEnabled;
  const validDates = startsAt && endsAt && registrationDeadline && !Number.isNaN(+startsAt) && !Number.isNaN(+endsAt) && !Number.isNaN(+registrationDeadline) && registrationDeadline <= startsAt && startsAt < endsAt;
  if (title.length < 5 || title.length > 140 || description.length < 20 || description.length > 5000 || venue.length < 2 || venue.length > 240 || !validDates || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000 || !['all', 'internal', 'external'].includes(eligibility) || !['free', 'paid'].includes(ticketType) || !Number.isFinite(price) || price < 0 || price > 10000000 || (ticketType === 'paid' && price <= 0) || typeof attendanceEnabled !== 'boolean') {
    return { error: 'Check the event details, dates, capacity, eligibility, ticket price, and attendance setting.' };
  }
  return { value: { title, description, venue, startsAt, endsAt, registrationDeadline, capacity, eligibility, ticketType, price, attendanceEnabled } };
}

router.get('/manage', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'club') {
      const club = await Club.findOne({ user: req.user._id, status: 'active' }).select('_id');
      if (!club) return res.status(403).json({ error: 'An active club profile is required.', code: 'CLUB_UNAVAILABLE' });
      filter = { club: club._id };
    }
    if (['draft', 'pending_approval', 'published', 'changes_requested', 'rejected', 'cancelled', 'completed'].includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.q.trim().slice(0, 80)), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }, { venue: pattern }];
    }
    const requestedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
    const requestedPageSize = Number.parseInt(String(req.query.limit ?? '100'), 10);
    const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, 100) : 100;
    const [events, total] = await Promise.all([
      Event.find(filter).populate('club', 'name slug').populate('createdBy', 'displayName').sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Event.countDocuments(filter),
    ]);
    return res.json({ events: events.map((event) => withSessionStates(event)), total, page, pageSize });
  } catch (error) { return next(error); }
});

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: 'published', startsAt: { $gt: now }, registrationDeadline: { $gt: now } };
    const allowedAudiences = visibleAudiences(req.user);
    const requestedAudiences = audiencesForQuery(req.query.eligibility);
    filter.eligibility = { $in: (requestedAudiences ?? allowedAudiences).filter((audience) => allowedAudiences.includes(audience)) };
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.q.trim().slice(0, 80)), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }, { venue: pattern }];
    }
    const events = await Event.find(filter).populate('club', 'name slug').sort({ startsAt: 1 }).limit(100).lean();
    return res.json({ events: events.map((event) => ({ ...withSessionStates(event), isEligible: eligibleFor(event, req.user) })) });
  } catch (error) { return next(error); }
});

router.post('/', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    const parsed = eventPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error, code: 'INVALID_INPUT' });
    const now = new Date();
    if (parsed.value.startsAt <= now || parsed.value.registrationDeadline <= now) {
      return res.status(400).json({ error: 'The event start and registration deadline must be in the future.', code: 'EVENT_DATES_IN_PAST' });
    }
    let club = null;
    let type = 'official';
    let status = 'published';
    if (req.user.role === 'club') {
      club = await Club.findOne({ user: req.user._id, status: 'active' });
      if (!club) return res.status(403).json({ error: 'An active club profile is required.', code: 'CLUB_UNAVAILABLE' });
      type = 'club';
      status = 'draft';
    }
    const event = await Event.create({ ...parsed.value, type, club: club?._id ?? null, createdBy: req.user._id, status });
    return res.status(201).json({ event });
  } catch (error) { return next(error); }
});

router.get('/:eventId', optionalAuth, async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId).populate('club', 'name slug').populate('createdBy', 'displayName').lean();
    if (!event) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const manager = req.user ? await mayManage(req.user, event) : false;
    const visibleStatus = event.status === 'published' || event.status === 'completed';
    if (!visibleStatus && !manager) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (visibleStatus && !canViewPublishedEvent(event, req.user, manager)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    return res.json({ event: { ...withSessionStates(event), isEligible: eligibleFor(event, req.user), canManage: manager } });
  } catch (error) { return next(error); }
});

router.delete('/:eventId', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (!await mayManage(req.user, event)) return res.status(403).json({ error: 'You can only delete events managed by your account.', code: 'FORBIDDEN' });

    const [hasRegistrations, hasBookings, hasPayments, hasAttendance, hasAuditHistory] = await Promise.all([
      Registration.exists({ event: event._id }),
      Booking.exists({ event: event._id }),
      Payment.exists({ event: event._id }),
      Attendance.exists({ event: event._id }),
      AuditLog.exists({ targetType: 'attendance', targetId: event._id }),
    ]);
    if (event.reservedCount > 0 || hasRegistrations || hasBookings || hasPayments || hasAttendance || hasAuditHistory) {
      const error = req.user.role === 'admin'
        ? 'This event has registration or attendance history and cannot be deleted. Cancel it to preserve participant and payment records.'
        : 'This event has registration or attendance history and cannot be deleted. Ask a campus administrator to cancel it so participant and payment records are preserved.';
      return res.status(409).json({ error, code: 'EVENT_HAS_HISTORY' });
    }

    const deletedEvent = await Event.findOneAndDelete({ _id: event._id, status: event.status, reservedCount: 0 });
    if (!deletedEvent) return res.status(409).json({ error: 'The event changed while you were deleting it. Refresh and try again.', code: 'EVENT_CHANGED' });
    await Promise.all([
      QrToken.deleteMany({ event: deletedEvent._id }),
      Notification.deleteMany({ event: deletedEvent._id }),
      NotificationBatch.deleteMany({ event: deletedEvent._id }),
    ]);
    return res.json({ message: 'Event deleted.' });
  } catch (error) { return next(error); }
});

router.patch('/:eventId', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (!await mayManage(req.user, event)) return res.status(403).json({ error: 'You can only edit events managed by your account.', code: 'FORBIDDEN' });
    if (event.status === 'cancelled' || event.status === 'completed') return res.status(409).json({ error: 'This event can no longer be edited.', code: 'EVENT_LOCKED' });
    const parsed = eventPayload({ ...event.toObject(), ...req.body });
    if (parsed.error) return res.status(400).json({ error: parsed.error, code: 'INVALID_INPUT' });
    const dateFieldsChanged = ['startsAt', 'endsAt', 'registrationDeadline'].some((key) => String(event[key]) !== String(parsed.value[key]));
    if (dateFieldsChanged && (parsed.value.startsAt <= new Date() || parsed.value.registrationDeadline <= new Date())) {
      return res.status(400).json({ error: 'Updated event dates and registration deadline must be in the future.', code: 'EVENT_DATES_IN_PAST' });
    }
    if (parsed.value.capacity < event.reservedCount) return res.status(409).json({ error: 'Capacity cannot be lower than the number of current reservations.', code: 'CAPACITY_BELOW_RESERVED' });
    if (event.attendanceEnabled !== false && !parsed.value.attendanceEnabled) {
      const hasAttendance = await Attendance.exists({ event: event._id });
      if (event.sessions.length || hasAttendance) return res.status(409).json({ error: 'Attendance cannot be disabled after sessions or attendance records exist.', code: 'ATTENDANCE_ALREADY_CONFIGURED' });
    }
    if (event.sessions.some((session) => session.startsAt < parsed.value.startsAt || session.endsAt > parsed.value.endsAt)) {
      return res.status(409).json({ error: 'Update or cancel scheduled sessions before changing the event dates around them.', code: 'SESSION_OUTSIDE_EVENT' });
    }
    const materialFields = ['startsAt', 'endsAt', 'registrationDeadline', 'venue', 'capacity', 'price', 'ticketType', 'eligibility', 'attendanceEnabled'];
    const changedMaterially = materialFields.some((key) => String(event[key]) !== String(parsed.value[key]));
    Object.assign(event, parsed.value);
    if (req.user.role === 'club' && event.status === 'published' && changedMaterially) {
      event.status = 'pending_approval';
      event.reviewFeedback = '';
      event.reviewedAt = null;
      event.reviewedBy = null;
    }
    await event.save();
    return res.json({ event });
  } catch (error) { return next(error); }
});

router.post('/:eventId/submit', ...auth, requireRole('club'), async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (!['draft', 'changes_requested', 'rejected'].includes(event.status)) return res.status(409).json({ error: 'Only drafts or events with review feedback can be submitted.', code: 'INVALID_EVENT_STATE' });
    event.status = 'pending_approval';
    event.reviewFeedback = '';
    await event.save();
    return res.json({ event });
  } catch (error) { return next(error); }
});

router.post('/:eventId/review', ...auth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Club submission not found.', code: 'NOT_FOUND' });
    const { decision, feedback = '' } = req.body ?? {};
    if (!['approve', 'reject', 'changes_requested'].includes(decision) || typeof feedback !== 'string' || feedback.length > 1000 || (decision !== 'approve' && feedback.trim().length < 3)) {
      return res.status(400).json({ error: 'Choose approve, reject, or request changes. Add feedback when declining.', code: 'INVALID_INPUT' });
    }
    const event = await Event.findById(req.params.eventId);
    if (!event || event.type !== 'club') return res.status(404).json({ error: 'Club submission not found.', code: 'NOT_FOUND' });
    if (event.status !== 'pending_approval') return res.status(409).json({ error: 'This event is not waiting for approval.', code: 'INVALID_EVENT_STATE' });
    if (decision === 'approve' && (event.startsAt <= new Date() || event.registrationDeadline <= new Date())) {
      return res.status(409).json({ error: 'This submission’s registration deadline or event time has passed. Request updated dates before publishing it.', code: 'EVENT_DATES_IN_PAST' });
    }
    event.status = decision === 'approve' ? 'published' : decision;
    event.reviewFeedback = feedback.trim();
    event.reviewedBy = req.user._id;
    event.reviewedAt = new Date();
    await event.save();
    return res.json({ event });
  } catch (error) { return next(error); }
});

router.post('/:eventId/cancel', ...auth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (event.status === 'cancelled') return res.json({ event });
    if (event.status === 'completed') return res.status(409).json({ error: 'Completed events cannot be cancelled.', code: 'EVENT_LOCKED' });
    const suppliedReason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
    if (req.body?.reason !== undefined && suppliedReason.length < 3) return res.status(400).json({ error: 'Add a cancellation reason with at least 3 characters.', code: 'INVALID_INPUT' });
    const reason = suppliedReason || 'Cancelled by campus administrator.';
    const cancelled = await Event.findOneAndUpdate(
      { _id: event._id, status: { $ne: 'cancelled' } },
      { $set: { status: 'cancelled', reviewFeedback: reason } },
      { new: true },
    );
    if (!cancelled) return res.json({ event: await Event.findById(event._id) });
    const cancelledEvent = cancelled;
    const bookings = await Booking.find({ event: cancelledEvent._id, status: 'confirmed' }).select('_id user amount paymentType').lean();
    await Promise.all([
      Booking.updateMany({ event: cancelledEvent._id, status: 'confirmed', paymentType: 'free' }, { $set: { status: 'cancelled', ticketCode: null } }),
      Booking.updateMany({ event: cancelledEvent._id, status: 'confirmed', paymentType: 'simulated' }, { $set: { status: 'refunded', ticketCode: null } }),
      Registration.updateMany({ event: cancelledEvent._id, status: { $in: ['confirmed', 'pending'] } }, { $set: { status: 'cancelled', ticketCode: null } }),
      Event.updateOne({ _id: cancelledEvent._id }, { $set: { reservedCount: 0 } }),
    ]);
    const paidBookings = bookings.filter((booking) => booking.paymentType === 'simulated' && booking.amount > 0);
    if (paidBookings.length) await Payment.insertMany(paidBookings.map((booking) => ({ booking: booking._id, user: booking.user, event: cancelledEvent._id, amount: booking.amount, status: 'refunded', providerReference: `DEMO-REFUND-${randomBytes(10).toString('hex').toUpperCase()}`, message: 'Event cancellation. Simulated refund recorded; no real money was moved.' })));
    const recipientIds = [...new Map(bookings.map((booking) => [String(booking.user), booking.user])).values()];
    if (recipientIds.length) await Notification.insertMany(recipientIds.map((recipient) => ({ sender: req.user._id, recipient, event: cancelledEvent._id, title: 'Event cancelled', message: `${cancelledEvent.title} was cancelled. Reason: ${reason} Any paid demo bookings have a simulated refund record.` })));
    return res.json({ event: cancelledEvent });
  } catch (error) { return next(error); }
});

router.post('/:eventId/complete', ...auth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!objectId(req.params.eventId)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const now = new Date();
    const event = await Event.findOneAndUpdate(
      { _id: req.params.eventId, status: 'published', endsAt: { $lte: now } },
      { $set: { status: 'completed' } },
      { new: true },
    );
    if (event) return res.json({ event, message: 'Event marked as completed.' });
    const current = await Event.findById(req.params.eventId).select('status endsAt');
    if (!current) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (current.status !== 'published') return res.status(409).json({ error: 'Only published events can be marked complete.', code: 'INVALID_EVENT_STATE' });
    return res.status(409).json({ error: 'The event cannot be marked complete until its scheduled end time.', code: 'EVENT_NOT_ENDED' });
  } catch (error) { return next(error); }
});

export { eligibleFor, mayManage };
export default router;
