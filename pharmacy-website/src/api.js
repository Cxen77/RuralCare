/**
 * RuralCare API client (pharmacy portal).
 *
 * Owns the auth token, prefixes every call with /api, and unwraps the server's
 * { success, data } envelope so callers work with plain records.
 */

import { useEffect, useRef, useState } from 'react';

// The portal is served by the API itself in production, so same-origin is the
// right default. Override with VITE_API_URL when running the Vite dev server.
export const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '');

const API_ROOT = `${API_BASE}/api`;
const TOKEN_KEY = 'ruralcare.pharmacy.token';
const USER_KEY = 'ruralcare.pharmacy.user';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isOffline() {
    return this.code === 'NETWORK_UNREACHABLE';
  }
}

let token = localStorage.getItem(TOKEN_KEY);
let sessionExpiredHandler = null;

export const onSessionExpired = (handler) => {
  sessionExpiredHandler = handler;
};

async function request(method, path, body, { auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_ROOT}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_UNREACHABLE', 'Cannot reach RuralCare right now.');
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const code = payload?.error?.code || 'REQUEST_FAILED';
    const message = payload?.error?.message || 'Something went wrong. Please try again.';
    if (res.status === 401) {
      clearSession();
      sessionExpiredHandler?.();
    }
    throw new ApiError(res.status, code, message);
  }

  return payload?.data;
}

function clearSession() {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};

export const session = {
  restore() {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (!storedToken || !storedUser) return null;
    token = storedToken;
    try {
      return JSON.parse(storedUser);
    } catch {
      clearSession();
      return null;
    }
  },

  async login(email, password) {
    const data = await request('POST', '/auth/login', { email, password }, { auth: false });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  },

  logout: () => clearSession(),

  me: () => request('GET', '/auth/me'),
};

/**
 * Polls an endpoint on an interval. `offline` distinguishes "the server said no"
 * from "the server is unreachable" so the UI can label stale data honestly.
 */
export function usePoll(fetcher, ms = 4000) {
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  useEffect(() => {
    let alive = true;
    const run = () => {
      ref.current()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setOffline(false);
          setLastSyncedAt(new Date().toISOString());
        })
        .catch((e) => {
          if (!alive) return;
          if (e instanceof ApiError && e.isOffline) setOffline(true);
        });
    };
    run();
    const t = setInterval(run, ms);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ms]);

  return { data, offline, lastSyncedAt };
}
