import { useEffect, useState } from 'react';
import { ApiError, API_BASE, onSessionExpired, session } from './api.js';

function LoginScreen({ onSignedIn, initialError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      onSignedIn(await session.login(email.trim(), password));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="material-symbols-outlined">local_pharmacy</span>
          <div>
            <h1 className="login-title">RuralCare Pharmacy</h1>
            <p className="login-subtitle">Sign in to manage inventory and dispense prescriptions</p>
          </div>
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="login-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pharmacist@ruralcare.dev"
          />
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="login-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        {error ? <p className="login-error" role="alert">{error}</p> : null}

        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-endpoint">Connected to {API_BASE}</p>
      </form>
    </div>
  );
}

export function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [expiredMessage, setExpiredMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const stored = session.restore();
    if (!stored) {
      setRestoring(false);
      return () => { cancelled = true; };
    }
    // A stored token can be expired; /auth/me is the cheapest check. A network
    // failure must not sign the pharmacist out mid-shift.
    session
      .me()
      .then((fresh) => { if (!cancelled) setUser(fresh); })
      .catch((e) => { if (!cancelled && e instanceof ApiError && e.isOffline) setUser(stored); })
      .finally(() => { if (!cancelled) setRestoring(false); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setExpiredMessage('Your session expired. Please sign in again.');
    });
    return () => onSessionExpired(null);
  }, []);

  if (restoring) return <div className="login-shell"><p className="login-subtitle">Loading RuralCare…</p></div>;
  if (!user) {
    return (
      <LoginScreen
        initialError={expiredMessage}
        onSignedIn={(u) => { setExpiredMessage(''); setUser(u); }}
      />
    );
  }
  return children({ user, logout: () => { session.logout(); setUser(null); } });
}
