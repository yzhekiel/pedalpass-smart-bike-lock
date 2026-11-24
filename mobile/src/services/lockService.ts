/**
 * Smart lock service — Connected to ESP32 Smart Bike Lock (with automatic simulated fallback).
 *
 * How it reaches your physical ESP32 Smart Bike Lock from Expo Go:
 *   1. Tries direct ESP32 SoftAP (`http://192.168.4.1/api/...`) if the phone is on `Bike01_Lock` Wi-Fi.
 *   2. Tries the Laptop ESP32 Wi-Fi Bridge (`http://<expo-packger-host>:3001/api/...`), which forwards
 *      commands over the laptop's secondary Wi-Fi adapter (`Wi-Fi 2`) directly to `http://192.168.4.1`
 *      so your phone never loses its internet connection to Supabase!
 *   3. If the ESP32 is powered off (e.g. while charging the battery), gracefully falls back to
 *      simulation so the PedalPass app can still be tested end-to-end.
 */
import { NativeModules } from 'react-native';
import { BicycleItem } from '../types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type UnlockResult =
  | { ok: true; latencyMs: number; hardware?: boolean }
  | { ok: false; reason: string };

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

/** Discover the laptop's LAN IP from the Expo Metro bundler scriptURL (e.g. http://192.168.1.10:8081/...). */
function getBridgeCandidates(): string[] {
  const urls: string[] = [];
  const envUrl = process.env.EXPO_PUBLIC_LOCK_BRIDGE_URL;
  if (envUrl) urls.push(envUrl.replace(/\/$/, ''));

  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^/:]+)/i);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      urls.push(`http://${match[1]}:3001`);
    }
  }
  urls.push('http://192.168.4.1');
  urls.push('http://localhost:3001');
  return Array.from(new Set(urls));
}

async function callLockEndpoint(pathAndQuery: string, timeoutMs = 3200): Promise<any | null> {
  const candidates = getBridgeCandidates();
  for (const base of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${pathAndQuery}`, {
        method: pathAndQuery.startsWith('/api/status') ? 'GET' : 'POST',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}

let activeTokenCache = 'PEDALPASS-RIDE';

/**
 * Send the unlock token (from rideService.requestUnlockToken) to the ESP32 lock.
 * Triggers: SG90 Pin retract (0 deg) -> MG996R C-Latch open (180 deg) -> SG90 Pin open-lock (90 deg) + GREEN LED (GPIO 23) + Buzzer.
 */
export async function unlockBike(bike: BicycleItem, token: string): Promise<UnlockResult> {
  const started = Date.now();
  activeTokenCache = token || 'PEDALPASS-RIDE';
  const encodedToken = encodeURIComponent(activeTokenCache);
  const encodedBike = encodeURIComponent(bike.id);

  const data = await callLockEndpoint(`/api/unlock?token=${encodedToken}&student_id=${encodedBike}`);
  if (data) {
    if (data.ok === false) {
      return { ok: false, reason: data.error || data.message || 'Smart lock rejected unlock command.' };
    }
    return {
      ok: true,
      latencyMs: data.latencyMs ?? Math.max(15, Date.now() - started),
      hardware: Boolean(data.hardware ?? !data.simulated),
    };
  }

  await wait(800);
  return { ok: true, latencyMs: 48, hardware: false };
}

/**
 * Mid-Ride Temporary Lock ("Park Outside Classroom"):
 * Closes MG996R C-Latch (0 deg) + engages SG90 Pin (90 deg) + turns ON YELLOW PARK LED (GPIO 22)
 * while keeping the rider's active session bound in PedalPass.
 */
export async function tempLockBike(bike: BicycleItem): Promise<{ ok: boolean; message: string }> {
  const encodedToken = encodeURIComponent(activeTokenCache);
  const data = await callLockEndpoint(`/api/templock?token=${encodedToken}&bike_id=${encodeURIComponent(bike.id)}`);
  if (data && data.ok === false) {
    return { ok: false, message: data.error || data.message || 'Could not engage temporary park lock.' };
  }
  return {
    ok: true,
    message: data?.message || 'YELLOW LED ON: Bike temporarily locked (On Park). Your ride session remains reserved to you.',
  };
}

/**
 * Resume Ride from Mid-Ride Temporary Lock ("On Park"):
 * Opens MG996R C-Latch (180 deg) + turns ON GREEN RIDE LED (GPIO 23) + turns OFF YELLOW LED (GPIO 22).
 */
export async function resumeRideBike(bike: BicycleItem): Promise<{ ok: boolean; message: string }> {
  const encodedToken = encodeURIComponent(activeTokenCache);
  const data = await callLockEndpoint(`/api/unlock?token=${encodedToken}&student_id=${encodeURIComponent(bike.id)}`);
  if (data && data.ok === false) {
    return { ok: false, message: data.error || data.message || 'Could not unlock bike to resume ride.' };
  }
  return {
    ok: true,
    message: data?.message || 'GREEN LED ON: Smart lock opened. Resume riding!',
  };
}

/**
 * End Ride & Lock Bicycle:
 * Commands the ESP32 to close the MG996R C-Latch (0 deg), engage the SG90 Pin (90 deg),
 * turn ON the RED LOCKED LED (GPIO 21), and confirm the lock is closed.
 */
export async function confirmLocked(bike: BicycleItem): Promise<boolean> {
  const encodedToken = encodeURIComponent(activeTokenCache);
  const data = await callLockEndpoint(`/api/return?token=${encodedToken}&bike_id=${encodeURIComponent(bike.id)}`);
  if (data) {
    return data.ok !== false && data.lock_confirmed !== false;
  }
  await wait(900);
  return true;
}
