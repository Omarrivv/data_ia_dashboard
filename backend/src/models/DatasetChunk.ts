import mongoose, { Document, Schema } from 'mongoose';

export interface DatasetChunkDocument extends Document {
  datasetId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  chunkIndex: number;
  data: any[];
  rowStart: number;
  rowEnd: number;
  rowCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const datasetChunkSchema = new Schema<DatasetChunkDocument>({
  datasetId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Dataset'
  },
  projectId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Project'
  },
  chunkIndex: {
    type: Number,
    required: true,
    min: 0
  },
  data: [{}],  // Array de objetos genéricos
  rowStart: {
    type: Number,
    required: true,
    min: 0
  },
  rowEnd: {
    type: Number,
    required: true
  },
  rowCount: {
    type: Number,
    required: true,
    min: 1
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      if (ret.__v !== undefined) delete ret.__v;
      return ret;
    }
  }
});

// Índices compuestos para queries eficientes
datasetChunkSchema.index({ datasetId: 1, chunkIndex: 1 }, { unique: true });
datasetChunkSchema.index({ projectId: 1, datasetId: 1 });
datasetChunkSchema.index({ createdAt: -1 });

// TTL: Auto-eliminar chunks después de 30 días si no se usan
datasetChunkSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 2592000 });

export const DatasetChunk = mongoose.model<DatasetChunkDocument>('DatasetChunk', datasetChunkSchema);
