import axios from 'axios';

function resolveBackendUrl() {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return window.location.origin;
}

export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL
  || resolveBackendUrl();

function getCookie(name) {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

let refreshPromise = null;

api.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    const csrfToken = getCookie('shmf_csrf');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthPath = originalRequest?.url?.includes('/api/auth/login') || originalRequest?.url?.includes('/api/auth/refresh');
    if (error.response?.status === 401 && !isAuthPath && !originalRequest._retry) {
      originalRequest._retry = true;
      refreshPromise = refreshPromise || api.post('/api/auth/refresh').catch((refreshError) => {
        if (refreshError.response?.status === 401) {
          return null;
        }
        throw refreshError;
      }).finally(() => {
        refreshPromise = null;
      });
      const refreshResult = await refreshPromise;
      if (refreshResult) {
        return api(originalRequest);
      }
    }
    throw error;
  }
);

export const AuthAPI = {
  login: (username, password) => api.post('/api/auth/login', { username, password }),
  refresh: () => api.post('/api/auth/refresh'),
  logout: () => api.post('/api/auth/logout'),
  logoutAll: () => api.post('/api/auth/logout-all'),
  me: () => api.get('/api/auth/me'),
  changePassword: (currentPassword, nextPassword) => api.post('/api/auth/change-password', { currentPassword, nextPassword })
};

export const ProfileAPI = {
  getProfile: () => api.get('/api/profile'),
  updateProfile: (payload) => api.put('/api/profile', payload)
};

export const PatientAPI = {
  getPatients: (params) => api.get('/api/patients', { params }),
  getSupportData: () => api.get('/api/patients/support-data'),
  getPatient: (patientId) => api.get(`/api/patients/${patientId}`),
  getRecentActivity: (limit = 10) => api.get('/api/patients/recent-activity', { params: { limit } }),
  createPatient: (payload) => api.post('/api/patients', payload),
  updatePatient: (patientId, payload) => api.patch(`/api/patients/${patientId}`, payload),
  archivePatient: (patientId) => api.delete(`/api/patients/${patientId}`),
  restorePatient: (patientId) => api.post(`/api/patients/${patientId}/restore`),
  addNote: (patientId, noteText, noteType) => api.post(`/api/patients/${patientId}/notes`, { noteText, noteType })
};

export const AdminAPI = {
  getUsers: () => api.get('/api/admin/users'),
  createUser: (payload) => api.post('/api/admin/users', payload),
  updateUser: (id, payload) => api.patch(`/api/admin/users/${id}`, payload),
  resetPassword: (id, password) => api.post(`/api/admin/users/${id}/reset-password`, { password }),
  getSystemSettings: () => api.get('/api/admin/system-settings'),
  updateSystemSettings: (settings) => api.put('/api/admin/system-settings', { settings }),
  getAuditLogs: () => api.get('/api/admin/audit-logs')
};

export default api;
