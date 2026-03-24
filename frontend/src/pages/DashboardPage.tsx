import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useServers } from '../context/ServerContext';
import type { Server } from '../api/servers';

const gameEmojis: Record<string, string> = {
  minecraft: '⛏️', valheim: '⚔️', cs2: '🔫', rust: '🪓', palworld: '🐾',
};

// ─── Stat-Karte ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: string; color: string;
}) {
  return (
    <div className="bg-[#2b2d31] rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[#80848e] text-xs font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─── Server-Zeile ──────────────────────────────────────────────────────────
function ServerRow({ server }: { server: Server }) {
  const navigate = useNavigate();
  const statusMap: Record<string, { label: string; cls: string }> = {
    running:  { label: '● Online',   cls: 'bg-green-500/15 text-green-400' },
    stopped:  { label: '○ Offline',  cls: 'bg-[#3f4147] text-[#80848e]' },
    starting: { label: '◌ Startet…', cls: 'bg-yellow-500/15 text-yellow-400' },
    stopping: { label: '◌ Stoppt…',  cls: 'bg-orange-500/15 text-orange-400' },
  };
  const s = statusMap[server.status] ?? statusMap.stopped;

  return (
    <button
      onClick={() => navigate(`/servers/${server.id}`)}
      className="w-full flex items-center gap-3 py-3 border-b border-[#3f4147] last:border-0 hover:bg-[#313338] px-2 -mx-2 rounded-lg transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-[#1e1f24] flex items-center justify-center text-lg flex-shrink-0">
        {gameEmojis[server.gameType] ?? '🖥️'}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-white text-sm font-medium truncate">{server.name}</p>
        <p className="text-[#80848e] text-xs capitalize">Port {server.port}</p>
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${s.cls}`}>
        {s.label}
      </span>
    </button>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { servers, isLoading } = useServers();
  const navigate = useNavigate();

  const online  = servers.filter((s) => s.status === 'running').length;
  const offline = servers.filter((s) => s.status === 'stopped').length;

  return (
    <Layout title="Dashboard">
      {/* Begrüßung */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Hallo, {user?.username}! 👋</h2>
        <p className="text-[#b5bac1] text-sm mt-1">
          Hier siehst du eine Übersicht deiner Game-Server.
        </p>
      </div>

      {/* Stat-Karten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Server gesamt" value={servers.length} icon="🖥️" color="bg-indigo-500/15" />
        <StatCard label="Online"        value={online}         icon="✅" color="bg-green-500/15" />
        <StatCard label="Offline"       value={offline}        icon="⛔" color="bg-red-500/15" />
        <StatCard label="Auslastung"    value={servers.length > 0 ? Math.round((online / servers.length) * 100) : 0}
          icon="📊" color="bg-yellow-500/15" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Server-Liste */}
        <div className="bg-[#2b2d31] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Meine Server</h3>
            <button
              onClick={() => navigate('/servers/new')}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              + Neu erstellen
            </button>
          </div>

          {isLoading && (
            <p className="text-[#80848e] text-sm text-center py-6">Lädt…</p>
          )}

          {!isLoading && servers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🎮</p>
              <p className="text-white text-sm font-medium mb-1">Noch keine Server</p>
              <p className="text-[#80848e] text-xs mb-4">Erstelle deinen ersten Game-Server!</p>
              <button
                onClick={() => navigate('/servers/new')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Server erstellen
              </button>
            </div>
          )}

          {!isLoading && servers.map((s) => <ServerRow key={s.id} server={s} />)}
        </div>

        {/* Schnellaktionen */}
        <div className="bg-[#2b2d31] rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Schnellaktionen</h3>
          <div className="space-y-2">
            {[
              { icon: '➕', label: 'Neuen Server erstellen', desc: 'Spiel auswählen und loslegen', path: '/servers/new' },
              { icon: '📊', label: 'Server-Übersicht', desc: `${servers.length} Server, ${online} online`, path: '/' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#313338] hover:bg-[#3f4147] transition-colors text-left"
              >
                <span className="text-lg">{action.icon}</span>
                <div>
                  <p className="text-white text-sm font-medium">{action.label}</p>
                  <p className="text-[#80848e] text-xs">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Status-Übersicht */}
          {servers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#3f4147]">
              <p className="text-xs font-semibold text-[#80848e] uppercase tracking-wide mb-3">Status</p>
              <div className="space-y-2">
                {servers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{gameEmojis[s.gameType] ?? '🖥️'}</span>
                      <span className="text-white text-xs truncate max-w-32">{s.name}</span>
                    </div>
                    <span className={`w-2 h-2 rounded-full ${s.status === 'running' ? 'bg-green-500' : 'bg-[#3f4147]'}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
