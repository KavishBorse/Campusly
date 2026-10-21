import mongoose from 'mongoose';

const clubSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true, versionKey: false });

export const Club = mongoose.model('Club', clubSchema);
