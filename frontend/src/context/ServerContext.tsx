import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { serversApi } from '../api/servers';
import type { Server } from '../api/servers';
import { useAuth } from './AuthContext';

interface ServerContextType {
  servers: Server[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | null>(null);

export function ServerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await serversApi.getAll();
      setServers(res.data);
    } catch {
      // Token ungültig o.ä. – still fail
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Beim Login automatisch laden
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <ServerContext.Provider value={{ servers, isLoading, refresh }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServers() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServers muss innerhalb von ServerProvider verwendet werden');
  return ctx;
}
