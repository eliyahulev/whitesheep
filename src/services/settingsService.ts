import { getDoc, setDoc } from 'firebase/firestore';
import { settingsDocRef } from '@/firebase/collections';
import type { Settings } from '@/types/models';
import { DEFAULT_SETTINGS } from './defaults';

// Settings service — the single source of config for all modules.
// Reads from the `settings/global` doc; falls back to defaults and self-heals if missing.

let cache: Settings | null = null;

export async function loadSettings(force = false): Promise<Settings> {
  if (cache && !force) return cache;
  const snap = await getDoc(settingsDocRef);
  if (snap.exists()) {
    cache = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings>) } as Settings;
  } else {
    // Ensure the doc exists so later modules can rely on it.
    await setDoc(settingsDocRef, DEFAULT_SETTINGS);
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  await setDoc(settingsDocRef, patch, { merge: true });
  cache = { ...(cache ?? DEFAULT_SETTINGS), ...patch } as Settings;
  return cache;
}

export function clearSettingsCache() {
  cache = null;
}
