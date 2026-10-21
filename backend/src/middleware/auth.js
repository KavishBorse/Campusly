import jwt from 'jsonwebtoken';
import { User, toPublicUser } from '../models/User.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.campusly_session;
  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue.', code: 'AUTH_REQUIRED' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.', code: 'AUTH_REQUIRED' });
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Your session is no longer active.', code: 'AUTH_REQUIRED' });
  }

  req.user = user;
  req.publicUser = toPublicUser(user);
  return next();
}

export async function optionalAuth(req, _res, next) {
  const token = req.cookies?.campusly_session;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(payload.sub);
    if (user?.status === 'active' && !user.mustChangePassword) {
      req.user = user;
      req.publicUser = toPublicUser(user);
    }
  } catch {
    // Public event discovery remains available to signed-out visitors.
  }
  return next();
}

export function enforcePasswordChange(req, res, next) {
  const allowed =
    (req.method === 'GET' && req.path === '/auth/me') ||
    (req.method === 'PATCH' && req.path === '/auth/password') ||
    (req.method === 'POST' && req.path === '/auth/logout');

  if (req.user?.mustChangePassword && !allowed) {
    return res.status(403).json({
      error: 'Change your initial password before using Campusly.',
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  }
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this area.', code: 'FORBIDDEN' });
    }
    return next();
  };
}
