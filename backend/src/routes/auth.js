import { Router } from 'express';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { User, toPublicUser } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { internalStudentEmailMatchesEnrollment } from '../services/collegeEmail.js';
import { emailDeliveryStatus, sendVerificationEmail } from '../services/email.js';

const router = Router();
const sessionCookie = 'campusly_session';
const sessionDurationMs = 15 * 60 * 1000;
const minimumPasswordLength = 8;

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
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < minimumPasswordLength || password.length > 256) {
      return res.status(400).json({ error: `Enter your name, college, valid email, and a password of at least ${minimumPasswordLength} characters.`, code: 'INVALID_INPUT' });
    }

    const delivery = emailDeliveryStatus();
    if (delivery.incomplete || (!delivery.configured && process.env.NODE_ENV !== 'development')) {
      return res.status(503).json({ error: 'Email verification is not available right now. Please contact the campus administrator.', code: delivery.incomplete ? 'EMAIL_DELIVERY_MISCONFIGURED' : 'EMAIL_DELIVERY_UNAVAILABLE' });
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

    if (delivery.configured) {
      try {
        await sendVerificationEmail({ email, code });
      } catch (error) {
        await User.deleteOne({ _id: user._id, emailVerified: false });
        console.error('Signup verification email delivery failed:', error?.code ?? error?.name ?? 'UNKNOWN');
        return res.status(502).json({ error: 'We could not send the verification email. Check the address or try again shortly.', code: 'EMAIL_DELIVERY_FAILED' });
      }
    } else {
      console.log(`Development email verification for ${email}: ${code}`);
    }

    return res.status(201).json({
      message: delivery.configured ? 'Verification email sent. Check your inbox.' : 'Account created. Enter the local verification code to sign in.',
      ...(process.env.NODE_ENV === 'development' && !delivery.configured ? { developmentCode: code } : {}),
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
    const delivery = emailDeliveryStatus();
    if (delivery.incomplete || (!delivery.configured && process.env.NODE_ENV !== 'development')) {
      return res.status(503).json({ error: 'Email verification is not available right now. Please contact the campus administrator.', code: delivery.incomplete ? 'EMAIL_DELIVERY_MISCONFIGURED' : 'EMAIL_DELIVERY_UNAVAILABLE' });
    }
    const user = await User.findOne({ email, role: 'external', emailVerified: false }).select('+emailVerificationHash +emailVerificationExpiresAt');
    if (!user) return res.json({ message: 'If an unverified account exists for that address, a new verification code has been issued.' });
    const code = String(randomInt(100000, 1000000));
    if (delivery.configured) {
      try {
        await sendVerificationEmail({ email, code });
      } catch (error) {
        console.error('Verification email resend failed:', error?.code ?? error?.name ?? 'UNKNOWN');
        return res.status(502).json({ error: 'We could not send the verification email. Try again shortly.', code: 'EMAIL_DELIVERY_FAILED' });
      }
    }
    user.emailVerificationHash = createHash('sha256').update(code).digest('hex');
    user.emailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    if (!delivery.configured) console.log(`Development email verification resend for ${email}: ${code}`);
    return res.json({
      message: delivery.configured ? 'A new verification email has been sent.' : 'A new verification code has been issued.',
      ...(process.env.NODE_ENV === 'development' && !delivery.configured ? { developmentCode: code } : {}),
    });
  } catch (error) {
    return next(error);
  }
});

const internalStudent = [requireAuth, requireRole('student')];

