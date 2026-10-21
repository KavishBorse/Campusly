import { Router } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Club } from '../models/Club.js';
import { Booking } from '../models/Booking.js';
import { Registration } from '../models/Registration.js';
import { Payment } from '../models/Payment.js';
import { Notification } from '../models/Notification.js';
import { randomBytes } from 'node:crypto';
import { requireAuth, enforcePasswordChange, requireRole, optionalAuth } from '../middleware/auth.js';

const router = Router();
const auth = [requireAuth, enforcePasswordChange];
const objectId = (value) => mongoose.isValidObjectId(value);
const dateValue = (value) => value ? new Date(value) : null;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  if (event.eligibility === 'all') return (user.role === 'student' && user.accountType === 'internal') || (user.role === 'external' && user.emailVerified);
  if (event.eligibility === 'internal') return user.role === 'student' && user.accountType === 'internal';
  return user.role === 'external' && user.emailVerified;
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
  const validDates = startsAt && endsAt && registrationDeadline && !Number.isNaN(+startsAt) && !Number.isNaN(+endsAt) && !Number.isNaN(+registrationDeadline) && registrationDeadline <= startsAt && startsAt < endsAt;
  if (title.length < 5 || title.length > 140 || description.length < 20 || description.length > 5000 || venue.length < 2 || venue.length > 240 || !validDates || !Number.isInteger(capacity) || capacity < 1 || capacity > 100000 || !['all', 'internal', 'external'].includes(eligibility) || !['free', 'paid'].includes(ticketType) || !Number.isFinite(price) || price < 0 || price > 10000000 || (ticketType === 'paid' && price <= 0)) {
    return { error: 'Check the title, description, venue, dates, capacity, eligibility, and ticket price.' };
  }
  return { value: { title, description, venue, startsAt, endsAt, registrationDeadline, capacity, eligibility, ticketType, price } };
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
    const events = await Event.find(filter).populate('club', 'name slug').populate('createdBy', 'displayName').sort({ updatedAt: -1 }).limit(300).lean();
    return res.json({ events: events.map((event) => withSessionStates(event)) });
  } catch (error) { return next(error); }
});

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const filter = { status: 'published', startsAt: { $gt: now }, registrationDeadline: { $gt: now } };
    if (['all', 'internal', 'external'].includes(req.query.eligibility)) filter.eligibility = req.query.eligibility;
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
    if (event.status !== 'published' && !manager) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    return res.json({ event: { ...withSessionStates(event), isEligible: eligibleFor(event, req.user), canManage: manager } });
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
    if (parsed.value.capacity < event.reservedCount) return res.status(409).json({ error: 'Capacity cannot be lower than the number of current reservations.', code: 'CAPACITY_BELOW_RESERVED' });
    const materialFields = ['startsAt', 'endsAt', 'registrationDeadline', 'venue', 'capacity', 'price', 'ticketType', 'eligibility'];
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
    const { decision, feedback = '' } = req.body ?? {};
    if (!['approve', 'reject', 'changes_requested'].includes(decision) || typeof feedback !== 'string' || feedback.length > 1000 || (decision !== 'approve' && feedback.trim().length < 3)) {
      return res.status(400).json({ error: 'Choose approve, reject, or request changes. Add feedback when declining.', code: 'INVALID_INPUT' });
    }
    const event = await Event.findById(req.params.eventId);
    if (!event || event.type !== 'club') return res.status(404).json({ error: 'Club submission not found.', code: 'NOT_FOUND' });
    if (event.status !== 'pending_approval') return res.status(409).json({ error: 'This event is not waiting for approval.', code: 'INVALID_EVENT_STATE' });
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
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    if (event.status === 'cancelled') return res.json({ event });
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : 'Cancelled by campus administrator.';
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
    if (recipientIds.length) await Notification.insertMany(recipientIds.map((recipient) => ({ sender: req.user._id, recipient, event: cancelledEvent._id, title: 'Event cancelled', message: `${cancelledEvent.title} was cancelled. Any paid demo bookings have a simulated refund record.` })));
    return res.json({ event: cancelledEvent });
  } catch (error) { return next(error); }
});

export { eligibleFor, mayManage };
export default router;
