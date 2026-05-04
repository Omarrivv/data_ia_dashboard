import axios, { AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  AuthResponse, 
  AuditLogEntry,
  AuditSummary,
  LoginRequest, 
  RegisterRequest,
  Project,
  CreateProjectRequest,
  UpdateProject,
  Dataset,
  Dashboard
} from '@/types';

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
  timeout: 8000, // 8s — evita bloquear la UI si el backend no responde
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login if not already there
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (data: LoginRequest): Promise<AxiosResponse<ApiResponse<AuthResponse>>> =>
    api.post('/auth/login', data),
  
  register: (data: RegisterRequest): Promise<AxiosResponse<ApiResponse<AuthResponse>>> =>
    api.post('/auth/register', data),

  logout: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/auth/logout'),
  
  getProfile: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/auth/me'),
  
  updateProfile: (data: { name?: string; email?: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.put('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/auth/change-password', data),
};

export const adminApi = {
  getAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    resourceType?: string;
  }): Promise<AxiosResponse<ApiResponse<{ entries: AuditLogEntry[]; pagination: { page: number; limit: number; total: number; pages: number } }>>> =>
    api.get('/admin/audit-logs', { params }),

  getAuditSummary: (): Promise<AxiosResponse<ApiResponse<AuditSummary>>> =>
    api.get('/admin/summary'),
};

// Projects API
export const projectsApi = {
  getProjects: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    status?: string; 
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/projects', { params }),
  
  getProject: (id: string, shareToken?: string): Promise<AxiosResponse<ApiResponse<Project>>> =>
    api.get(`/projects/${id}`, { params: shareToken ? { shareToken } : undefined }),

  getProjectShare: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/projects/${id}/share`),

  updateProjectShare: (id: string, data: { enabled: boolean; permission: 'viewer' | 'editor'; regenerateToken?: boolean }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.put(`/projects/${id}/share`, data),
  
  createProject: (data: CreateProjectRequest): Promise<AxiosResponse<ApiResponse<Project>>> =>
    api.post('/projects', data),
  
  updateProject: (id: string, data: UpdateProject): Promise<AxiosResponse<ApiResponse<Project>>> =>
    api.put(`/projects/${id}`, data),
  
  deleteProject: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/projects/${id}`),
  
  analyzeProject: (id: string, shareToken?: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/projects/${id}/analyze`, {}, { timeout: 120000, params: shareToken ? { shareToken } : undefined }), // 2 min — Gemini + dashboard generation

  chatWidget: (
    id: string,
    data: { message: string; widgetContext: any; conversationHistory: Array<{ role: string; text: string }> }
  ): Promise<AxiosResponse<ApiResponse<{ reply: string }>>> =>
    api.post(`/projects/${id}/chat`, data),

  getDashboard: (id: string, shareToken?: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/projects/${id}/dashboard`, { params: shareToken ? { shareToken } : undefined }),
  
  getDocumentation: (id: string, shareToken?: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/projects/${id}/documentation`, { params: shareToken ? { shareToken } : undefined }),

  getReliability: (id: string, shareToken?: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/projects/${id}/reliability`, { params: shareToken ? { shareToken } : undefined }),

  generateCustomWidget: (id: string, prompt: string, shareToken?: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/projects/${id}/generate-widget`, { prompt }, { timeout: 60000, params: shareToken ? { shareToken } : undefined }),
};

// Upload API
export const uploadApi = {
  uploadFile: (projectId: string, file: File, onProgress?: (progress: number) => void, shareToken?: string): Promise<AxiosResponse<ApiResponse<any>>> => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(`/upload/${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: shareToken ? { shareToken } : undefined,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  
  getDatasets: (projectId: string): Promise<AxiosResponse<ApiResponse<{ datasets: Dataset[] }>>> =>
    api.get(`/upload/${projectId}/datasets`),
  
  getDataset: (projectId: string, datasetId: string): Promise<AxiosResponse<ApiResponse<Dataset>>> =>
    api.get(`/upload/${projectId}/datasets/${datasetId}`),
  
  deleteDataset: (projectId: string, datasetId: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/upload/${projectId}/datasets/${datasetId}`),
};

// Dashboard API
export const dashboardApi = {
  getDashboard: (projectId: string): Promise<AxiosResponse<ApiResponse<Dashboard>>> =>
    api.get(`/dashboards/${projectId}`),
  
  updateDashboard: (projectId: string, data: Partial<Dashboard>): Promise<AxiosResponse<ApiResponse<Dashboard>>> =>
    api.put(`/dashboards/${projectId}`, data),
  
  addWidget: (projectId: string, widget: any): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/dashboards/${projectId}/widgets`, widget),
  
  updateWidget: (projectId: string, widgetId: string, widget: any): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.put(`/dashboards/${projectId}/widgets/${widgetId}`, widget),
  
  deleteWidget: (projectId: string, widgetId: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/dashboards/${projectId}/widgets/${widgetId}`),
  
  regenerateDashboard: (projectId: string): Promise<AxiosResponse<ApiResponse<Dashboard>>> =>
    api.post(`/dashboards/${projectId}/regenerate`),
  
  getVisualizationData: (projectId: string, datasetId: string, params?: any): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/dashboards/${projectId}/data/${datasetId}`, { params }),
};

export const jobsApi = {
  getJob: (id: string) => api.get(`/jobs/${id}`),
};

export default api;