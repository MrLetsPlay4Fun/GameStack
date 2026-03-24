import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useServers } from '../context/ServerContext';

const gameEmojis: Record<string, string> = {
  minecraft: '⛏️',
  valheim: '⚔️',
  cs2: '🔫',
  rust: '🪓',
  palworld: '🐾',
};

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
      status === 'running' ? 'bg-green-500' : 'bg-[#3f4147]'
    }`} />
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { servers } = useServers();

  return (
    <div className="w-60 bg-[#2b2d31] flex flex-col h-full flex-shrink-0">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-[#1e1f24]">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <div>
            <span className="font-bold text-white text-base">GameStack</span>
            <p className="text-[#80848e] text-[10px] leading-none mt-0.5">v{__APP_VERSION__}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 border-b border-[#1e1f24]">
        <p className="text-xs font-semibold text-[#80848e] uppercase tracking-wide px-2 mb-1">
          Übersicht
        </p>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
              isActive ? 'bg-[#404249] text-white' : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
            }`
          }
        >
          <span>📊</span> Dashboard
        </NavLink>
      </nav>

      {/* Server-Liste */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between px-2 mb-1">
          <p className="text-xs font-semibold text-[#80848e] uppercase tracking-wide">Server</p>
          <NavLink
            to="/servers/new"
            className="text-[#80848e] hover:text-white transition-colors"
            title="Neuen Server erstellen"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </NavLink>
        </div>

        <div className="space-y-0.5">
          {servers.map((server) => (
            <NavLink
              key={server.id}
              to={`/servers/${server.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-[#404249] text-white' : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
                }`
              }
            >
              <span className="text-base">{gameEmojis[server.gameType] ?? '🖥️'}</span>
              <span className="flex-1 truncate">{server.name}</span>
              <StatusDot status={server.status} />
            </NavLink>
          ))}
        </div>

        {servers.length === 0 && (
          <p className="text-xs text-[#80848e] px-2 mt-2">
            Noch keine Server. Klicke auf + um einen zu erstellen.
          </p>
        )}
      </div>

      {/* User-Bereich */}
      <div className="px-2 py-2 border-t border-[#1e1f24] bg-[#232428]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#35373c] transition-colors group">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.username}</p>
            <p className="text-[#80848e] text-xs">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="opacity-0 group-hover:opacity-100 text-[#80848e] hover:text-white transition-all"
            title="Ausloggen"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
