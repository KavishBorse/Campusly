import { Router } from 'express';
import { Club } from '../models/Club.js';
import { Event } from '../models/Event.js';

const router = Router();

router.get('/clubs', async (_req, res, next) => {
  try {
    const clubs = await Club.find({ status: 'active' }).select('_id name').sort({ name: 1 }).lean();
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ clubs });
  } catch (error) { return next(error); }
});

router.get('/events', async (_req, res, next) => {
  try {
    const now = new Date();
    const events = await Event.find({
      status: 'published',
      startsAt: { $gt: now },
      registrationDeadline: { $gt: now },
      eligibility: { $in: ['all', 'external'] },
    })
      .select('_id title startsAt endsAt eligibility type club')
      .populate({ path: 'club', select: 'name', match: { status: 'active' } })
      .sort({ startsAt: 1 })
      .limit(500)
      .lean();

    const publicEvents = events.filter((event) => event.type !== 'club' || event.club);
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ events: publicEvents });
  } catch (error) { return next(error); }
});

export default router;
