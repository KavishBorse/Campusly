import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(fileURLToPath(new URL('../../.env', import.meta.url))) });
const { default: app } = await import('./app.js');

const port = Number(process.env.PORT ?? 4001);
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

if (!mongoUri) throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure it.');
if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('replace-with-')) {
  throw new Error('Set JWT_SECRET to a random value with at least 32 characters in .env.');
}

try {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  // Ensure unique indexes (registrations, attendance, and QR tokens) exist
  // before accepting requests that rely on them for data integrity.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  app.listen(port, () => console.log(`Campusly API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Could not connect to MongoDB:', error.message);
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
