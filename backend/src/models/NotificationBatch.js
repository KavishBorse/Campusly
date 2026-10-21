import mongoose from 'mongoose';

const notificationBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  audience: { type: String, enum: ['all', 'internal', 'external', 'event', 'selected'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  recipientCount: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });

notificationBatchSchema.index({ sender: 1, createdAt: -1 });
export const NotificationBatch = mongoose.model('NotificationBatch', notificationBatchSchema);
