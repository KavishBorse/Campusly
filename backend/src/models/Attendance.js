import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['present', 'absent'], default: 'present' },
  source: { type: String, enum: ['qr', 'manual'], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recordedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

attendanceSchema.index({ sessionId: 1, user: 1 }, { unique: true });
attendanceSchema.index({ event: 1, user: 1 });
export const Attendance = mongoose.model('Attendance', attendanceSchema);
