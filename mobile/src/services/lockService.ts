/**
 * Smart lock service — SIMULATED for now.
 *
 * Expo Go cannot use Bluetooth, so these functions fake the ESP32 smart lock.
 * When the hardware is ready:
 *   1. npx expo install expo-dev-client react-native-ble-plx
 *   2. Build a development build: npx expo run:android  (or eas build --profile development)
 *   3. Replace the bodies below with real BLE calls (connect to bike.nodeId,
 *      write the signed unlock token to the lock's characteristic, read the lock state).
 *      Token format and key: supabase/migrations/003_unlock_tokens.sql.
 * The screens only call these functions, so nothing else has to change.
 */
import { BicycleItem } from '../types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type UnlockResult = { ok: true; latencyMs: number } | { ok: false; reason: string };

/** `code` is the secret part start_ride checks; null for old QR codes that only contain the bike ID. */
export type BikeQr = { bikeId: string; code: string | null };

/**
 * Parse the text inside a bike QR code: "PEDALPASS:BP-001:<code>", printed from the admin portal's
 * QR Codes page (supabase/migrations/010_automation_and_history.sql). Regenerating a bike's QR changes the code.
 */
export function parseBikeQr(data: string): BikeQr | null {
  const raw = data.trim();
  const full = raw.match(/^PEDALPASS:(BP-\d{3}):([0-9a-f]+)$/i);
  if (full) return { bikeId: full[1].toUpperCase(), code: full[2].toLowerCase() };
  const id = raw.toUpperCase().match(/BP-\d{3}/);
  return id ? { bikeId: id[0], code: null } : null;
}

/**
 * Send the unlock token (from rideService.requestUnlockToken) to the lock over BLE.
 * The lock checks the token's signature, so a fake token cannot open it.
 * TODO: replace with react-native-ble-plx.
 */
export async function unlockBike(_bike: BicycleItem, _token: string): Promise<UnlockResult> {
  await wait(1200);
  return { ok: true, latencyMs: 48 };
}

/** Ask the lock if it is closed (lock sensor). TODO: read the lock-state characteristic over BLE. */
export async function confirmLocked(_bike: BicycleItem): Promise<boolean> {
  await wait(1500);
  return true;
}
