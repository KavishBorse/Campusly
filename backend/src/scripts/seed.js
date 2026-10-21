import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { User } from '../models/User.js';
import { Club } from '../models/Club.js';
import { Event } from '../models/Event.js';

dotenv.config({ path: path.resolve(fileURLToPath(new URL('../../../.env', import.meta.url))) });

if (process.env.NODE_ENV !== 'development') {
  throw new Error('The seed script is restricted to NODE_ENV=development.');
}
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set in .env.');

const required = [
  'SEED_ADMIN_USERNAME',
  'SEED_ADMIN_PASSWORD',
  'SEED_STUDENT_ENROLLMENT',
  'SEED_STUDENT_NAME',
  'SEED_STUDENT_PHONE',
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Set these local seed values in .env: ${missing.join(', ')}`);
if (process.env.SEED_ADMIN_PASSWORD.length < 12) {
  throw new Error('SEED_ADMIN_PASSWORD must have at least 12 characters.');
}

const clubValues = ['SEED_CLUB_USERNAME', 'SEED_CLUB_PASSWORD', 'SEED_CLUB_NAME'];
const configuredClubValues = clubValues.filter((key) => process.env[key]?.trim());
if (configuredClubValues.length && configuredClubValues.length !== clubValues.length) {
  throw new Error('Set all three optional club seed values or leave them all blank.');
}
if (configuredClubValues.length && process.env.SEED_CLUB_PASSWORD.length < 12) {
  throw new Error('SEED_CLUB_PASSWORD must have at least 12 characters.');
}

async function createIfMissing({ username, password, displayName, role, accountType, enrollmentId, phone, email, mustChangePassword }) {
  const normalizedUsername = username.trim().toLowerCase();
  if (await User.exists({ username: normalizedUsername })) {
    console.log(`Kept existing development account: ${normalizedUsername}`);
    return User.findOne({ username: normalizedUsername });
  }
  const user = await User.create({
    username: normalizedUsername,
    displayName: displayName.trim(),
    role,
    accountType,
    enrollmentId,
    phone,
    email,
    mustChangePassword,
    passwordHash: await bcrypt.hash(password, 12),
  });
  console.log(`Created development account: ${normalizedUsername} (${role})`);
  return user;
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  await createIfMissing({
    username: process.env.SEED_ADMIN_USERNAME,
    password: process.env.SEED_ADMIN_PASSWORD,
    displayName: 'Campusly Administrator',
    role: 'admin',
    accountType: 'staff',
    email: process.env.SEED_ADMIN_USERNAME.includes('@') ? process.env.SEED_ADMIN_USERNAME : undefined,
    mustChangePassword: false,
  });
  await createIfMissing({
    username: process.env.SEED_STUDENT_ENROLLMENT,
    password: process.env.SEED_STUDENT_PHONE,
    displayName: process.env.SEED_STUDENT_NAME,
    role: 'student',
    accountType: 'internal',
    enrollmentId: process.env.SEED_STUDENT_ENROLLMENT,
    phone: process.env.SEED_STUDENT_PHONE,
    mustChangePassword: true,
  });

  let clubUser = null;
  if (configuredClubValues.length) {
    clubUser = await createIfMissing({
      username: process.env.SEED_CLUB_USERNAME,
      password: process.env.SEED_CLUB_PASSWORD,
      displayName: process.env.SEED_CLUB_NAME,
      role: 'club',
      accountType: 'club',
      mustChangePassword: false,
    });
    const slugBase = process.env.SEED_CLUB_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'demo-club';
    const club = await Club.findOneAndUpdate(
      { user: clubUser._id },
      { $setOnInsert: { user: clubUser._id, name: process.env.SEED_CLUB_NAME.trim(), slug: `${slugBase}-${clubUser._id.toString().slice(-6)}`, description: 'Development demo club account.' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const days = 10;
    const eventStarts = new Date(Date.now() + days * 86400000);
    const eventEnds = new Date(eventStarts.getTime() + 4 * 3600000);
    await Event.updateOne(
      { seedKey: 'campusly-demo-club-submission' },
      { $setOnInsert: { seedKey: 'campusly-demo-club-submission', type: 'club', club: club._id, createdBy: clubUser._id, title: 'Creative Campus Night', description: 'A demo club event submission for reviewing the club approval workflow. Club events are not public until an administrator approves them.', venue: 'Student Activity Center', startsAt: eventStarts, endsAt: eventEnds, registrationDeadline: new Date(eventStarts.getTime() - 86400000), capacity: 120, reservedCount: 0, eligibility: 'all', ticketType: 'free', price: 0, status: 'pending_approval' } },
      { upsert: true },
    );
  }

  const now = Date.now();
  const officialEvents = [
    { seedKey: 'campusly-demo-official-free', title: 'Campus Innovation Showcase', description: 'Meet student teams, explore new ideas, and join hands-on demonstrations from across campus. This clearly labeled development event is included for trying event discovery and free registration.', venue: 'Main Auditorium', day: 7, capacity: 180, eligibility: 'all', ticketType: 'free', price: 0 },
    { seedKey: 'campusly-demo-official-paid', title: 'Design Futures Workshop', description: 'A development demo workshop with limited seats and simulated ticketing. Any payment outcome is generated by the Campusly server and no real money is collected.', venue: 'Design Lab 2', day: 14, capacity: 40, eligibility: 'internal', ticketType: 'paid', price: 250 },
  ];
  for (const demo of officialEvents) {
    const startsAt = new Date(now + demo.day * 86400000);
    const endsAt = new Date(startsAt.getTime() + 3 * 3600000);
    await Event.updateOne(
      { seedKey: demo.seedKey },
      { $setOnInsert: { ...demo, type: 'official', createdBy: (await User.findOne({ username: process.env.SEED_ADMIN_USERNAME.trim().toLowerCase() }))._id, startsAt, endsAt, registrationDeadline: new Date(startsAt.getTime() - 86400000), reservedCount: 0, status: 'published' } },
      { upsert: true },
    );
  }
  console.log('Development demo events are ready.');
} finally {
  await mongoose.disconnect();
}
