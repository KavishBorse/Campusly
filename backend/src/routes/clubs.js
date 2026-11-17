import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User.js';
import { Club } from '../models/Club.js';
import { requireAuth, enforcePasswordChange, requireRole } from '../middleware/auth.js';

const router = Router();
const admin = [requireAuth, enforcePasswordChange, requireRole('admin')];

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 110);
}
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/clubs', ...admin, async (_req, res, next) => {
  try {
    const clubs = await Club.find().populate('user', 'username displayName status').sort({ name: 1 }).lean();
    return res.json({ clubs });
  } catch (error) { return next(error); }
});

router.post('/clubs', ...admin, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (name.length < 2 || name.length > 120 || username.length < 3 || username.length > 120 || password.length < 12 || password.length > 256 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ error: 'Enter a club name, username, optional valid email, and password of at least 12 characters.', code: 'INVALID_INPUT' });
    }
    const user = await User.create({ username, displayName: name, email: email || undefined, passwordHash: await bcrypt.hash(password, 12), role: 'club', accountType: 'club', mustChangePassword: true });
    try {
      const slug = `${slugify(name) || 'club'}-${user._id.toString().slice(-6)}`;
      const club = await Club.create({ user: user._id, name, slug, description });
      return res.status(201).json({ club: { ...club.toObject(), user: toPublicUser(user) } });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'A username or email is already in use.', code: 'DUPLICATE_ACCOUNT' });
    return next(error);
  }
});

router.post('/clubs/:clubId/reset-password', ...admin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(404).json({ error: 'Club not found.', code: 'NOT_FOUND' });
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 12 || password.length > 256) return res.status(400).json({ error: 'Use a password with at least 12 characters.', code: 'WEAK_PASSWORD' });
    const club = await Club.findById(req.params.clubId);
    if (!club) return res.status(404).json({ error: 'Club not found.', code: 'NOT_FOUND' });
    const user = await User.findById(club.user);
    if (!user) return res.status(404).json({ error: 'Club account not found.', code: 'NOT_FOUND' });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.mustChangePassword = true;
    await user.save();
    return res.json({ message: 'Club password reset. The account must change it at next sign-in.' });
  } catch (error) { return next(error); }
});

router.patch('/clubs/:clubId/status', ...admin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.clubId)) return res.status(404).json({ error: 'Club not found.', code: 'NOT_FOUND' });
    if (!['active', 'suspended'].includes(req.body?.status)) return res.status(400).json({ error: 'Choose active or suspended.', code: 'INVALID_INPUT' });
    const club = await Club.findById(req.params.clubId);
    if (!club) return res.status(404).json({ error: 'Club not found.', code: 'NOT_FOUND' });
    club.status = req.body.status;
    await club.save();
    await User.updateOne({ _id: club.user }, { status: req.body.status });
    return res.json({ club });
  } catch (error) { return next(error); }
});

router.get('/users', ...admin, async (req, res, next) => {
  try {
    const filter = {};
    if (['admin', 'club', 'student', 'external'].includes(req.query.role)) filter.role = req.query.role;
    if (['active', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (query) {
      const pattern = new RegExp(escapeRegex(query), 'i');
      filter.$or = [{ username: pattern }, { displayName: pattern }, { email: pattern }, { enrollmentId: pattern }];
    }
    const requestedPageSize = Number.parseInt(String(req.query.limit ?? '100'), 10);
    const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0 ? Math.min(requestedPageSize, 500) : 100;
    const requestedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
    const [users, total] = await Promise.all([
      User.find(filter).select('username displayName email enrollmentId collegeName role accountType status emailVerified createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ users, total, page, pageSize });
  } catch (error) { return next(error); }
});

router.patch('/users/:userId/status', ...admin, async (req, res, next) => {
  try {
    if (!['active', 'suspended'].includes(req.body?.status)) return res.status(400).json({ error: 'Choose active or suspended.', code: 'INVALID_INPUT' });
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    const user = await User.findById(req.params.userId).select('username displayName role status');
    if (!user) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    if (user.role === 'admin') return res.status(409).json({ error: 'Administrator accounts cannot be suspended or reactivated from the campus directory.', code: 'ADMIN_ACCOUNT_PROTECTED' });
    if (String(user._id) === String(req.user._id) && req.body.status === 'suspended') {
      return res.status(409).json({ error: 'You cannot suspend your own administrator account.', code: 'SELF_SUSPENSION_BLOCKED' });
    }
    user.status = req.body.status;
    await user.save();
    if (user.role === 'club') await Club.updateOne({ user: user._id }, { status: req.body.status });
    return res.json({ user });
  } catch (error) { return next(error); }
});

export default router;
