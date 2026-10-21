import mongoose from 'mongoose';

const qrTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, versionKey: false });

export const QrToken = mongoose.model('QrToken', qrTokenSchema);
