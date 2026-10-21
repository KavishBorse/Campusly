import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './routes/auth.js';
import overviewRouter from './routes/overview.js';
import clubsRouter from './routes/clubs.js';
import eventsRouter from './routes/events.js';
import bookingsRouter from './routes/bookings.js';
import notificationsRouter from './routes/notifications.js';
import attendanceRouter from './routes/attendance.js';

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? 'ok' : 'database_unavailable' });
});
app.use('/api/auth', authRouter);
app.use('/api/admin', clubsRouter);
app.use('/api/events', eventsRouter);
app.use('/api', bookingsRouter);
app.use('/api', notificationsRouter);
app.use('/api', attendanceRouter);
app.use('/api', overviewRouter);

app.use((_req, res) => res.status(404).json({ error: 'This endpoint does not exist.', code: 'NOT_FOUND' }));

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request is too large.', code: 'REQUEST_TOO_LARGE' });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ error: 'An account with that identifier already exists.', code: 'DUPLICATE_ACCOUNT' });
  }
  console.error('API request failed:', error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'SERVER_ERROR' });
});

export default app;
