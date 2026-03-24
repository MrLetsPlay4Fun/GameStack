import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { serversApi, gamesApi } from '../api/servers';
import type { Server, GameDefinition } from '../api/servers';
import API from '../api/auth';
import { useServerSocket, useServerStats, useServerInstallStatus } from '../hooks/useSocket';
import type { ServerStats } from '../hooks/useSocket';
import { useServers } from '../context/ServerContext';

type Tab = 'overview' | 'console' | 'settings' | 'backups' | 'tasks' | 'whitelist' | 'banlist';

// ─── Status-Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    running:  { label: '● Online',    cls: 'bg-green-500/15 text-green-400' },
    stopped:  { label: '○ Offline',   cls: 'bg-[#3f4147] text-[#80848e]' },
    starting: { label: '◌ Startet…',  cls: 'bg-yellow-500/15 text-yellow-400' },
    stopping: { label: '◌ Stoppt…',   cls: 'bg-orange-500/15 text-orange-400' },
  };
  const s = map[status] ?? map.stopped;
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>;
}

// ─── Aktions-Button ────────────────────────────────────────────────────────
function ActionBtn({ label, onClick, disabled, color }: { label: string; onClick: () => void; disabled?: boolean; color: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${color}`}>
      {label}
    </button>
  );
}

// ─── Spieler-Listen-Tab (Whitelist / Banlist) ──────────────────────────────
function PlayerListTab({ serverId, type, supported, note }: {
  serverId: number; type: 'whitelist' | 'banlist'; supported: boolean; note?: string;
}) {
  const [entries, setEntries] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const label = type === 'whitelist' ? 'Whitelist' : 'Banliste';

  useEffect(() => {
    if (!supported) return;
    API.get(`/servers/${serverId}/${type}`).then((r) => setEntries(r.data.entries || []));
  }, [serverId, type, supported]);

  const add = async () => {
    if (!input.trim()) return;
    setError(''); setLoading(true);
    try {
      const r = await API.post(`/servers/${serverId}/${type}`, { entry: input.trim(), reason });
      setEntries(r.data.entries || []);
      setInput(''); setReason('');
    } catch (e: any) { setError(e.response?.data?.error || 'Fehler'); }
    finally { setLoading(false); }
  };

  const remove = async (entry: string) => {
    setLoading(true);
    try {
      const r = await API.delete(`/servers/${serverId}/${type}`, { data: { entry } });
      setEntries(r.data.entries || []);
    } catch (e: any) { setError(e.response?.data?.error || 'Fehler'); }
    finally { setLoading(false); }
  };

  if (!supported) {
    return (
      <div className="bg-[#2b2d31] rounded-xl p-6 text-center">
        <p className="text-4xl mb-3">🚫</p>
        <p className="text-white font-semibold mb-1">{label} nicht verfügbar</p>
        <p className="text-[#80848e] text-sm">{note}</p>
      </div>
    );
  }

  const getName = (e: any) => (typeof e === 'string' ? e : e.name || e.uuid || JSON.stringify(e));

  return (
    <div className="space-y-4">
      {/* Hinzufügen */}
      <div className="bg-[#2b2d31] rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">Spieler zur {label} hinzufügen</h3>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={type === 'whitelist' ? 'Spielername' : 'Spielername / ID'}
            className="flex-1 bg-[#1e1f24] text-white rounded-lg px-3 py-2 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          {type === 'banlist' && (
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Grund (optional)"
              className="flex-1 bg-[#1e1f24] text-white rounded-lg px-3 py-2 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500" />
          )}
          <button onClick={add} disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            Hinzufügen
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="bg-[#2b2d31] rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-3">
          {label} ({entries.length} Einträge)
        </h3>
        {entries.length === 0 ? (
          <p className="text-[#80848e] text-sm">Keine Einträge vorhanden.</p>
        ) : (
          <div className="space-y-1">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#3f4147] last:border-0">
                <div>
                  <span className="text-white text-sm">{getName(e)}</span>
                  {typeof e === 'object' && e.reason && (
                    <span className="text-[#80848e] text-xs ml-2">— {e.reason}</span>
                  )}
                </div>
                <button onClick={() => remove(getName(e))}
                  className="text-red-400 hover:text-red-300 text-xs transition-colors ml-4">
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Konsolen-Tab ──────────────────────────────────────────────────────────
function ConsoleTab({ serverId, status, onStatusChange }: {
  serverId: number; status: string; onStatusChange: (s: string) => void;
}) {
  const [logs, setLogs] = useState<string[]>(['[GameStack] Konsole verbunden – warte auf Server-Output…\n']);
  const [command, setCommand] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  // Neue Log-Zeile anhängen
  const addLog = useCallback((line: string) => {
    setLogs((l) => [...l.slice(-500), line]); // max 500 Zeilen im Speicher
  }, []);

  // WebSocket-Verbindung
  useServerSocket(serverId, addLog, onStatusChange);

  // Auto-Scroll
  useEffect(() => {
    if (autoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const sendCmd = async () => {
    if (!command.trim()) return;
    try {
      await API.post(`/servers/${serverId}/command`, { command });
      addLog(`> ${command}\n`);
      setCommand('');
    } catch (e: any) {
      addLog(`[Fehler] ${e.response?.data?.error || 'Befehl fehlgeschlagen'}\n`);
    }
  };

  return (
    <div className="bg-[#1e1f24] rounded-xl overflow-hidden">
      {/* Log-Ausgabe */}
      <div
        className="h-[28rem] overflow-y-auto p-4 font-mono text-xs text-green-400 leading-relaxed"
        onScroll={(e) => {
          const el = e.currentTarget;
          autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        }}
      >
        {logs.map((line, i) => (
          <span key={i} className={`block whitespace-pre-wrap ${
            line.startsWith('[GameStack]') ? 'text-indigo-400' :
            line.startsWith('[Fehler]')    ? 'text-red-400' :
            line.startsWith('>')           ? 'text-yellow-400' : 'text-green-400'
          }`}>{line}</span>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Eingabe */}
      <div className="border-t border-[#3f4147] p-3 flex gap-2 items-center">
        <span className="text-green-400 font-mono text-sm">{'>'}</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendCmd()}
          disabled={status !== 'running'}
          placeholder={status === 'running' ? 'Befehl eingeben und Enter drücken…' : 'Server starten um Befehle zu senden'}
          className="flex-1 bg-transparent text-white text-sm font-mono focus:outline-none placeholder-[#3f4147] disabled:opacity-40"
        />
        {status === 'running' && (
          <button
            onClick={sendCmd}
            disabled={!command.trim()}
            className="text-green-400 hover:text-green-300 text-sm font-semibold disabled:opacity-40 transition-colors px-2"
          >
            Senden
          </button>
        )}
        <button
          onClick={() => setLogs(['[GameStack] Konsole geleert.\n'])}
          className="text-[#80848e] hover:text-white text-xs transition-colors px-2"
          title="Konsole leeren"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Einstellungs-Tab ─────────────────────────────────────────────────────
function SettingsTab({ server, game, onSaved }: {
  server: Server; game: GameDefinition | null; onSaved: () => void;
}) {
  const [name, setName] = useState(server.name);
  const [port, setPort] = useState(String(server.port));
  const [config, setConfig] = useState<Record<string, any>>(JSON.parse(server.config || '{}'));
  const [autoRestart, setAutoRestart] = useState(server.autoRestart);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const whitelistEnabled = config.whitelistEnabled ?? false;

  const save = async () => {
    setError(''); setLoading(true); setSaved(false);
    try {
      await serversApi.update(server.id, { name, port: Number(port), config, autoRestart });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Speichern fehlgeschlagen.');
    } finally { setLoading(false); }
  };

  const setConfigField = (key: string, value: any) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="max-w-xl space-y-4">
      {/* Allgemeine Einstellungen */}
      <div className="bg-[#2b2d31] rounded-xl p-5 space-y-4">
        <h3 className="text-white font-semibold text-sm border-b border-[#3f4147] pb-3">
          Allgemeine Einstellungen
        </h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Servername */}
        <div>
          <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
            Servername
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>

        {/* Port */}
        <div>
          <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
            Port
          </label>
          <input type="number" value={port} onChange={(e) => setPort(e.target.value)}
            className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors" />
          <p className="text-[#80848e] text-xs mt-1">Port-Änderungen werden beim nächsten Start übernommen.</p>
        </div>

        {/* Auto-Restart-Toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-white text-sm font-medium">Auto-Restart bei Absturz</p>
            <p className="text-[#80848e] text-xs mt-0.5">
              Server wird automatisch neu gestartet (max. 3× in 5 Min.)
            </p>
          </div>
          <button
            onClick={() => setAutoRestart(!autoRestart)}
            className={`relative w-11 h-6 rounded-full transition-colors ${autoRestart ? 'bg-indigo-600' : 'bg-[#3f4147]'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoRestart ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Whitelist-Toggle (nur wenn unterstützt) */}
        {game?.features?.whitelist?.supported && (
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-white text-sm font-medium">Whitelist aktivieren</p>
              <p className="text-[#80848e] text-xs mt-0.5">
                Nur Spieler auf der Whitelist können beitreten
              </p>
            </div>
            <button
              onClick={() => setConfigField('whitelistEnabled', !whitelistEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                whitelistEnabled ? 'bg-indigo-600' : 'bg-[#3f4147]'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                whitelistEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        )}
      </div>

      {/* Spielspezifische Einstellungen */}
      {game && game.configFields.length > 0 && (
        <div className="bg-[#2b2d31] rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm border-b border-[#3f4147] pb-3">
            {game.emoji} {game.name} Einstellungen
          </h3>

          {game.configFields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select value={config[field.key] ?? field.default}
                  onChange={(e) => setConfigField(field.key, e.target.value)}
                  className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors">
                  {field.options!.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input type={field.type === 'number' ? 'number' : 'text'}
                  value={config[field.key] ?? field.default}
                  onChange={(e) => setConfigField(field.key, e.target.value)}
                  className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Speichern */}
      <button onClick={save} disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
        {loading ? 'Speichert…' : saved ? '✓ Gespeichert!' : 'Einstellungen speichern'}
      </button>

      {/* Gefahrenzone */}
      <div className="bg-[#2b2d31] rounded-xl p-5 border border-red-500/20">
        <h3 className="text-red-400 font-semibold text-sm mb-3">⚠️ Gefahrenzone</h3>
        <p className="text-[#80848e] text-xs mb-3">
          Der Server wird automatisch gestoppt und dann gelöscht. Die Server-Dateien auf der Festplatte bleiben erhalten.
        </p>
        <button
          onClick={async () => {
            if (!confirm(`Server "${server.name}" wirklich löschen?\n\nDer Server wird automatisch gestoppt.`)) return;
            try {
              await serversApi.delete(server.id);
              window.location.href = '/';
            } catch (e: any) {
              alert(`Fehler beim Löschen: ${e.response?.data?.error || e.message}`);
            }
          }}
          className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          Server löschen
        </button>
      </div>
    </div>
  );
}

// ─── Aufgaben-Tab ──────────────────────────────────────────────────────────
const TASK_INTERVALS = [
  { value: 'every5m',  label: 'Alle 5 Minuten' },
  { value: 'every10m', label: 'Alle 10 Minuten' },
  { value: 'every15m', label: 'Alle 15 Minuten' },
  { value: 'every30m', label: 'Alle 30 Minuten' },
  { value: 'every60m', label: 'Jede Stunde' },
  { value: 'every2h',  label: 'Alle 2 Stunden' },
  { value: 'every6h',  label: 'Alle 6 Stunden' },
  { value: 'every12h', label: 'Alle 12 Stunden' },
  { value: 'daily',    label: 'Täglich' },
  { value: 'weekly',   label: 'Wöchentlich' },
];
const WEEKDAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

function TaskForm({ serverId, onSaved, editTask, onCancel }: {
  serverId: number; onSaved: () => void; editTask?: any; onCancel: () => void;
}) {
  const [name, setName] = useState(editTask?.name ?? '');
  const [interval, setTaskInterval] = useState('every60m');
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(1);
  const [commands, setCommands] = useState<string[]>(
    editTask ? JSON.parse(editTask.commands || '[]') : ['']
  );
  const [enabled, setEnabled] = useState(editTask?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const showTime = interval === 'daily' || interval === 'weekly';
  const showDay  = interval === 'weekly';

  const addCommand    = () => setCommands([...commands, '']);
  const removeCommand = (i: number) => setCommands(commands.filter((_, idx) => idx !== i));
  const updateCommand = (i: number, v: string) => setCommands(commands.map((c, idx) => idx === i ? v : c));
  const moveUp        = (i: number) => { if (i === 0) return; const c = [...commands]; [c[i-1],c[i]] = [c[i],c[i-1]]; setCommands(c); };
  const moveDown      = (i: number) => { if (i === commands.length-1) return; const c = [...commands]; [c[i],c[i+1]] = [c[i+1],c[i]]; setCommands(c); };

  const save = async () => {
    setError('');
    const validCmds = commands.filter((c) => c.trim());
    if (!name.trim()) return setError('Name fehlt.');
    if (!validCmds.length) return setError('Mindestens ein Befehl erforderlich.');
    setSaving(true);
    try {
      const payload = { name, interval, hour, minute, weekday, commands: validCmds, enabled };
      if (editTask) {
        await API.patch(`/servers/${serverId}/tasks/${editTask.id}`, payload);
      } else {
        await API.post(`/servers/${serverId}/tasks`, payload);
      }
      onSaved();
    } catch (e: any) { setError(e.response?.data?.error || 'Fehler beim Speichern.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-[#2b2d31] rounded-xl p-5 space-y-4 border border-indigo-500/30">
      <h3 className="text-white font-semibold text-sm">
        {editTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe erstellen'}
      </h3>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Stündliche Ankündigung"
          className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500" />
      </div>

      {/* Intervall */}
      <div>
        <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Häufigkeit</label>
        <select value={interval} onChange={(e) => setTaskInterval(e.target.value)}
          className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
          {TASK_INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </div>

      {/* Uhrzeit */}
      {showTime && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Stunde</label>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
              className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
              {Array.from({length:24},(_,i) => <option key={i} value={i}>{String(i).padStart(2,'0')}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Minute</label>
            <select value={minute} onChange={(e) => setMinute(Number(e.target.value))}
              className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
              {[0,5,10,15,20,25,30,45].map((m) => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
            </select>
          </div>
        </div>
      )}
      {showDay && (
        <div>
          <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Wochentag</label>
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}
            className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
            {WEEKDAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Befehle */}
      <div>
        <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
          Befehle (werden der Reihe nach ausgeführt)
        </label>
        <div className="space-y-2">
          {commands.map((cmd, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[#80848e] text-xs w-5 text-right flex-shrink-0">{i+1}.</span>
              <input value={cmd} onChange={(e) => updateCommand(i, e.target.value)}
                placeholder="z.B. say Server-Neustart in 5 Minuten"
                className="flex-1 bg-[#1e1f24] text-white rounded-lg px-3 py-2 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 font-mono" />
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => moveUp(i)} disabled={i===0}
                  className="text-[#80848e] hover:text-white disabled:opacity-30 text-xs px-1">↑</button>
                <button onClick={() => moveDown(i)} disabled={i===commands.length-1}
                  className="text-[#80848e] hover:text-white disabled:opacity-30 text-xs px-1">↓</button>
                <button onClick={() => removeCommand(i)} disabled={commands.length===1}
                  className="text-red-400 hover:text-red-300 disabled:opacity-30 text-xs px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addCommand}
          className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          + Befehl hinzufügen
        </button>
      </div>

      {/* Aktiviert */}
      <div className="flex items-center gap-3">
        <button onClick={() => setEnabled(!enabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-[#3f4147]'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <span className="text-white text-sm">Aufgabe aktiv</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors">
          {saving ? 'Speichert…' : editTask ? 'Speichern' : 'Aufgabe erstellen'}
        </button>
        <button onClick={onCancel}
          className="px-4 bg-[#3f4147] hover:bg-[#4e5058] text-white rounded-lg text-sm transition-colors">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function TasksTab({ serverId }: { serverId: number }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);

  const load = async () => {
    const r = await API.get(`/servers/${serverId}/tasks`);
    setTasks(r.data);
  };

  useEffect(() => { load(); }, [serverId]);

  const toggleEnabled = async (task: any) => {
    await API.patch(`/servers/${serverId}/tasks/${task.id}`, { enabled: !task.enabled });
    await load();
  };

  const deleteTask = async (taskId: number) => {
    if (!confirm('Aufgabe wirklich löschen?')) return;
    await API.delete(`/servers/${serverId}/tasks/${taskId}`);
    await load();
  };

  const onSaved = () => {
    setShowForm(false);
    setEditTask(null);
    load();
  };

  return (
    <div className="space-y-4">
      {/* Formular */}
      {(showForm || editTask) && (
        <TaskForm serverId={serverId} onSaved={onSaved} editTask={editTask}
          onCancel={() => { setShowForm(false); setEditTask(null); }} />
      )}

      {/* Header */}
      {!showForm && !editTask && (
        <div className="bg-[#2b2d31] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">Geplante Aufgaben</h3>
              <p className="text-[#80848e] text-xs mt-0.5">
                Befehle automatisch an die Server-Konsole senden
              </p>
            </div>
            <button onClick={() => setShowForm(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              + Neue Aufgabe
            </button>
          </div>
        </div>
      )}

      {/* Aufgaben-Liste */}
      {tasks.length === 0 && !showForm ? (
        <div className="bg-[#2b2d31] rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">⏱️</p>
          <p className="text-white font-semibold mb-1">Noch keine Aufgaben</p>
          <p className="text-[#80848e] text-sm mb-4">
            Erstelle automatische Befehlsfolgen – z.B. stündliche Ankündigungen oder regelmäßige Saves.
          </p>
          <button onClick={() => setShowForm(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Erste Aufgabe erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const cmds = JSON.parse(task.commands || '[]');
            return (
              <div key={task.id} className={`bg-[#2b2d31] rounded-xl p-5 border ${task.enabled ? 'border-[#3f4147]' : 'border-[#2b2d31] opacity-60'}`}>
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <button onClick={() => toggleEnabled(task)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${task.enabled ? 'bg-indigo-600' : 'bg-[#3f4147]'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${task.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{task.name}</p>
                      <span className="bg-[#313338] text-[#b5bac1] text-xs px-2 py-0.5 rounded-full">
                        {TASK_INTERVALS.find((i) => i.value === task.cronExpr) ?? task.cronExpr}
                      </span>
                    </div>

                    {/* Befehls-Liste */}
                    <div className="mt-2 space-y-1">
                      {cmds.map((cmd: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[#80848e] text-xs w-4">{i+1}.</span>
                          <code className="text-green-400 text-xs bg-[#1e1f24] px-2 py-0.5 rounded">{cmd}</code>
                        </div>
                      ))}
                    </div>

                    {task.lastRun && (
                      <p className="text-[#80848e] text-xs mt-2">
                        Zuletzt ausgeführt: {new Date(task.lastRun).toLocaleString('de-DE')}
                      </p>
                    )}
                  </div>

                  {/* Aktionen */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setEditTask(task); setShowForm(false); }}
                      className="text-[#80848e] hover:text-white text-xs transition-colors px-2">✏️</button>
                    <button onClick={() => deleteTask(task.id)}
                      className="text-red-400 hover:text-red-300 text-xs transition-colors px-2">🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Zeitplan-Editor ───────────────────────────────────────────────────────
const INTERVALS = [
  { value: 'hourly',   label: 'Jede Stunde' },
  { value: 'every6h',  label: 'Alle 6 Stunden' },
  { value: 'every12h', label: 'Alle 12 Stunden' },
  { value: 'daily',    label: 'Täglich' },
  { value: 'weekly',   label: 'Wöchentlich' },
];

function ScheduleEditor({ serverId }: { serverId: number }) {
  const [schedule, setSchedule] = useState<any>(null);
  const [enabled, setEnabled] = useState(false);
  const [interval, setInterval] = useState('daily');
  const [hour, setHour] = useState(3);
  const [weekday, setWeekday] = useState(1);
  const [keepCount, setKeepCount] = useState(5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get(`/servers/${serverId}/backups/schedule`).then((r) => {
      if (r.data) {
        setSchedule(r.data);
        setEnabled(r.data.enabled);
        setKeepCount(r.data.keepCount);
        // Cron-Ausdruck zurück in Optionen übersetzen
        const c = r.data.cronExpr;
        if (c === '0 * * * *')       setInterval('hourly');
        else if (c === '0 */6 * * *') setInterval('every6h');
        else if (c === '0 */12 * * *') setInterval('every12h');
        else if (c.endsWith('* * *')) { setInterval('daily');  setHour(Number(c.split(' ')[1])); }
        else                          { setInterval('weekly'); setHour(Number(c.split(' ')[1])); setWeekday(Number(c.split(' ')[4])); }
      }
    }).catch(() => {});
  }, [serverId]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const r = await API.post(`/servers/${serverId}/backups/schedule`, {
        interval, hour, weekday, keepCount, enabled,
      });
      setSchedule(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Speichern fehlgeschlagen.');
    } finally { setSaving(false); }
  };

  const deleteSchedule = async () => {
    if (!confirm('Zeitplan wirklich löschen?')) return;
    await API.delete(`/servers/${serverId}/backups/schedule`);
    setSchedule(null);
    setEnabled(false);
  };

  const showTime = interval === 'daily' || interval === 'weekly';
  const showDay  = interval === 'weekly';

  return (
    <div className="bg-[#2b2d31] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Automatische Backups</h3>
          <p className="text-[#80848e] text-xs mt-0.5">
            {schedule ? `Aktiver Zeitplan: ${schedule.description ?? schedule.cronExpr}` : 'Kein Zeitplan konfiguriert'}
          </p>
        </div>
        {/* Aktivieren-Toggle */}
        <button onClick={() => setEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-[#3f4147]'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 pt-2 border-t border-[#3f4147]">
          {/* Intervall */}
          <div>
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Häufigkeit</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value)}
              className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
              {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>

          {/* Uhrzeit */}
          {showTime && (
            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Uhrzeit</label>
              <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
                {Array.from({length: 24}, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2,'0')}:00 Uhr</option>
                ))}
              </select>
            </div>
          )}

          {/* Wochentag */}
          {showDay && (
            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">Wochentag</label>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500">
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Aufbewahrung */}
          <div>
            <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
              Aufbewahrung (letzte {keepCount} Backups)
            </label>
            <input type="range" min={1} max={20} value={keepCount}
              onChange={(e) => setKeepCount(Number(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[#80848e] text-xs mt-1">
              <span>1</span><span className="text-indigo-400 font-semibold">{keepCount} Backups</span><span>20</span>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors">
          {saving ? 'Speichert…' : saved ? '✓ Gespeichert!' : 'Zeitplan speichern'}
        </button>
        {schedule && (
          <button onClick={deleteSchedule}
            className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 px-4 rounded-lg text-sm transition-colors">
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Backup-Tab ────────────────────────────────────────────────────────────
function BackupTab({ serverId, serverStatus }: { serverId: number; serverStatus: string }) {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const r = await API.get(`/servers/${serverId}/backups`);
    setBackups(r.data);
  };

  useEffect(() => { load(); }, [serverId]);

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  const createBackup = async () => {
    setLoading(true); setError('');
    try {
      await API.post(`/servers/${serverId}/backups`);
      await load();
      flash('Backup erfolgreich erstellt!');
    } catch (e: any) { flash(e.response?.data?.error || 'Backup fehlgeschlagen.', true); }
    finally { setLoading(false); }
  };

  const restore = async (backupId: number, filename: string) => {
    if (!confirm(`Backup "${filename}" wiederherstellen?\n\nACHTUNG: Der aktuelle Server-Stand wird überschrieben!\nDer Server muss gestoppt sein.`)) return;
    setActionId(backupId);
    try {
      await API.post(`/servers/${serverId}/backups/${backupId}/restore`);
      flash('Backup erfolgreich wiederhergestellt! Server kann jetzt gestartet werden.');
    } catch (e: any) { flash(e.response?.data?.error || 'Wiederherstellung fehlgeschlagen.', true); }
    finally { setActionId(null); }
  };

  const remove = async (backupId: number) => {
    if (!confirm('Backup wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;
    setActionId(backupId);
    try {
      await API.delete(`/servers/${serverId}/backups/${backupId}`);
      await load();
      flash('Backup gelöscht.');
    } catch (e: any) { flash(e.response?.data?.error || 'Löschen fehlgeschlagen.', true); }
    finally { setActionId(null); }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Zeitplan-Editor */}
      <ScheduleEditor serverId={serverId} />

      {/* Aktionsleiste */}
      <div className="bg-[#2b2d31] rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-white font-semibold text-sm">Backups</h3>
            <p className="text-[#80848e] text-xs mt-0.5">
              {backups.length} Backup{backups.length !== 1 ? 's' : ''} vorhanden
            </p>
          </div>
          <button onClick={createBackup} disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
            {loading ? <span className="animate-spin">⟳</span> : '💾'}
            {loading ? 'Erstelle Backup…' : 'Jetzt sichern'}
          </button>
        </div>

        {/* Meldungen */}
        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="mt-3 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3">
            ✓ {success}
          </div>
        )}

        {serverStatus === 'running' && (
          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs rounded-lg px-4 py-2">
            💡 Tipp: Für ein konsistentes Backup empfiehlt es sich, den Server zuerst zu stoppen.
          </div>
        )}
      </div>

      {/* Backup-Liste */}
      {backups.length === 0 ? (
        <div className="bg-[#2b2d31] rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">💾</p>
          <p className="text-white font-semibold mb-1">Noch keine Backups</p>
          <p className="text-[#80848e] text-sm">Klicke auf "Jetzt sichern" um das erste Backup zu erstellen.</p>
        </div>
      ) : (
        <div className="bg-[#2b2d31] rounded-xl overflow-hidden">
          {backups.map((backup, i) => (
            <div key={backup.id}
              className={`flex items-center gap-4 px-5 py-4 ${i !== backups.length - 1 ? 'border-b border-[#3f4147]' : ''}`}>
              {/* Icon + Info */}
              <div className="text-2xl flex-shrink-0">{backup.automatic ? '🤖' : '💾'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{backup.filename}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[#80848e] text-xs">
                    {new Date(backup.createdAt).toLocaleString('de-DE')}
                  </span>
                  <span className="text-[#80848e] text-xs">•</span>
                  <span className="text-[#80848e] text-xs">{fmtSize(backup.size)}</span>
                  {backup.automatic && (
                    <span className="bg-[#3f4147] text-[#b5bac1] text-xs px-2 py-0.5 rounded-full">Auto</span>
                  )}
                  {!backup.exists && (
                    <span className="bg-red-500/15 text-red-400 text-xs px-2 py-0.5 rounded-full">Datei fehlt</span>
                  )}
                </div>
              </div>

              {/* Aktionen */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => restore(backup.id, backup.filename)}
                  disabled={actionId === backup.id || !backup.exists || serverStatus === 'running'}
                  title={serverStatus === 'running' ? 'Server zuerst stoppen' : 'Wiederherstellen'}
                  className="bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {actionId === backup.id ? '⟳' : '↩ Restore'}
                </button>
                <button
                  onClick={() => remove(backup.id)}
                  disabled={actionId === backup.id}
                  className="bg-red-600/10 hover:bg-red-600/30 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Übersichts-Tab ────────────────────────────────────────────────────────
function OverviewTab({ server, game, stats, installStatus, onInstall, onUpdate: _onUpdate, onTabSwitch }: {
  server: Server; game: GameDefinition | null; stats: ServerStats | null;
  installStatus: string;
  onInstall: () => void;
  onUpdate: () => void;
  onTabSwitch: (tab: string) => void;
}) {
  const config = JSON.parse(server.config || '{}');
  const isInstalling = installStatus === 'installing';

  return (
    <div className="space-y-4">

      {/* ── Installations-Banner ── */}
      {installStatus !== 'installed' && (
        <div className={`rounded-xl p-5 border ${
          installStatus === 'failed'     ? 'bg-red-500/10 border-red-500/30' :
          isInstalling                   ? 'bg-indigo-500/10 border-indigo-500/30' :
                                           'bg-[#2b2d31] border-[#3f4147]'
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              {installStatus === 'failed' && <>
                <p className="text-red-400 font-semibold text-sm">✗ Installation fehlgeschlagen</p>
                <p className="text-[#80848e] text-xs mt-0.5">Prüfe die Konsole für Details und versuche es erneut.</p>
              </>}
              {isInstalling && <>
                <p className="text-indigo-400 font-semibold text-sm flex items-center gap-2">
                  <span className="animate-spin inline-block">⟳</span> Installation läuft…
                </p>
                <p className="text-[#80848e] text-xs mt-0.5">Fortschritt in der Konsole sichtbar.</p>
              </>}
              {installStatus === 'not_installed' && <>
                <p className="text-white font-semibold text-sm">📦 Server noch nicht installiert</p>
                <p className="text-[#80848e] text-xs mt-0.5">
                  {game?.type === 'java' ? 'Paper JAR wird von papermc.io heruntergeladen.' : 'Server-Dateien werden via SteamCMD installiert.'}
                </p>
              </>}
            </div>
            <div className="flex gap-2">
              {isInstalling ? (
                <button onClick={() => onTabSwitch('console')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  Konsole öffnen
                </button>
              ) : (
                <button onClick={onInstall}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  {installStatus === 'failed' ? '↺ Erneut versuchen' : '▼ Jetzt installieren'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ressourcen-Karten (nur wenn Server läuft) */}
      {server.status === 'running' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#2b2d31] rounded-xl p-5">
            <p className="text-[#80848e] text-xs font-semibold uppercase tracking-wide mb-2">CPU-Auslastung</p>
            <p className="text-white text-3xl font-bold">
              {stats ? `${stats.cpu}%` : <span className="text-[#80848e] text-lg animate-pulse">Messe…</span>}
            </p>
            {stats && (
              <div className="mt-3 h-2 bg-[#3f4147] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.cpu > 80 ? 'bg-red-500' : stats.cpu > 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(stats.cpu, 100)}%` }}
                />
              </div>
            )}
          </div>
          <div className="bg-[#2b2d31] rounded-xl p-5">
            <p className="text-[#80848e] text-xs font-semibold uppercase tracking-wide mb-2">RAM-Verbrauch</p>
            <p className="text-white text-3xl font-bold">
              {stats ? `${stats.ram} MB` : <span className="text-[#80848e] text-lg animate-pulse">Messe…</span>}
            </p>
            {stats && (
              <p className="text-[#80848e] text-xs mt-2">
                Aktualisiert alle 5 Sekunden
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#2b2d31] rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Server-Informationen</h3>
          <dl className="space-y-3 text-sm">
            {[
              { label: 'Spiel', value: game ? `${game.emoji} ${game.name}` : server.gameType },
              { label: 'Port', value: server.port },
              { label: 'Status', value: <StatusBadge status={server.status} /> },
              { label: 'Prozess-ID', value: server.pid ?? '—' },
              { label: 'Erstellt', value: new Date(server.createdAt).toLocaleString('de-DE') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <dt className="text-[#80848e]">{label}</dt>
                <dd className="text-white font-medium">{value as any}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-[#2b2d31] rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Konfiguration</h3>
          {Object.entries(config).length === 0 ? (
            <p className="text-[#80848e] text-sm">Keine Konfiguration vorhanden.</p>
          ) : (
            <dl className="space-y-3 text-sm">
              {Object.entries(config).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center">
                  <dt className="text-[#80848e] capitalize">{key}</dt>
                  <dd className="text-white font-medium">{String(val)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ──────────────────────────────────────────────────────
export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [server, setServer] = useState<Server | null>(null);
  const [game, setGame] = useState<GameDefinition | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [installStatus, setInstallStatus] = useState<string>('');

  const { refresh: refreshSidebar } = useServers();

  const loadServer = async () => {
    const res = await serversApi.getById(Number(id));
    setServer(res.data);
    const gRes = await gamesApi.getById(res.data.gameType).catch(() => null);
    if (gRes) setGame(gRes.data);
  };

  // Status-Update via WebSocket (kein API-Call nötig)
  const handleStatusChange = useCallback((newStatus: string) => {
    setServer((s) => s ? { ...s, status: newStatus } : s);
    if (newStatus === 'stopped') setStats(null); // Stats zurücksetzen wenn offline
    refreshSidebar(); // Sidebar-Statusdot aktualisieren
  }, [refreshSidebar]);

  const handleStats = useCallback((s: ServerStats) => {
    setStats(s);
  }, []);

  const handleInstallStatus = useCallback((status: string) => {
    setInstallStatus(status);
    if (status === 'installed' || status === 'failed') loadServer();
  }, []);

  useServerStats(Number(id), handleStats);
  useServerInstallStatus(Number(id), handleInstallStatus);

  // installStatus aus DB laden wenn Seite geöffnet wird
  useEffect(() => {
    if (server) setInstallStatus(server.installStatus);
  }, [server?.installStatus]);

  useEffect(() => { loadServer(); }, [id]);

  const action = async (type: 'start' | 'stop' | 'restart') => {
    setError(''); setActionLoading(true);
    try {
      await API.post(`/servers/${id}/${type}`);
      await loadServer();
    } catch (e: any) {
      setError(e.response?.data?.error || `Aktion fehlgeschlagen.`);
    } finally { setActionLoading(false); }
  };

  const handleInstall = async () => {
    setError('');
    try {
      await serversApi.install(server!.id);
      setInstallStatus('installing');
      setActiveTab('console'); // Direkt zur Konsole wechseln
    } catch (e: any) {
      setError(e.response?.data?.error || 'Installation fehlgeschlagen.');
    }
  };

  const handleUpdate = async () => {
    setError('');
    try {
      await serversApi.update_files(server!.id);
      setInstallStatus('installing');
      setActiveTab('console');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Update fehlgeschlagen.');
    }
  };

  if (!server) return (
    <Layout title="Server laden…">
      <div className="flex items-center justify-center h-48">
        <p className="text-[#80848e]">Lädt…</p>
      </div>
    </Layout>
  );

  const whitelistSupported = game?.features?.whitelist?.supported ?? false;
  const banlistSupported = game?.features?.banlist?.supported ?? false;

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'overview',  label: '📊 Übersicht',    show: true },
    { id: 'console',   label: '💻 Konsole',       show: true },
    { id: 'settings',  label: '⚙️ Einstellungen', show: true },
    { id: 'backups',   label: '💾 Backups',        show: true },
    { id: 'tasks',     label: '⏱️ Aufgaben',       show: true },
    { id: 'whitelist', label: '✅ Whitelist',      show: whitelistSupported },
    { id: 'banlist',   label: '🚫 Banliste',       show: banlistSupported },
  ];

  return (
    <Layout title={server.name}>
      {/* Header */}
      <div className="bg-[#2b2d31] rounded-xl p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-4xl">{game?.emoji ?? '🖥️'}</span>
            <div>
              <h2 className="text-white font-bold text-xl">{server.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={server.status} />
                <span className="text-[#80848e] text-xs">Port {server.port}</span>
                {stats && server.status === 'running' && (
                  <>
                    <span className="text-[#3f4147]">•</span>
                    <span className="text-xs text-[#b5bac1]">
                      🖥 CPU <span className="text-white font-semibold">{stats.cpu}%</span>
                    </span>
                    <span className="text-[#3f4147]">•</span>
                    <span className="text-xs text-[#b5bac1]">
                      💾 RAM <span className="text-white font-semibold">{stats.ram} MB</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Aktions-Buttons */}
          <div className="flex gap-2 flex-wrap">
            {error && <p className="text-red-400 text-xs self-center">{error}</p>}
            <ActionBtn label="▶ Starten" onClick={() => action('start')}
              disabled={actionLoading || installStatus !== 'installed' || server.status === 'running' || server.status === 'starting'}
              color="bg-green-600 hover:bg-green-500 text-white" />
            <ActionBtn label="⏹ Stoppen" onClick={() => action('stop')}
              disabled={actionLoading || server.status === 'stopped' || server.status === 'stopping'}
              color="bg-red-600 hover:bg-red-500 text-white" />
            <ActionBtn label="↺ Neu starten" onClick={() => action('restart')}
              disabled={actionLoading || server.status !== 'running'}
              color="bg-[#3f4147] hover:bg-[#4e5058] text-white" />
            {installStatus === 'installed' && server.status === 'stopped' && (
              <ActionBtn label="⬆ Aktualisieren" onClick={handleUpdate}
                disabled={actionLoading}
                color="bg-[#3f4147] hover:bg-[#4e5058] text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#2b2d31] rounded-xl p-1">
        {tabs.filter((t) => t.show).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-[#404249] text-white' : 'text-[#b5bac1] hover:text-white'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab-Inhalt */}
      {activeTab === 'overview'  && <OverviewTab server={server} game={game} stats={stats}
        installStatus={installStatus} onInstall={handleInstall} onUpdate={handleUpdate}
        onTabSwitch={(tab) => setActiveTab(tab as Tab)} />}
      {activeTab === 'console'   && <ConsoleTab serverId={server.id} status={server.status} onStatusChange={handleStatusChange} />}
      {activeTab === 'settings'  && <SettingsTab server={server} game={game} onSaved={loadServer} />}
      {activeTab === 'backups'   && <BackupTab serverId={server.id} serverStatus={server.status} />}
      {activeTab === 'tasks'     && <TasksTab serverId={server.id} />}
      {activeTab === 'whitelist' && (
        <PlayerListTab serverId={server.id} type="whitelist"
          supported={whitelistSupported} note={game?.features?.whitelist?.note} />
      )}
      {activeTab === 'banlist' && (
        <PlayerListTab serverId={server.id} type="banlist"
          supported={banlistSupported} note={game?.features?.banlist?.note} />
      )}
    </Layout>
  );
}