router.post('/student/email/request', internalStudent, verificationLimiter, async (req, res, next) => {
  try {
    if (req.user.accountType !== 'internal' || req.user.mustChangePassword) {
      return res.status(403).json({ error: 'Only an internal student who has changed their initial password can link a college email.', code: 'FORBIDDEN' });
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !internalStudentEmailMatchesEnrollment(email, req.user.enrollmentId)) {
      return res.status(400).json({
        error: `Enter your enrollment ID followed by @${(process.env.INTERNAL_STUDENT_EMAIL_DOMAIN || 'students.mituniversity.edu.in').replace(/^@/, '')}.`,
        code: 'COLLEGE_EMAIL_MISMATCH',
      });
    }
    if (req.user.email?.toLowerCase() === email && req.user.emailVerified) {
      return res.status(409).json({ error: 'That college email is already linked to your account.', code: 'EMAIL_ALREADY_LINKED' });
    }
    const delivery = emailDeliveryStatus();
    if (delivery.incomplete || (!delivery.configured && process.env.NODE_ENV !== 'development')) {
      return res.status(503).json({ error: 'Email verification is not available right now. Please contact the campus administrator.', code: delivery.incomplete ? 'EMAIL_DELIVERY_MISCONFIGURED' : 'EMAIL_DELIVERY_UNAVAILABLE' });
    }
    const now = new Date();
    const expiredPending = await User.findOne({
      _id: { $ne: req.user._id },
      pendingEmail: email,
      $or: [{ pendingEmailVerificationExpiresAt: { $lte: now } }, { pendingEmailVerificationExpiresAt: { $exists: false } }],
    }).select('+pendingEmail +pendingEmailVerificationHash +pendingEmailVerificationExpiresAt');
    if (expiredPending) {
      expiredPending.pendingEmail = undefined;
      expiredPending.pendingEmailVerificationHash = undefined;
      expiredPending.pendingEmailVerificationExpiresAt = undefined;
      await expiredPending.save();
    }
    const conflict = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [
        { email },
        { pendingEmail: email, pendingEmailVerificationExpiresAt: { $gt: now } },
      ],
    }).select('_id');
    if (conflict) return res.status(409).json({ error: 'That college email is already associated with another account.', code: 'EMAIL_ALREADY_IN_USE' });

    const code = String(randomInt(100000, 1000000));
    const user = await User.findById(req.user._id).select('+pendingEmail +pendingEmailVerificationHash +pendingEmailVerificationExpiresAt');
    user.pendingEmail = email;
    user.pendingEmailVerificationHash = createHash('sha256').update(code).digest('hex');
    user.pendingEmailVerificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    if (delivery.configured) {
      try {
        await sendVerificationEmail({ email, code, purpose: 'student-email-link' });
      } catch (error) {
        user.pendingEmail = undefined;
        user.pendingEmailVerificationHash = undefined;
        user.pendingEmailVerificationExpiresAt = undefined;
        await user.save();
        console.error('Student email-link delivery failed:', error?.code ?? error?.name ?? 'UNKNOWN');
        return res.status(502).json({ error: 'We could not send the verification email. Try again shortly.', code: 'EMAIL_DELIVERY_FAILED' });
      }
    } else {
      console.log(`Development student email-link code for ${email}: ${code}`);
    }

    return res.json({
      message: delivery.configured ? 'Verification code sent to your college email.' : 'Enter the local development code to verify this email.',
      ...(process.env.NODE_ENV === 'development' && !delivery.configured ? { developmentCode: code } : {}),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That college email is already associated with an account.', code: 'EMAIL_ALREADY_IN_USE' });
    return next(error);
  }
});

router.post('/student/email/verify', internalStudent, verificationLimiter, async (req, res, next) => {
  try {
    if (req.user.accountType !== 'internal' || req.user.mustChangePassword) {
      return res.status(403).json({ error: 'Only an internal student who has changed their initial password can link a college email.', code: 'FORBIDDEN' });
    }
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const user = await User.findById(req.user._id).select('+pendingEmail +pendingEmailVerificationHash +pendingEmailVerificationExpiresAt');
    if (!user?.pendingEmail || !/^\d{6}$/.test(code) || !user.pendingEmailVerificationExpiresAt || user.pendingEmailVerificationExpiresAt <= new Date() ||
      !internalStudentEmailMatchesEnrollment(user.pendingEmail, user.enrollmentId)) {
      return res.status(400).json({ error: 'That verification code is invalid or expired. Request a new code and try again.', code: 'INVALID_VERIFICATION_CODE' });
    }
    const expected = Buffer.from(user.pendingEmailVerificationHash ?? '', 'hex');
    const actual = Buffer.from(createHash('sha256').update(code).digest('hex'), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return res.status(400).json({ error: 'That verification code is invalid or expired. Request a new code and try again.', code: 'INVALID_VERIFICATION_CODE' });
    }

    const conflict = await User.findOne({ _id: { $ne: user._id }, email: user.pendingEmail }).select('_id');
    if (conflict) return res.status(409).json({ error: 'That college email is already associated with another account.', code: 'EMAIL_ALREADY_IN_USE' });
    user.email = user.pendingEmail;
    user.emailVerified = true;
    user.pendingEmail = undefined;
    user.pendingEmailVerificationHash = undefined;
    user.pendingEmailVerificationExpiresAt = undefined;
    await user.save();
    return res.json({ message: 'Your college email is verified and linked.', user: toPublicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: 'That college email is already associated with another account.', code: 'EMAIL_ALREADY_IN_USE' });
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
    if (newPassword.length < minimumPasswordLength || newPassword.length > 256) {
      return res.status(400).json({
        error: `Use a new password with at least ${minimumPasswordLength} characters.`,
        code: 'WEAK_PASSWORD',
      });
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
