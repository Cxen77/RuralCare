import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncQueueItem, SyncAction } from '../types/schema';

const QUEUE_STORAGE_KEY = 'ruralcare.offline.sync_queue';
const CACHE_STORAGE_KEY_PREFIX = 'ruralcare.cache.';

let syncQueue: SyncQueueItem[] = [];
let isOnline = true;
let isLoaded = false;

async function persistQueue() {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(syncQueue));
  } catch (e) {
    console.error('[StorageService] failed to persist sync queue:', e);
  }
}

async function loadQueue() {
  if (isLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      syncQueue = JSON.parse(raw);
    }
    isLoaded = true;
  } catch {
    isLoaded = true;
  }
}

// Preload queue on import
loadQueue();

export const StorageService = {
  // ─── Connectivity ───────────────────────────────────────────────────────
  getOnlineStatus: () => isOnline,
  setOnlineStatus: (online: boolean) => {
    isOnline = online;
  },

  // ─── Sync Queue ─────────────────────────────────────────────────────────
  addToSyncQueue: (action: SyncAction, payload: Record<string, unknown>): SyncQueueItem => {
    const item: SyncQueueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };
    syncQueue.push(item);
    persistQueue();
    return item;
  },

  getSyncQueue: (): SyncQueueItem[] => [...syncQueue],

  getPendingCount: (): number => syncQueue.filter(i => i.status === 'pending').length,

  flushSyncQueue: async (): Promise<{ flushed: number; failed: number }> => {
    await loadQueue();
    const pending = syncQueue.filter(i => i.status === 'pending');
    if (pending.length === 0) return { flushed: 0, failed: 0 };

    const { apiClient } = require('./apiClient');

    try {
      const response = await apiClient.syncBatch(pending);
      const results = response?.results || [];

      let flushed = 0;
      let failed = 0;

      for (const res of results) {
        const item = syncQueue.find(i => i.id === res.id);
        if (item) {
          if (res.status === 'synced') {
            item.status = 'synced';
            flushed += 1;
          } else {
            item.retryCount += 1;
            if (item.retryCount > 3) item.status = 'failed';
            failed += 1;
          }
        }
      }

      // Remove synced items from memory and storage
      syncQueue = syncQueue.filter(i => i.status !== 'synced');
      await persistQueue();

      return { flushed, failed };
    } catch {
      return { flushed: 0, failed: pending.length };
    }
  },

  clearSyncQueue: async () => {
    syncQueue = [];
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  },

  // ─── Local Caching for Directory & Offline View ────────────────────────
  cacheData: async (key: string, data: unknown) => {
    try {
      await AsyncStorage.setItem(
        `${CACHE_STORAGE_KEY_PREFIX}${key}`,
        JSON.stringify({ data, cachedAt: new Date().toISOString() })
      );
    } catch {}
  },

  getCachedData: async <T>(key: string): Promise<{ data: T; cachedAt: string } | null> => {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_STORAGE_KEY_PREFIX}${key}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getLastSyncTimestamp: (): string => {
    return new Date().toISOString();
  },
};

