import axios, { AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  AuthResponse, 
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
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 8000, // 8s — evita bloquear la UI si el backend no responde
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      
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
  
  getProfile: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/auth/me'),
  
  updateProfile: (data: { name?: string; email?: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.put('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post('/auth/change-password', data),
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
  
  getProject: (id: string): Promise<AxiosResponse<ApiResponse<Project>>> =>
    api.get(`/projects/${id}`),
  
  createProject: (data: CreateProjectRequest): Promise<AxiosResponse<ApiResponse<Project>>> =>
    api.post('/projects', data),
  
  updateProject: (id: string, data: UpdateProject): Promise<AxiosResponse<ApiResponse<Project>>> =>
    api.put(`/projects/${id}`, data),
  
  deleteProject: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.delete(`/projects/${id}`),
  
  analyzeProject: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/projects/${id}/analyze`, {}, { timeout: 120000 }), // 2 min — Gemini + dashboard generation

  chatWidget: (
    id: string,
    data: { message: string; widgetContext: any; conversationHistory: Array<{ role: string; text: string }> }
  ): Promise<AxiosResponse<ApiResponse<{ reply: string }>>> =>
    api.post(`/projects/${id}/chat`, data),

  getDashboard: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/projects/${id}/dashboard`),
  
  getDocumentation: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/projects/${id}/documentation`),

  generateCustomWidget: (id: string, prompt: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/projects/${id}/generate-widget`, { prompt }, { timeout: 60000 }),
};

// Upload API
export const uploadApi = {
  uploadFile: (projectId: string, file: File, onProgress?: (progress: number) => void): Promise<AxiosResponse<ApiResponse<any>>> => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(`/upload/${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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

export default api;