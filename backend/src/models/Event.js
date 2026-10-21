import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  date: { type: Date, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  attendanceOpensAt: { type: Date, required: true },
  attendanceClosesAt: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
}, { _id: true });

const eventSchema = new mongoose.Schema({
  seedKey: { type: String, unique: true, sparse: true, select: false },
  type: { type: String, enum: ['official', 'club'], required: true },
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, minlength: 5, maxlength: 140 },
  description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
  venue: { type: String, required: true, trim: true, maxlength: 240 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  registrationDeadline: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 100000 },
  reservedCount: { type: Number, default: 0, min: 0 },
  eligibility: { type: String, enum: ['all', 'internal', 'external'], required: true, default: 'all' },
  ticketType: { type: String, enum: ['free', 'paid'], required: true, default: 'free' },
  price: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['draft', 'pending_approval', 'published', 'changes_requested', 'rejected', 'cancelled', 'completed'], required: true },
  reviewFeedback: { type: String, trim: true, maxlength: 1000, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  sessions: { type: [sessionSchema], default: [] },
}, { timestamps: true, versionKey: false });

eventSchema.index({ status: 1, startsAt: 1 });
eventSchema.index({ club: 1, status: 1, startsAt: 1 });

export const Event = mongoose.model('Event', eventSchema);
