/**
 * RuralCare API client (doctor app).
 *
 * Owns the auth token, prefixes every call with /api, and unwraps the server's
 * { success, data } envelope so callers work with plain records.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function resolveInitialApiBase(): string {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('apiUrl');
    if (fromQuery) return fromQuery.replace(/\/+$/, '');
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return `http://${hostname}:4000`;
    }
  }
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
  return 'http://localhost:4000';
}

const isNative = Platform.OS !== 'web';

const localHostCandidates = typeof window !== 'undefined' && window.location?.hostname
  ? [
      `http://${window.location.hostname}:4000`,
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ]
  : ['http://localhost:4000', 'http://127.0.0.1:4000'];

const CANDIDATE_HOSTS = isNative
  ? [
      resolveInitialApiBase(),
      'http://10.0.2.2:4000',
      'https://ruralcare-sia2.onrender.com',
    ].filter(Boolean) as string[]
  : [
      resolveInitialApiBase(),
      ...localHostCandidates,
      'https://ruralcare-sia2.onrender.com',
    ].filter((val, idx, arr) => arr.indexOf(val) === idx && Boolean(val)) as string[];

let activeApiBase = resolveInitialApiBase();

export const API_BASE = activeApiBase;

const TOKEN_KEY = 'ruralcare.doctor.token';
const USER_KEY = 'ruralcare.doctor.user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  doctorId?: string;
  patientId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isOffline(): boolean {
    return this.code === 'NETWORK_UNREACHABLE';
  }
}

let token: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const onSessionExpired = (handler: (() => void) | null) => {
  sessionExpiredHandler = handler;
};

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  { auth = true }: { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const hostsToTry = [
    activeApiBase,
    ...CANDIDATE_HOSTS.filter(h => h.replace(/\/+$/, '') !== activeApiBase)
  ];

  let lastError: Error | null = null;

  for (const host of hostsToTry) {
    const cleanHost = host.replace(/\/+$/, '');
    const url = `${cleanHost}/api${path}`;
    const controller = new AbortController();
    const timeoutMs =
      cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1') || cleanHost.includes('192.168.')
        ? 2000
        : 3500;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      activeApiBase = cleanHost;

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const code = payload?.error?.code || 'REQUEST_FAILED';
        const message = payload?.error?.message || 'Something went wrong. Please try again.';
        if (response.status === 401) {
          await clearSession();
          sessionExpiredHandler?.();
        }
        throw new ApiError(response.status, code, message);
      }

      return payload?.data as T;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;
      if (err instanceof ApiError) {
        throw err;
      }
    }
  }

  throw new ApiError(0, 'NETWORK_UNREACHABLE', lastError?.message || 'Cannot reach RuralCare right now.');
}

async function clearSession() {
  token = null;
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T,>(path: string) => request<T>('DELETE', path),

  // Appointment Chat Messages
  getAppointmentMessages: (appointmentId: string) =>
    request<any[]>('GET', `/appointments/${appointmentId}/messages`),
  sendAppointmentMessage: (appointmentId: string, text: string) =>
    request<any>('POST', `/appointments/${appointmentId}/messages`, { text }),

  // Teleconsultation Video Access
  getVideoAccess: (appointmentId: string) =>
    request<any>('GET', `/appointments/${appointmentId}/video/access`),
};

export const session = {
  async restore(): Promise<AuthUser | null> {
    const [storedToken, storedUser] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    if (!storedToken || !storedUser) return null;
    token = storedToken;
    try {
      return JSON.parse(storedUser) as AuthUser;
    } catch {
      await clearSession();
      return null;
    }
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const data = await request<{ token: string; user: AuthUser }>(
      'POST',
      '/auth/login',
      { email, password },
      { auth: false }
    );
    token = data.token;
    await AsyncStorage.multiSet([
      [TOKEN_KEY, data.token],
      [USER_KEY, JSON.stringify(data.user)],
    ]);
    return data.user;
  },

  logout: () => clearSession(),

  me: () => request<AuthUser>('GET', '/auth/me'),

  getToken: () => token,
};

/**
 * Polls an endpoint on an interval. `offline` distinguishes "the server said no"
 * from "the server is unreachable" so screens can label stale data honestly.
 */
export function usePoll<T>(fetcher: () => Promise<T>, ms = 4000) {
  const [data, setData] = useState<T | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    const run = () => {
      fetcherRef
        .current()
        .then(d => {
          if (!alive) return;
          setData(d);
          setOffline(false);
          setLastSyncedAt(new Date().toISOString());
        })
        .catch(e => {
          if (!alive) return;
          if (e instanceof ApiError && e.isOffline) setOffline(true);
        });
    };
    run();
    const timer = setInterval(run, ms);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [ms]);

  return { data, offline, lastSyncedAt };
}
