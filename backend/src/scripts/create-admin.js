import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { User } from '../models/User.js';

function askHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so secrets are not echoed.'));
  }

  return new Promise((resolve, reject) => {
    const previousRawMode = Boolean(input.isRaw);
    let value = '';

    const finish = (error) => {
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

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Set NODE_ENV=production before connecting to the production database.');
  }

  const mongoUri = (await askHidden('MongoDB Atlas URI: ')).trim();
  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    throw new Error('Enter a valid MongoDB connection URI.');
  }

  const prompts = readline.createInterface({ input: process.stdin, output: process.stdout });
  const username = (await prompts.question('Administrator email (used to sign in): ')).trim().toLowerCase();
  const displayName = (await prompts.question('Administrator display name: ')).trim();
  prompts.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username) || username.length > 120) {
    throw new Error('Enter a valid administrator email address.');
  }
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error('The display name must be between 2 and 120 characters.');
  }

  const password = await askHidden('Administrator password (at least 12 characters): ');
  const confirmation = await askHidden('Confirm administrator password: ');
  if (password.length < 12 || password.length > 256) throw new Error('The password must be between 12 and 256 characters.');
  if (password !== confirmation) throw new Error('The passwords do not match.');

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  try {
    await User.init();
    if (await User.exists({ role: 'admin' })) {
      throw new Error('This database already has an administrator. No account was created.');
    }
    if (await User.exists({ username })) {
      throw new Error('That email is already used by an account. No account was created.');
    }

    await User.create({
      username,
      email: username,
      displayName,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      accountType: 'staff',
      status: 'active',
    });
    console.log(`Created the initial administrator account: ${username}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Admin setup failed: ${error.message}`);
  process.exitCode = 1;
});
