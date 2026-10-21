import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 120,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    collegeName: { type: String, trim: true, maxlength: 160 },
    emailVerified: { type: Boolean, default: false },
    emailVerificationHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    enrollmentId: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    phone: { type: String, trim: true, select: false },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'club', 'student', 'external'],
    },
    accountType: {
      type: String,
      required: true,
      enum: ['staff', 'club', 'internal', 'external'],
    },
    mustChangePassword: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true, versionKey: false },
);

export const User = mongoose.model('User', userSchema);

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email ?? null,
    emailVerified: Boolean(user.emailVerified),
    enrollmentId: user.enrollmentId ?? null,
    role: user.role,
    accountType: user.accountType,
    mustChangePassword: user.mustChangePassword,
  };
}
