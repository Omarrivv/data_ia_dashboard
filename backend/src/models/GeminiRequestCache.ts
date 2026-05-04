import mongoose, { Schema, Document } from 'mongoose';

export interface GeminiRequestCacheDocument extends Document {
  key: string;
  responseText: string;
  createdAt: Date;
}

const GeminiRequestCacheSchema = new Schema<GeminiRequestCacheDocument>({
  key: { type: String, required: true, unique: true, index: true },
  responseText: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

// TTL index can be added if desired (e.g., expire after 7 days)
// GeminiRequestCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export const GeminiRequestCache = mongoose.model<GeminiRequestCacheDocument>('GeminiRequestCache', GeminiRequestCacheSchema);

export default GeminiRequestCache;
