import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true, index: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['confirmed', 'payment_failed', 'cancelled', 'refunded'], required: true },
  paymentType: { type: String, enum: ['free', 'simulated'], required: true },
  amount: { type: Number, required: true, min: 0 },
  ticketCode: { type: String, trim: true, default: null },
}, { timestamps: true, versionKey: false });

bookingSchema.index({ user: 1, createdAt: -1 });
export const Booking = mongoose.model('Booking', bookingSchema);
