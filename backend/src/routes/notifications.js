import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Notification } from '../models/Notification.js';
import { NotificationBatch } from '../models/NotificationBatch.js';
import { User } from '../models/User.js';
import { Registration } from '../models/Registration.js';
import { Event } from '../models/Event.js';
import { Club } from '../models/Club.js';
import { mayManage } from './events.js';
import { requireAuth, enforcePasswordChange, requireRole } from '../middleware/auth.js';

const router = Router();
const auth = [requireAuth, enforcePasswordChange];

router.get('/notifications', ...auth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).populate('sender', 'displayName role').populate('event', 'title').sort({ createdAt: -1 }).limit(200).lean();
    const unreadCount = notifications.filter((item) => !item.readAt).length;
    return res.json({ notifications, unreadCount });
  } catch (error) { return next(error); }
});

router.patch('/notifications/:notificationId/read', ...auth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, recipient: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
    if (!notification) return res.status(404).json({ error: 'Notification not found.', code: 'NOT_FOUND' });
    return res.json({ notification });
  } catch (error) { return next(error); }
});

router.get('/notifications/sent', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    const filter = { sender: req.user._id };
    if (req.user.role === 'club') {
      const club = await Club.findOne({ user: req.user._id, status: 'active' }).select('_id');
      if (!club) return res.status(403).json({ error: 'An active club profile is required.', code: 'CLUB_UNAVAILABLE' });
      const eventIds = await Event.distinct('_id', { club: club._id });
      filter.event = { $in: eventIds };
    }
    const messages = await NotificationBatch.find(filter).populate('event', 'title').sort({ createdAt: -1 }).limit(100).lean();
    const normalized = messages.map((item) => ({ ...item, eventTitle: item.event?.title }));
    return res.json({ messages: normalized });
  } catch (error) { return next(error); }
});

router.post('/notifications/send', ...auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { title, message, audience } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120 || typeof message !== 'string' || message.trim().length < 3 || message.trim().length > 2000 || !['all', 'internal', 'external', 'event', 'selected'].includes(audience)) {
      return res.status(400).json({ error: 'Enter a title, message, and supported audience.', code: 'INVALID_INPUT' });
    }
    let recipients;
    let eventId = null;
    if (audience === 'event') {
      const event = await Event.findById(req.body.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
      eventId = event._id;
      const regs = await Registration.find({ event: event._id, status: 'confirmed' }).select('user').lean();
      recipients = regs.map((item) => item.user);
    } else if (audience === 'selected') {
      const requestedIds = Array.isArray(req.body.userIds) ? [...new Set(req.body.userIds)] : [];
      if (!requestedIds.length || requestedIds.length > 200 || requestedIds.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) {
        return res.status(400).json({ error: 'Select between 1 and 200 valid student accounts.', code: 'INVALID_INPUT' });
      }
      const selectedUsers = await User.find({
        _id: { $in: requestedIds },
        status: 'active',
        $or: [{ role: 'student', accountType: 'internal' }, { role: 'external', accountType: 'external', emailVerified: true }],
      }).select('_id').lean();
      if (selectedUsers.length !== requestedIds.length) return res.status(400).json({ error: 'Selected students must be active and verified when external.', code: 'INVALID_AUDIENCE' });
      recipients = selectedUsers.map((item) => item._id);
    } else {
      const accountTypes = audience === 'all' ? ['internal', 'external'] : [audience];
      recipients = (await User.find({ accountType: { $in: accountTypes }, status: 'active', ...(accountTypes.includes('external') ? { $or: [{ accountType: 'internal' }, { emailVerified: true }] } : {}) }).select('_id').limit(5000).lean()).map((item) => item._id);
    }
    const uniqueRecipients = [...new Map(recipients.map((id) => [String(id), id])).values()];
    const batchId = randomUUID();
    if (uniqueRecipients.length) await Notification.insertMany(uniqueRecipients.map((recipient) => ({ batchId, sender: req.user._id, recipient, event: eventId, title: title.trim(), message: message.trim() })));
    await NotificationBatch.create({ batchId, sender: req.user._id, event: eventId, audience, title: title.trim(), message: message.trim(), recipientCount: uniqueRecipients.length });
    return res.status(201).json({ sent: uniqueRecipients.length });
  } catch (error) { return next(error); }
});

router.post('/events/:eventId/notify', ...auth, requireRole('admin', 'club'), async (req, res, next) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (title.length < 3 || title.length > 120 || message.length < 3 || message.length > 2000) return res.status(400).json({ error: 'Enter a title and message within the limits.', code: 'INVALID_INPUT' });
    const event = await Event.findById(req.params.eventId);
    if (!event || (req.user.role === 'club' && !await mayManage(req.user, event))) return res.status(404).json({ error: 'Event not found.', code: 'NOT_FOUND' });
    const registrations = await Registration.find({ event: event._id, status: 'confirmed' }).select('user').lean();
    const recipients = [...new Map(registrations.map((item) => [String(item.user), item.user])).values()];
    const batchId = randomUUID();
    if (recipients.length) await Notification.insertMany(recipients.map((recipient) => ({ batchId, sender: req.user._id, recipient, event: event._id, title, message })));
    await NotificationBatch.create({ batchId, sender: req.user._id, event: event._id, audience: 'event', title, message, recipientCount: recipients.length });
    return res.status(201).json({ sent: recipients.length });
  } catch (error) { return next(error); }
});

export default router;
