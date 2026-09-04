/**
 * Authentication state for the patient app.
 *
 * Wraps the API client's session so the UI can render a login gate, expose the
 * signed-in user's identity to data fetching, and react to expired tokens.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ApiError, onSessionExpired, session, type AuthUser } from '../services/apiClient';

interface AuthState {
  user: AuthUser | null;
  /** Backend patient record for the signed-in user, loaded after login. */
  patientId: string | null;
  restoring: boolean;
  signingIn: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await session.restore();
      if (cancelled) return;
      if (!stored) {
        setRestoring(false);
        return;
      }
      // A stored token can be expired or revoked; /auth/me is the cheapest check.
      // A network failure must not sign the user out — offline use is expected.
      try {
        const fresh = await session.me();
        if (!cancelled) setUser(fresh);
      } catch {
        if (!cancelled) setUser(stored);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setError('Your session expired. Please sign in again.');
    });
    return () => onSessionExpired(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setSigningIn(true);
    setError(null);
    try {
      setUser(await session.login(email.trim(), password));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign in failed. Please try again.');
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await session.logout();
    setUser(null);
    setError(null);
  }, []);

  const value: AuthState = {
    user,
    patientId: user?.patientId ?? null,
    restoring,
    signingIn,
    error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
