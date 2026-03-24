import API from './auth';

export interface GameDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  type: string;
  defaultPort: number;
  defaultConfig: Record<string, any>;
  features?: {
    whitelist?: { supported: boolean; file?: string; note?: string };
    banlist?: { supported: boolean; file?: string; note?: string };
    console?: boolean;
  };
  configFields: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
    default: any;
  }>;
}

export interface Server {
  id: number;
  name: string;
  gameType: string;
  status: string;
  installStatus: string; // not_installed | installing | installed | failed
  autoRestart: boolean;
  port: number;
  pid: number | null;
  dataPath: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

export const gamesApi = {
  getAll: () => API.get<GameDefinition[]>('/games'),
  getById: (id: string) => API.get<GameDefinition>(`/games/${id}`),
};

export const serversApi = {
  getAll: () => API.get<Server[]>('/servers'),
  getById: (id: number) => API.get<Server>(`/servers/${id}`),
  create: (data: { name: string; gameType: string; port: number; config?: Record<string, any> }) =>
    API.post<Server>('/servers', data),
  update: (id: number, data: { name?: string; port?: number; config?: Record<string, any>; autoRestart?: boolean }) =>
    API.patch<Server>(`/servers/${id}`, data),
  delete: (id: number) => API.delete(`/servers/${id}`),
  install: (id: number) => API.post(`/servers/${id}/install`),
  update_files: (id: number) => API.post(`/servers/${id}/update`),
};
