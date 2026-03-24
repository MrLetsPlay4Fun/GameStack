import axios from 'axios';

// Entwicklung: http://localhost:3001/api
// Produktion (Docker): /api  → nginx leitet weiter
const BASE = import.meta.env.VITE_API_URL ?? '';

const API = axios.create({
  baseURL: `${BASE}/api`,
});

// JWT-Token automatisch mitsenden wenn vorhanden
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  // Prüfen ob Setup erforderlich (noch kein Admin-Account)
  status: () => API.get<{ setupRequired: boolean }>('/auth/status'),

  // Ersten Admin-Account erstellen
  setup: (username: string, password: string) =>
    API.post<AuthResponse>('/auth/setup', { username, password }),

  // Login
  login: (username: string, password: string) =>
    API.post<AuthResponse>('/auth/login', { username, password }),
};

export default API;
