import { Router } from 'express';
import { randomBytes, randomInt } from 'node:crypto';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Booking } from '../models/Booking.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { Club } from '../models/Club.js';
import { Attendance } from '../models/Attendance.js';
import { requireAuth, enforcePasswordChange, requireRole } from '../middleware/auth.js';
import { eligibleFor, mayManage } from './events.js';

const router = Router();
const auth = [requireAuth, enforcePasswordChange];
const ticketCode = () => randomBytes(6).toString('hex').toUpperCase();
const demoReference = () => `DEMO-${randomBytes(10).toString('hex').toUpperCase()}`;
const csvCell = (value) => {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

router.get('/admin/reports/bookings.csv', ...auth, requireRole('admin'), async (_req, res, next) => {
  try {
    const bookings = await Booking.find().populate('event', 'title startsAt').populate('user', 'username displayName role').sort({ createdAt: -1 }).limit(10000).lean();
    const payments = await Payment.find({ booking: { $in: bookings.map((item) => item._id) } }).lean();
    const paymentsByBooking = new Map();
    for (const payment of payments) paymentsByBooking.set(String(payment.booking), [...(paymentsByBooking.get(String(payment.booking)) ?? []), payment]);
    const rows = [['Booking ID', 'Event', 'Student', 'Username', 'Role', 'Booking status', 'Ticket code', 'Amount', 'Payment type', 'Payment history', 'Created at']];
    for (const item of bookings) rows.push([item._id, item.event?.title, item.user?.displayName, item.user?.username, item.user?.role, item.status, item.ticketCode, item.amount, item.paymentType, (paymentsByBooking.get(String(item._id)) ?? []).map((p) => `${p.status}:${p.amount}`).join('; '), item.createdAt.toISOString()]);
    res.type('text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="campusly-bookings.csv"');
    return res.send(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
  } catch (error) { return next(error); }
});

router.post('/events/:eventId/register', ...auth, requireRole('student', 'external'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event || event.status !== 'published') return res.status(404).json({ error: 'Published event not found.', code: 'NOT_FOUND' });
    if (!eligibleFor(event, req.user)) return res.status(403).json({ error: 'This event is not open to your student account type.', code: 'NOT_ELIGIBLE' });
    if (event.registrationDeadline <= new Date() || event.startsAt <= new Date()) return res.status(409).json({ error: 'Registration for this event has closed.', code: 'REGISTRATION_CLOSED' });

    let registration = await Registration.findOne({ event: event._id, user: req.user._id });
    if (registration) {
      if (!['cancelled', 'payment_failed'].includes(registration.status)) return res.status(409).json({ error: 'You already have an active booking attempt for this event.', code: 'DUPLICATE_REGISTRATION' });
      registration = await Registration.findOneAndUpdate(
        { _id: registration._id, status: { $in: ['cancelled', 'payment_failed'] } },
        { $set: { status: 'pending', eligibilitySnapshot: req.user.accountType === 'external' ? 'external' : 'internal', ticketCode: null, registeredAt: new Date() } },
        { new: true },
      );
      if (!registration) return res.status(409).json({ error: 'A booking attempt is already in progress.', code: 'DUPLICATE_REGISTRATION' });
    } else {
      try {
        registration = await Registration.create({ event: event._id, user: req.user._id, status: 'pending', eligibilitySnapshot: req.user.accountType === 'external' ? 'external' : 'internal' });
      } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ error: 'A booking attempt is already in progress.', code: 'DUPLICATE_REGISTRATION' });
        throw error;
      }
    }

    const reserved = await Event.findOneAndUpdate(
      { _id: event._id, status: 'published', registrationDeadline: { $gt: new Date() }, $expr: { $lt: ['$reservedCount', '$capacity'] } },
      { $inc: { reservedCount: 1 } },
      { new: true },
    );
    if (!reserved) {
      registration.status = 'cancelled';
      await registration.save();
      return res.status(409).json({ error: 'This event is full or registration has closed.', code: 'EVENT_FULL' });
    }

    const paid = event.ticketType === 'paid';
    const paymentSucceeded = !paid || randomInt(100) < 85;
    const confirmed = paymentSucceeded;
    const code = confirmed ? ticketCode() : null;
    let booking;
    try {
      registration.status = confirmed ? 'confirmed' : 'payment_failed';
      registration.ticketCode = code;
      await registration.save();
      booking = await Booking.create({
        registration: registration._id,
        event: event._id,
        user: req.user._id,
        status: confirmed ? 'confirmed' : 'payment_failed',
        paymentType: paid ? 'simulated' : 'free',
        amount: paid ? event.price : 0,
        ticketCode: code,
      });
      if (paid) {
        await Payment.create({
          booking: booking._id,
          user: req.user._id,
          event: event._id,
          amount: event.price,
          status: paymentSucceeded ? 'succeeded' : 'failed',
          providerReference: demoReference(),
          message: paymentSucceeded ? 'Simulated payment succeeded. No money was charged.' : 'Simulated payment failed. No money was charged.',
        });
      }
    } catch (error) {
      await Event.updateOne({ _id: event._id, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } });
      await Registration.updateOne({ _id: registration._id }, { status: 'cancelled', ticketCode: null });
      if (booking) await Booking.updateOne({ _id: booking._id }, { status: 'cancelled', ticketCode: null });
      throw error;
    }
    if (!confirmed) await Event.updateOne({ _id: event._id, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } });
    return res.status(confirmed ? 201 : 402).json({
      booking,
      payment: paid ? (paymentSucceeded ? 'succeeded' : 'failed') : null,
      message: paid ? (paymentSucceeded ? 'Demo payment succeeded. No real payment was taken.' : 'Demo payment failed. No real payment was taken; you may try again.') : 'Your free ticket is confirmed.',
    });
  } catch (error) { return next(error); }
});

