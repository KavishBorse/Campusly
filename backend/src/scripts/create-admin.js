import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { User } from '../models/User.js';

function askHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal so secrets are not echoed.'));
  }

  return new Promise((resolve, reject) => {
    readline.emitKeypressEvents(input);
    const previousRawMode = input.isRaw;
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();

    const finish = (error) => {
      input.off('keypress', onKeypress);
      input.setRawMode(previousRawMode ?? false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new Error('Cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') {
        value = value.slice(0, -1);
        return;
      }
      if (character && !key.ctrl && !key.meta) value += character;
    };

    input.on('keypress', onKeypress);
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
