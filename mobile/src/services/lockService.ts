/**
 * Smart lock service — SIMULATED for now.
 *
 * Expo Go cannot use Bluetooth, so these functions fake the ESP32 smart lock.
 * When the hardware is ready:
 *   1. npx expo install expo-dev-client react-native-ble-plx
 *   2. Build a development build: npx expo run:android  (or eas build --profile development)
 *   3. Replace the bodies below with real BLE calls (connect to bike.nodeId,
 *      write the one-time unlock token to the lock's characteristic, read the lock state).
 * The screens only call these functions, so nothing else has to change.
 */
import { BicycleItem } from '../types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type UnlockResult = { ok: true; latencyMs: number } | { ok: false; reason: string };

/** Parse the text inside a bike QR code. Accepts "BP-001", "PEDALPASS:BP-001" or {"bikeId":"BP-001"}. */
export function parseBikeQr(data: string): string | null {
  const raw = data.trim();
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.bikeId === 'string') return obj.bikeId.toUpperCase();
  } catch {
    // not JSON
  }
  const match = raw.toUpperCase().match(/BP-\d{3}/);
  return match ? match[0] : null;
}

/** Ask the backend for a short-lived unlock token. TODO: call a Supabase Edge Function here. */
export async function requestUnlockToken(bike: BicycleItem): Promise<string> {
  await wait(400);
  return `TOKEN-${bike.id}-${Date.now()}`;
}

/** Send the token to the lock over BLE. TODO: replace with react-native-ble-plx. */
export async function unlockBike(bike: BicycleItem, _token: string): Promise<UnlockResult> {
  await wait(1200);
  if (bike.status !== 'available') return { ok: false, reason: `${bike.id} is not available right now.` };
  return { ok: true, latencyMs: 48 };
}

/** Ask the lock if it is closed (lock sensor). TODO: read the lock-state characteristic over BLE. */
export async function confirmLocked(_bike: BicycleItem): Promise<boolean> {
  await wait(1500);
  return true;
}
