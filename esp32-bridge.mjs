/**
 * PedalPass <-> ESP32 Smart Bike Lock Wi-Fi Bridge (Port 3001)
 *
 * Why this exists:
 * - Your phone runs the PedalPass Mobile App in Expo Go on your regular Wi-Fi (so it has internet for Supabase).
 * - Your laptop's secondary Wi-Fi adapter (Wi-Fi 2) connects directly to the ESP32's "Bike01_Lock" AP (192.168.4.1).
 * - When the phone taps Unlock, Temporary Lock (Park), Resume, or End Ride in Expo Go, lockService.ts
 *   calls this bridge at http://<laptop-lan-ip>:3001/api/*, which forwards the command straight to
 *   http://192.168.4.1/api/* on your physical ESP32 PCB!
 * - If the ESP32 is powered off (e.g., while charging the 3S battery), it returns { simulated: true, ok: true }
 *   so you can still test the full PedalPass app flow without errors.
 */
import http from 'node:http';

const PORT = 3001;
const ESP32_BASE = process.env.ESP32_URL || 'http://192.168.4.1';

async function forwardToEsp32(pathAndQuery, method = 'POST') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${ESP32_BASE}${pathAndQuery}`, {
      method,
      signal: controller.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { reachable: true, status: res.status, data: json };
  } catch (err) {
    return { reachable: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const started = Date.now();

  if (url.pathname.startsWith('/api/')) {
    const method = url.pathname === '/api/status' ? 'GET' : 'POST';
    const result = await forwardToEsp32(url.pathname + url.search, method);
    const latencyMs = Date.now() - started;

    if (result.reachable) {
      console.log(`[ESP32 LIVE] ${method} ${url.pathname}${url.search} -> ${result.status} (${latencyMs}ms)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...result.data, ok: result.data?.ok ?? true, hardware: true, latencyMs }));
    } else {
      console.log(`[ESP32 OFFLINE/SIM] ${method} ${url.pathname}${url.search} -> Simulated fallback`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          hardware: false,
          simulated: true,
          latencyMs: 45,
          state:
            url.pathname === '/api/unlock'
              ? 'IN_USE_RIDING'
              : url.pathname === '/api/templock'
                ? 'IN_USE_TEMP_LOCKED'
                : 'AVAILABLE',
          physically_locked: url.pathname !== '/api/unlock',
          message: 'ESP32 offline (charging/disconnected) — simulated lock response.',
        })
      );
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: 'PedalPass ESP32 Wi-Fi Bridge', esp32Target: ESP32_BASE, port: PORT }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PedalPass ESP32 Hardware Bridge listening on http://0.0.0.0:${PORT} -> ${ESP32_BASE}`);
});
