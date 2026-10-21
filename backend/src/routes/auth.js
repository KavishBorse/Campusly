import { Router } from 'express';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { User, toPublicUser } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const sessionCookie = 'campusly_session';
const sessionDurationMs = 15 * 60 * 1000;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.', code: 'RATE_LIMITED' },
});
const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many account requests. Try again later.', code: 'RATE_LIMITED' } });
const verificationLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many verification attempts. Try again later.', code: 'RATE_LIMITED' } });

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: sessionDurationMs,
  };
}

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
  res.cookie(sessionCookie, token, cookieOptions());
}

router.post('/external/register', signupLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const collegeName = typeof req.body?.collegeName === 'string' ? req.body.collegeName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (name.length < 2 || name.length > 120 || collegeName.length < 2 || collegeName.length > 160 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 256) {
      return res.status(400).json({ error: 'Enter your name, college, valid email, and a password of at least 12 characters.', code: 'INVALID_INPUT' });
    }
    const code = String(randomInt(100000, 1000000));
    const user = await User.create({
      username: email,
      displayName: name,
      email,
      collegeName,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'external',
      accountType: 'external',
      emailVerified: false,
      emailVerificationHash: createHash('sha256').update(code).digest('hex'),
      emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    if (process.env.NODE_ENV === 'development') console.log(`Development email verification for ${email}: ${code}`);
    return res.status(201).json({
      message: 'Account created. Verify your email to sign in.',
      ...(process.env.NODE_ENV === 'development' ? { developmentCode: code } : {}),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'An account with that email already exists.', code: 'DUPLICATE_ACCOUNT' });
    return next(error);
  }
});

router.post('/external/verify', verificationLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const user = await User.findOne({ email, role: 'external' }).select('+emailVerificationHash +emailVerificationExpiresAt');
    if (!user || user.emailVerified || !/^\d{6}$/.test(code) || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      return res.status(400).json({ error: 'That verification code is invalid or expired.', code: 'INVALID_VERIFICATION_CODE' });
    }
    const expected = Buffer.from(user.emailVerificationHash ?? '', 'hex');
    const actual = Buffer.from(createHash('sha256').update(code).digest('hex'), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return res.status(400).json({ error: 'That verification code is invalid or expired.', code: 'INVALID_VERIFICATION_CODE' });
    }
    user.emailVerified = true;
    user.emailVerificationHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    return res.json({ message: 'Email verified. You can now sign in.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/external/resend-code', signupLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' });
    const user = await User.findOne({ email, role: 'external', emailVerified: false }).select('+emailVerificationHash +emailVerificationExpiresAt');
    if (!user) return res.json({ message: 'If an unverified account exists for that address, a new verification code has been issued.' });
    const code = String(randomInt(100000, 1000000));
    user.emailVerificationHash = createHash('sha256').update(code).digest('hex');
    user.emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    if (process.env.NODE_ENV === 'development') console.log(`Development email verification resend for ${email}: ${code}`);
    return res.json({
      message: 'A new verification code has been issued.',
      ...(process.env.NODE_ENV === 'development' ? { developmentCode: code } : {}),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password || username.length > 120 || password.length > 256) {
      return res.status(400).json({ error: 'Enter your username and password.', code: 'INVALID_INPUT' });
    }

    const user = await User.findOne({ username }).select('+passwordHash');
    const matches = user && (await bcrypt.compare(password, user.passwordHash));
    if (!matches || user.status !== 'active') {
      return res.status(401).json({ error: 'The username or password is incorrect.', code: 'INVALID_CREDENTIALS' });
    }
    if (user.role === 'external' && !user.emailVerified) {
      return res.status(403).json({ error: 'Verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED' });
    }

    issueSession(res, user);
    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(sessionCookie, { ...cookieOptions(), maxAge: undefined });
  return res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.publicUser }));

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 12 || newPassword.length > 256) {
      return res.status(400).json({
        error: 'Use a new password with at least 12 characters.',
        code: 'WEAK_PASSWORD',
      });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Choose a password you have not used for this account.', code: 'REUSED_PASSWORD' });
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    const matches = user && (await bcrypt.compare(currentPassword, user.passwordHash));
    if (!matches) {
      return res.status(400).json({ error: 'Your current password is incorrect.', code: 'INVALID_CURRENT_PASSWORD' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();
    issueSession(res, user);
    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
