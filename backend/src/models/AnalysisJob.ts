import mongoose, { Schema, Document } from 'mongoose';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AnalysisJobDocument extends Document {
  projectId: any;
  userId: any;
  status: JobStatus;
  progress: number;
  message?: string;
  logs: { ts: Date; message: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisJobSchema = new Schema<AnalysisJobDocument>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'], default: 'queued' },
  progress: { type: Number, default: 0 },
  message: { type: String },
  logs: [
    {
      ts: { type: Date, default: Date.now },
      message: String
    }
  ]
}, { timestamps: true });

export const AnalysisJob = mongoose.model<AnalysisJobDocument>('AnalysisJob', AnalysisJobSchema);

export default AnalysisJob;
