// Tipos compartidos entre frontend y backend

export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  userId: string;
  datasets: Dataset[];
  dashboard?: Dashboard;
  documentation?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dataset {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  data: any[];
  metadata: DatasetMetadata;
  uploadedAt: Date;
}

export interface DatasetMetadata {
  columns: ColumnInfo[];
  rowCount: number;
  dataTypes: Record<string, string>;
  summary: string;
  insights: string[];
}

export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  unique: boolean;
  examples: any[];
}

export interface Dashboard {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  widgets: Widget[];
  layout: DashboardLayout;
  generatedAt: Date;
}

export interface Widget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  description?: string;
  config: WidgetConfig;
  position: WidgetPosition;
}

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  dataSource: string;
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  filters?: Record<string, any>;
  colors?: string[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: [number, number];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
}

export interface AnalyzeDataRequest {
  datasetId: string;
  analysisType: 'basic' | 'advanced' | 'predictive';
}

export interface GeminiAnalysisResult {
  insights: string[];
  recommendations: string[];
  visualizations: VisualizationRecommendation[];
  summary: string;
  documentation: string;
}

export interface VisualizationRecommendation {
  type: 'chart' | 'metric' | 'table';
  chartType?: string;
  title: string;
  description: string;
  dataColumns: string[];
  reasoning: string;
}

// Enums
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

export enum ProjectStatus {
  DRAFT = 'draft',
  ANALYZING = 'analyzing',
  READY = 'ready',
  ERROR = 'error'
}

export enum DatasetStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error'
}

// Utility types
export type CreateProject = Omit<Project, '_id' | 'userId' | 'datasets' | 'createdAt' | 'updatedAt'>;
export type UpdateProject = Partial<Pick<Project, 'name' | 'description'>>;
export type CreateUser = Omit<User, '_id' | 'createdAt' | 'updatedAt'>;

// Additional backend-specific types
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface MulterFile extends Express.Multer.File {
  // Additional properties if needed
}

// Mongoose document types
export interface MongooseDocument {
  _id: any;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}