import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { User } from '../models/User.js';

function askHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so the connection URI and phone numbers are not echoed.'));
  }

  return new Promise((resolve, reject) => {
    const previousRawMode = Boolean(input.isRaw);
    let value = '';
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      input.off('data', onData);
      input.off('end', onEnd);
      input.setRawMode(previousRawMode);
      input.pause();
      process.stdout.write('\r\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= ' ') value += character;
      }
    };

    const onEnd = () => finish(new Error('The terminal closed before input was received.'));
    input.on('data', onData);
    input.once('end', onEnd);
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
  });
}

async function askLine(prompt) {
  const prompts = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await prompts.question(prompt);
  } finally {
    prompts.close();
  }
}

function parseAtlasUri(value) {
  let uri;
  try {
    uri = new URL(value);
  } catch {
    throw new Error('Enter a valid MongoDB Atlas connection URI.');
  }

  if (uri.protocol !== 'mongodb+srv:' || !uri.hostname.endsWith('.mongodb.net')) {
    throw new Error('This provisioning command accepts MongoDB Atlas SRV connection URIs only.');
  }
  const databaseName = decodeURIComponent(uri.pathname.replace(/^\//, '').split('/')[0] ?? '');
  if (databaseName !== 'campusly') {
    throw new Error('The Atlas URI must select the campusly database.');
  }
  return value;
}

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Set NODE_ENV=production before connecting to the Atlas database.');
  }

  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (args.some((arg) => arg !== '--apply')) {
    throw new Error('The only supported option is --apply. Without it, the command previews and makes no changes.');
  }

  const mongoUri = parseAtlasUri((await askHidden('MongoDB Atlas URI for the campusly database: ')).trim());
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

  try {
    const countValue = (await askLine('Number of verified student records to enter (1-500): ')).trim();
    if (!/^\d+$/.test(countValue)) throw new Error('Enter a whole number from 1 to 500.');
    const count = Number(countValue);
    if (count < 1 || count > 500) throw new Error('Enter a whole number from 1 to 500.');

    const students = [];
    const seenEnrollmentIds = new Set();
    for (let index = 0; index < count; index += 1) {
      console.log(`\nStudent ${index + 1} of ${count}`);
      const displayName = (await askLine('Full name: ')).trim();
      const enrollmentId = (await askLine('Enrollment ID: ')).trim().toUpperCase();
      if (displayName.length < 2 || displayName.length > 120) {
        throw new Error(`Student ${index + 1}: name must be between 2 and 120 characters.`);
      }
      if (!/^[A-Z0-9]{6,30}$/.test(enrollmentId)) {
        throw new Error(`Student ${index + 1}: enrollment ID must contain 6-30 letters or digits.`);
      }
      if (seenEnrollmentIds.has(enrollmentId)) {
        throw new Error(`Student ${index + 1}: duplicate enrollment ID entered.`);
      }

      const phone = (await askHidden('Initial phone password (input hidden): ')).trim();
      if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
        throw new Error(`Student ${index + 1}: enter a phone number with 8-15 digits, optionally prefixed by +.`);
      }
      seenEnrollmentIds.add(enrollmentId);
      students.push({ displayName, enrollmentId, phone });
    }

    await User.init();
    const enrollmentIds = students.map((student) => student.enrollmentId);
    const usernames = enrollmentIds.map((enrollmentId) => enrollmentId.toLowerCase());
    const existing = await User.find({
      $or: [{ enrollmentId: { $in: enrollmentIds } }, { username: { $in: usernames } }],
    })
      .select('username enrollmentId')
      .lean();
    if (existing.length) {
      const matches = existing.map((user) => user.enrollmentId || user.username).join(', ');
      throw new Error(`No records were added. These enrollment IDs or usernames already exist: ${matches}`);
    }

    console.log(`\nReady to provision ${students.length} verified internal student account(s) in Atlas / campusly.`);
    for (const student of students) console.log(`- ${student.displayName} (${student.enrollmentId})`);
    console.log('Each username will be the lowercase enrollment ID. The initial phone password will be bcrypt-hashed, and password change will be required at first sign-in.');

    if (!apply) {
      console.log('\nPreview only: no accounts were created. Rerun with --apply to provision after verifying the roster.');
      return;
    }

    const confirmation = (await askLine('\nAfter verifying these students against the official roster, type PROVISION to create the accounts: ')).trim();
    if (confirmation !== 'PROVISION') {
      console.log('Cancelled. No accounts were created.');
      return;
    }

    const documents = await Promise.all(
      students.map(async ({ displayName, enrollmentId, phone }) => ({
        username: enrollmentId.toLowerCase(),
        displayName,
        enrollmentId,
        phone,
        passwordHash: await bcrypt.hash(phone, 12),
        role: 'student',
        accountType: 'internal',
        mustChangePassword: true,
        status: 'active',
      })),
    );

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await User.insertMany(documents, { session, ordered: true });
      });
    } finally {
      await session.endSession();
    }
    console.log(`Provisioned ${documents.length} student account(s). Ask each student to change the initial password immediately after sign-in.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Student provisioning stopped: ${error.message}`);
  process.exitCode = 1;
});
