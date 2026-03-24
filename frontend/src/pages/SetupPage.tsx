import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

interface Props {
  onComplete?: () => void;
}

export default function SetupPage({ onComplete }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.setup(username, password);
      login(res.data.token, res.data.user);
      onComplete?.();
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Setup fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1e1f24] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎮</div>
          <h1 className="text-2xl font-bold text-white">GameStack</h1>
          <p className="text-[#b5bac1] text-sm mt-1">Ersteinrichtung</p>
        </div>

        {/* Setup-Card */}
        <div className="bg-[#2b2d31] rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Admin-Account erstellen</h2>
          <p className="text-[#b5bac1] text-sm mb-6">
            Willkommen! Erstelle deinen Administrator-Account um zu starten.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="admin"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Mindestens 8 Zeichen"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase tracking-wide mb-1.5">
                Passwort bestätigen
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full bg-[#1e1f24] text-white rounded-lg px-3 py-2.5 text-sm border border-[#3f4147] focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
            >
              {isLoading ? 'Erstelle Account...' : 'Account erstellen & starten'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
