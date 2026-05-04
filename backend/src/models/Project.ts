import mongoose, { Document, Schema } from 'mongoose';
import { Project as IProject, ProjectStatus, Dataset, Dashboard, ProjectDomain, ProjectSharePermission, ProjectAlertSeverity, ProjectAlertRuleId } from '../types';
// Interfaz para el documento de proyecto
export interface ProjectDocument extends Document {
  name: string;
  description?: string;
  userId: any;
  domain?: ProjectDomain;
  sharing?: {
    enabled: boolean;
    token: string;
    permission: ProjectSharePermission;
    updatedAt?: Date;
  };
  status: ProjectStatus;
  datasets: any[];
  dashboard?: any;
  documentation?: string;
  alerts?: Array<{
    ruleId: ProjectAlertRuleId;
    metric: 'reliabilityScore';
    severity: ProjectAlertSeverity;
    threshold: number;
    currentValue: number;
    message: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
  getStats(): any;
}
// Esquema de conjunto de datos
const datasetSchema = new Schema({
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  metadata: {
    columns: [{
      name: String,
      type: {
        type: String,
        enum: ['string', 'number', 'date', 'boolean']
      },
      nullable: Boolean,
      unique: Boolean,
      examples: [Schema.Types.Mixed]
    }],
    rowCount: Number,
    dataTypes: Schema.Types.Mixed,
    summary: String,
    insights: [String]
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});
// Esquema de widget para el dashboard
const widgetSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['chart', 'metric', 'table', 'text'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  config: {
    chartType: {
      type: String,
      enum: ['line', 'bar', 'pie', 'scatter', 'area']
    },
    dataSource: String,
    xAxis: String,
    yAxis: String,
    groupBy: String,
    aggregation: {
      type: String,
      enum: ['sum', 'avg', 'count', 'min', 'max']
    },
    filters: Schema.Types.Mixed,
    colors: [String]
  },
  position: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  }
});
// Esquema de dashboard
const dashboardSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  widgets: [widgetSchema],
  layout: {
    columns: {
      type: Number,
      default: 12
    },
    rowHeight: {
      type: Number,
      default: 150
    },
    margin: {
      type: [Number],
      default: [10, 10]
    }
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

const alertSchema = new Schema({
  ruleId: {
    type: String,
    enum: ['reliability_warning', 'reliability_critical'],
    required: true
  },
  metric: {
    type: String,
    enum: ['reliabilityScore'],
    required: true
  },
  severity: {
    type: String,
    enum: ['warning', 'critical'],
    required: true
  },
  threshold: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, { _id: false });
// Esquema de proyecto
const projectSchema = new Schema<ProjectDocument>({
  name: {
    type: String,
    required: [true, 'El nombre del proyecto es requerido'],
    trim: true,
    maxlength: [200, 'El nombre no puede exceder 200 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
  },
  domain: {
    type: String,
    enum: ['sales', 'marketing', 'finance', 'operations', 'custom'],
    default: 'sales',
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.DRAFT
  },
  datasets: [datasetSchema],
  dashboard: dashboardSchema,
  documentation: {
    type: String,
    maxlength: [200000, 'La documentación no puede exceder 200000 caracteres']
  },
  alerts: {
    type: [alertSchema],
    default: []
  },
  sharing: {
    enabled: {
      type: Boolean,
      default: false
    },
    token: {
      type: String,
      default: null,
      index: { unique: true, sparse: true }
    },
    permission: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer'
    },
    updatedAt: {
      type: Date,
      default: null
    }
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

// Índices
projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ name: 'text', description: 'text' });
projectSchema.index({ status: 1 });

// Middleware para limpiar datasets grandes antes de guardar
projectSchema.pre('save', function(this: ProjectDocument, next) {
  // Limitar el tamaño de los datos almacenados
  if (this.datasets) {
    this.datasets.forEach((dataset: any) => {
      if (dataset.data && dataset.data.length > 1000) {
        // Mantener solo una muestra para datasets muy grandes
        dataset.data = dataset.data.slice(0, 1000);
      }
    });
  }
  next();
});

// Método para obtener estadísticas del proyecto
projectSchema.methods.getStats = function(this: ProjectDocument) {
  return {
    totalDatasets: this.datasets?.length || 0,
    totalRows: this.datasets?.reduce((sum: number, ds: any) => sum + (ds.metadata?.rowCount || 0), 0) || 0,
    totalSize: this.datasets?.reduce((sum: number, ds: any) => sum + ds.size, 0) || 0,
    hasDocumentation: !!this.documentation,
    hasDashboard: !!this.dashboard,
    status: this.status
  };
};

export const Project = mongoose.model<ProjectDocument>('Project', projectSchema);