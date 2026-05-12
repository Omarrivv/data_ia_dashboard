import mongoose, { Schema, Document } from 'mongoose';

export interface GeminiRequestCacheDocument extends Document {
  key: string;
  responseText: string;
  createdAt: Date;
  hitCount: number;
  lastAccessed: Date;
}

const GeminiRequestCacheSchema = new Schema<GeminiRequestCacheDocument>({
  key: { type: String, required: true, unique: true, index: true },
  responseText: { type: String, required: true },
  hitCount: { type: Number, default: 0, index: true },
  lastAccessed: { type: Date, default: Date.now, index: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

// TTL index: expire cache entries after 30 days of inactivity
GeminiRequestCacheSchema.index({ lastAccessed: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

// Índice para limpieza de cache antiguo
GeminiRequestCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // 60 días máximo

export const GeminiRequestCache = mongoose.model<GeminiRequestCacheDocument>('GeminiRequestCache', GeminiRequestCacheSchema);

export default GeminiRequestCache;
