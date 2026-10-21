import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, maxlength: 80 },
  targetType: { type: String, required: true, maxlength: 80 },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, trim: true, maxlength: 1000, required: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true, versionKey: false });

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
