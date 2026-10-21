import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['succeeded', 'failed', 'refunded'], required: true },
  providerReference: { type: String, required: true, unique: true },
  message: { type: String, default: '' },
}, { timestamps: true, versionKey: false });

export const Payment = mongoose.model('Payment', paymentSchema);
