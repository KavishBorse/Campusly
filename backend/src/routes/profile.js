import { Router } from 'express';
import { User, toPublicUser } from '../models/User.js';
import { Club } from '../models/Club.js';
import { enforcePasswordChange, requireAuth } from '../middleware/auth.js';

const router = Router();
const auth = [requireAuth, enforcePasswordChange];
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPhone = /^\+?[0-9][0-9\s().-]{6,23}$/;

function accountRoleAllowed(role) {
  return ['student', 'external', 'club'].includes(role);
}

async function profileResponse(userId) {
  const user = await User.findById(userId).select('+phone');
  if (!user || !accountRoleAllowed(user.role)) return null;

  const club = user.role === 'club'
    ? await Club.findOne({ user: user._id }).select('name description slug status').lean()
    : null;

  return {
    user: {
      ...toPublicUser(user),
      phone: user.phone ?? '',
      collegeName: user.collegeName ?? '',
    },
    club,
  };
}

router.get('/profile', ...auth, async (req, res, next) => {
  try {
    if (!accountRoleAllowed(req.user.role)) return res.status(403).json({ error: 'Profile editing is not available for this account.', code: 'FORBIDDEN' });
    const profile = await profileResponse(req.user._id);
    if (!profile) return res.status(404).json({ error: 'Account profile not found.', code: 'NOT_FOUND' });
    return res.json({ profile });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile', ...auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+phone');
    if (!user || !accountRoleAllowed(user.role)) return res.status(403).json({ error: 'Profile editing is not available for this account.', code: 'FORBIDDEN' });

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (Object.hasOwn(body, 'enrollmentId')) {
      return res.status(400).json({ error: 'Your enrollment ID is fixed and cannot be changed.', code: 'READ_ONLY_FIELD' });
    }
    const allowedFields = user.role === 'club'
      ? ['displayName', 'phone', 'email', 'clubName', 'description']
      : user.role === 'external'
        ? ['displayName', 'phone', 'email', 'collegeName']
        : ['displayName', 'phone'];
    const unsupportedField = Object.keys(body).find((field) => !allowedFields.includes(field));
    if (unsupportedField) {
      const message = unsupportedField === 'email' && user.role === 'student'
        ? 'Link or change your college email through the College email page so it can be verified.'
        : 'That account field cannot be changed here.';
      return res.status(400).json({ error: message, code: 'READ_ONLY_FIELD' });
    }
    if (!Object.keys(body).length) return res.status(400).json({ error: 'Make a change before saving your profile.', code: 'INVALID_INPUT' });

    if (Object.hasOwn(body, 'displayName')) {
      if (typeof body.displayName !== 'string' || body.displayName.trim().length < 2 || body.displayName.trim().length > 120) {
        return res.status(400).json({ error: 'Enter a name between 2 and 120 characters.', code: 'INVALID_INPUT' });
      }
      user.displayName = body.displayName.trim();
    }

    if (Object.hasOwn(body, 'phone')) {
      if (typeof body.phone !== 'string') return res.status(400).json({ error: 'Enter a valid phone number or leave it blank.', code: 'INVALID_INPUT' });
      const phone = body.phone.trim();
      const digitCount = phone.replace(/\D/g, '').length;
      if (phone && (!validPhone.test(phone) || digitCount < 8 || digitCount > 15)) return res.status(400).json({ error: 'Enter a valid phone number with 8 to 15 digits.', code: 'INVALID_INPUT' });
      user.phone = phone || undefined;
    }

    if (Object.hasOwn(body, 'email')) {
      if (typeof body.email !== 'string') return res.status(400).json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' });
      const email = body.email.trim().toLowerCase();
      if (user.role === 'external' && !email) return res.status(400).json({ error: 'An email address is required because it is your sign-in username.', code: 'INVALID_INPUT' });
      if (email && (email.length > 254 || !validEmail.test(email))) return res.status(400).json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' });
      if (email) {
        const conflict = await User.findOne({ _id: { $ne: user._id }, $or: [{ email }, { username: email }, { pendingEmail: email }] }).select('_id').lean();
        if (conflict) return res.status(409).json({ error: 'That email address is already associated with another account.', code: 'EMAIL_ALREADY_IN_USE' });
      }
      const emailChanged = (user.email ?? '').toLowerCase() !== email;
      user.email = email || undefined;
      if (user.role === 'external') user.username = email;
      if (emailChanged) user.emailVerified = false;
    }

    if (user.role === 'external' && Object.hasOwn(body, 'collegeName')) {
      if (typeof body.collegeName !== 'string' || body.collegeName.trim().length < 2 || body.collegeName.trim().length > 160) {
        return res.status(400).json({ error: 'Enter a college name between 2 and 160 characters.', code: 'INVALID_INPUT' });
      }
      user.collegeName = body.collegeName.trim();
    }

    let club;
    if (user.role === 'club' && (Object.hasOwn(body, 'clubName') || Object.hasOwn(body, 'description'))) {
      club = await Club.findOne({ user: user._id });
      if (!club) return res.status(404).json({ error: 'Club profile not found.', code: 'NOT_FOUND' });
      if (Object.hasOwn(body, 'clubName')) {
        if (typeof body.clubName !== 'string' || body.clubName.trim().length < 2 || body.clubName.trim().length > 120) {
          return res.status(400).json({ error: 'Enter a club name between 2 and 120 characters.', code: 'INVALID_INPUT' });
        }
        club.name = body.clubName.trim();
      }
      if (Object.hasOwn(body, 'description')) {
        if (typeof body.description !== 'string' || body.description.trim().length > 1000) {
          return res.status(400).json({ error: 'The club description must be 1,000 characters or fewer.', code: 'INVALID_INPUT' });
        }
        club.description = body.description.trim();
      }
    }

    await user.save();
    if (club) await club.save();
    const profile = await profileResponse(user._id);
    return res.json({ profile, user: toPublicUser(user), message: 'Profile updated.' });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That username or email is already in use.', code: 'DUPLICATE_ACCOUNT' });
    return next(error);
  }
});

export default router;