router.get('/bookings', ...auth, requireRole('student', 'external'), async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate('event', 'title venue startsAt endsAt status type').sort({ createdAt: -1 }).lean();
    const ids = bookings.map((booking) => booking._id);
    const payments = await Payment.find({ booking: { $in: ids } }).sort({ createdAt: 1 }).lean();
    return res.json({ bookings, payments });
  } catch (error) { return next(error); }
});

router.get('/admin/bookings', ...auth, requireRole('admin'), async (_req, res, next) => {
  try {
    const bookings = await Booking.find().populate('event', 'title startsAt status').populate('user', 'username displayName email enrollmentId role').sort({ createdAt: -1 }).limit(1000).lean();
    const payments = await Payment.find({ booking: { $in: bookings.map((item) => item._id) } }).lean();
    return res.json({ bookings, payments });
  } catch (error) { return next(error); }
});

router.get('/events/:eventId/registrations', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event || !await mayManage(req.user, event)) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const registrations = await Registration.find({ event: event._id }).populate('user', 'username displayName email enrollmentId role accountType').sort({ registeredAt: -1 }).lean();
    const bookings = await Booking.find({ event: event._id }).sort({ createdAt: -1 }).lean();
    return res.json({ registrations, bookings });
  } catch (error) { return next(error); }
});

router.post('/bookings/:bookingId/cancel', ...auth, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.', code: 'NOT_FOUND' });
    if (req.user.role !== 'admin' && String(booking.user) !== String(req.user._id)) return res.status(403).json({ error: 'You can only cancel your own booking.', code: 'FORBIDDEN' });
    if (booking.status !== 'confirmed') return res.status(409).json({ error: 'Only confirmed bookings can be cancelled.', code: 'INVALID_BOOKING_STATE' });
    const event = await Event.findById(booking.event);
    if (req.user.role !== 'admin' && event?.startsAt <= new Date()) return res.status(409).json({ error: 'Student cancellation is closed after the event begins.', code: 'CANCELLATION_CLOSED' });
    const attendance = await Attendance.exists({ event: booking.event, user: booking.user, status: 'present' });
    if (attendance) return res.status(409).json({ error: 'A booking with recorded attendance cannot be cancelled.', code: 'ATTENDANCE_EXISTS' });

    const refunded = booking.paymentType === 'simulated' && booking.amount > 0;
    const cancelledBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, status: 'confirmed' },
      { $set: { status: refunded ? 'refunded' : 'cancelled', ticketCode: null } },
      { new: true },
    );
    if (!cancelledBooking) return res.status(409).json({ error: 'This booking has already been cancelled.', code: 'INVALID_BOOKING_STATE' });
    await Registration.updateOne({ _id: booking.registration }, { status: 'cancelled', ticketCode: null });
    await Event.updateOne({ _id: booking.event, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } });
    if (refunded) await Payment.create({ booking: booking._id, user: booking.user, event: booking.event, amount: booking.amount, status: 'refunded', providerReference: demoReference(), message: 'Simulated refund recorded. No real money was moved.' });
    return res.json({ booking: cancelledBooking, message: refunded ? 'Booking cancelled and simulated refund recorded.' : 'Booking cancelled.' });
  } catch (error) { return next(error); }
});

export default router;
