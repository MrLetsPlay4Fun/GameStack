import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Entwicklung: http://localhost:3001  |  Produktion (Docker): '' = gleicher Host
const BACKEND_URL = import.meta.env.VITE_API_URL ?? '';

// Einzelne Socket-Verbindung für die gesamte App
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, { autoConnect: true });
  }
  return socket;
}

export interface ServerStats {
  cpu: number; // CPU in %
  ram: number; // RAM in MB
}

// Hook: Server-Raum betreten und auf Events lauschen
export function useServerSocket(
  serverId: number,
  onLog: (line: string) => void,
  onStatus: (status: string) => void,
  onStats?: (stats: ServerStats) => void,
  onInstallStatus?: (status: string) => void,
) {
  const onLogRef = useRef(onLog);
  const onStatusRef = useRef(onStatus);
  const onStatsRef = useRef(onStats);
  const onInstallStatusRef = useRef(onInstallStatus);
  onLogRef.current = onLog;
  onStatusRef.current = onStatus;
  onStatsRef.current = onStats;
  onInstallStatusRef.current = onInstallStatus;

  useEffect(() => {
    const s = getSocket();
    s.emit('join:server', serverId);

    const handleLog = (data: { line: string }) => onLogRef.current(data.line);
    const handleStatus = (data: { status: string }) => onStatusRef.current(data.status);
    const handleStats = (data: ServerStats) => onStatsRef.current?.(data);
    const handleInstall = (data: { status: string }) => onInstallStatusRef.current?.(data.status);

    s.on('server:log', handleLog);
    s.on('server:status', handleStatus);
    s.on('server:stats', handleStats);
    s.on('server:install-status', handleInstall);

    return () => {
      s.emit('leave:server', serverId);
      s.off('server:log', handleLog);
      s.off('server:status', handleStatus);
      s.off('server:stats', handleStats);
      s.off('server:install-status', handleInstall);
    };
  }, [serverId]);
}

// Separater Hook: nur Stats empfangen (kein Room-Join – ConsoleTab macht das bereits)
export function useServerStats(
  serverId: number,
  onStats: (stats: ServerStats) => void,
) {
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  useEffect(() => {
    const s = getSocket();
    const handleStats = (data: ServerStats & { serverId: number }) => {
      if (data.serverId === serverId) onStatsRef.current(data);
    };
    s.on('server:stats', handleStats);
    return () => { s.off('server:stats', handleStats); };
  }, [serverId]);
}
