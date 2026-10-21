import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User.js';
import { Club } from '../models/Club.js';
import { requireAuth, enforcePasswordChange, requireRole } from '../middleware/auth.js';

const router = Router();
const admin = [requireAuth, enforcePasswordChange, requireRole('admin')];

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 110);
}

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
    const users = await User.find(filter).select('username displayName email enrollmentId collegeName role accountType status emailVerified createdAt').sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ users });
  } catch (error) { return next(error); }
});

router.patch('/users/:userId/status', ...admin, async (req, res, next) => {
  try {
    if (!['active', 'suspended'].includes(req.body?.status)) return res.status(400).json({ error: 'Choose active or suspended.', code: 'INVALID_INPUT' });
    const user = await User.findByIdAndUpdate(req.params.userId, { status: req.body.status }, { new: true }).select('username displayName role status');
    if (!user) return res.status(404).json({ error: 'User not found.', code: 'NOT_FOUND' });
    if (user.role === 'club') await Club.updateOne({ user: user._id }, { status: req.body.status });
    return res.json({ user });
  } catch (error) { return next(error); }
});

export default router;
