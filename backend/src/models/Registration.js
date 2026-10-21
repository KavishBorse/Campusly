import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'confirmed', 'payment_failed', 'cancelled'], required: true, default: 'pending' },
  eligibilitySnapshot: { type: String, enum: ['internal', 'external'], required: true },
  ticketCode: { type: String, trim: true, default: null },
  registeredAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

registrationSchema.index({ event: 1, user: 1 }, { unique: true });
export const Registration = mongoose.model('Registration', registrationSchema);
