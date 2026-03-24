import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { gamesApi, serversApi } from '../api/servers';
import type { GameDefinition } from '../api/servers';
import { useServers } from '../context/ServerContext';

export default function CreateServerPage() {
  const navigate = useNavigate();
  const { refresh } = useServers();
  const [step, setStep] = useState<1 | 2>(1);
  const [games, setGames] = useState<GameDefinition[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameDefinition | null>(null);
  const [serverName, setServerName] = useState('');
  const [port, setPort] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    gamesApi.getAll().then((res) => setGames(res.data));
  }, []);

  const selectGame = (game: GameDefinition) => {
    setSelectedGame(game);
    setPort(String(game.defaultPort));
    setConfig(game.defaultConfig);
    setServerName(`Mein ${game.name} Server`);
    setStep(2);
  };

  const handleCreate = async () => {
    setError('');
    if (!serverName.trim()) { setError('Bitte einen Servernamen eingeben.'); return; }
    if (!port || isNaN(Number(port))) { setError('Bitte einen gültigen Port eingeben.'); return; }

    setIsLoading(true);
    try {
      const res = await serversApi.create({
        name: serverName,
        gameType: selectedGame!.id,
        port: Number(port),
        config,
      });
      await refresh(); // Sidebar + Dashboard sofort aktualisieren
      navigate(`/servers/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Server konnte nicht erstellt werden.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Neuen Server erstellen">
      {/* Fortschrittsanzeige */}
      <div className="flex items-center gap-3 mb-8">
        {[{ n: 1, label: 'Spiel wählen' }, { n: 2, label: 'Konfigurieren' }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
              ${step >= n ? 'bg-indigo-600 text-white' : 'bg-[#3f4147] text-[#80848e]'}`}>
              {n}
            </div>
            <span className={`text-sm ${step >= n ? 'text-white' : 'text-[#80848e]'}`}>{label}</span>
            {n < 2 && <div className={`w-12 h-0.5 ${step > n ? 'bg-indigo-600' : 'bg-[#3f4147]'}`} />}
          </div>
        ))}
      </div>

      {/* Schritt 1: Spiel auswählen */}
      {step === 1 && (
        <div>
          <h2 className="text-white font-semibold text-lg mb-1">Wähle ein Spiel</h2>
          <p className="text-[#b5bac1] text-sm mb-5">Für welches Spiel möchtest du einen Server erstellen?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => selectGame(game)}
                className="bg-[#2b2d31] hover:bg-[#35373c] border border-[#3f4147] hover:border-indigo-500 rounded-xl p-5 text-left transition-all group"
              >
                <div className="text-4xl mb-3">{game.emoji}</div>
                <h3 className="text-white font-semibold text-base mb-1 group-hover:text-indigo-400 transition-colors">
                  {game.name}
                </h3>
                <p className="text-[#80848e] text-xs">{game.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Schritt 2: Konfigurieren */}
      {step === 2 && selectedGame && (
        <div className="max-w-xl">
          <button onClick={() => setStep(1)} className="text-[#b5bac1] hover:text-white text-sm mb-5 flex items-center gap-1 transition-colors">
            ← Zurück zur Spielauswahl
          </button>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{selectedGame.emoji}</span>
            <div>
              <h2 className="text-white font-semibold text-lg">{selectedGame.name} Server</h2>
              <p className="text-[#80848e] text-sm">{selectedGame.description}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="bg-[#2b2d31] rounded-xl p-6 space-y-4">
            {/* Servername */}
            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                Servername
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Port */}
            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Spielspezifische Felder */}
            {selectedGame.configFields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={config[field.key] ?? field.default}
                    onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                    className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {field.options!.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={config[field.key] ?? field.default}
                    onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                    className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition-colors"
          >
            {isLoading ? 'Erstelle Server...' : `${selectedGame.emoji} ${selectedGame.name} Server erstellen`}
          </button>
        </div>
      )}
    </Layout>
  );
}
