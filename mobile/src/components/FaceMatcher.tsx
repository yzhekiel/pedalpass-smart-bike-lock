/**
 * On-phone face match (selfie vs school ID photo).
 *
 * Expo Go can't run face AI natively, so this runs Human (@vladmandic/human — the same free,
 * open-source library as the web portal's Identity Approvals page) inside a hidden WebView.
 * The photos stay on the phone; only the AI models (~9 MB, cached) are downloaded from jsDelivr.
 *
 * This is a pre-check so students fix bad photos before submitting — staff still review
 * every account in the web portal, because a check on the phone alone could be tampered with.
 */
import React, { useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

/** Same scale as web/src/lib/identityCheck.ts: 46% or higher is green and may go on to step 2. */
export const STRONG_MATCH = 0.46;
export const POSSIBLE_MATCH = 0.4;

const HUMAN = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6';

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">
import { Human } from '${HUMAN}/dist/human.esm.js';
const send = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
const human = new Human({
  modelBasePath: '${HUMAN}/models/',
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 3, minConfidence: 0.3 },
    mesh: { enabled: true },
    description: { enabled: true },
    iris: { enabled: false }, attention: { enabled: false }, emotion: { enabled: false },
    antispoof: { enabled: false }, liveness: { enabled: false },
  },
  body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
  gesture: { enabled: false }, filter: { enabled: false },
});
human.load().then(() => send({ type: 'ready' })).catch((e) => send({ type: 'failed', message: String(e) }));

const loadImage = (b64) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Could not read the photo'));
  img.src = 'data:image/jpeg;base64,' + b64;
});

// Face "fingerprint" of the biggest face in the photo
async function embed(b64) {
  const result = await human.detect(await loadImage(b64));
  const faces = result.face.filter((f) => f.embedding && f.embedding.length);
  if (!faces.length) return null;
  faces.sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
  return faces[0].embedding;
}

async function onMessage(event) {
  let m;
  try { m = JSON.parse(event.data); } catch (e) { return; }
  if (m.type !== 'compare') return;
  try {
    const idFace = await embed(m.id);
    const selfieFace = await embed(m.selfie);
    send({ type: 'result', requestId: m.requestId, idFace: !!idFace, selfieFace: !!selfieFace,
      similarity: idFace && selfieFace ? human.match.similarity(idFace, selfieFace) : null });
  } catch (e) {
    send({ type: 'result', requestId: m.requestId, error: String((e && e.message) || e) });
  }
}
window.addEventListener('message', onMessage);
document.addEventListener('message', onMessage);
</script></body></html>`;

export type FaceMatch = {
  /** 0–1, null when no face was found in one of the photos */
  similarity: number | null;
  idFace: boolean;
  selfieFace: boolean;
};

type Pending = { resolve: (r: FaceMatch) => void; reject: (e: Error) => void };

/** Renders the hidden matcher (put `element` anywhere on the screen) and returns `compare`. */
export function useFaceMatcher() {
  // WebView<object>: the package's default type parameter (undefined) makes every prop invalid
  const web = useRef<WebView<object>>(null);
  const ready = useRef(false);
  const queue = useRef<string[]>([]);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);

  const failAll = (message: string) => {
    pending.current.forEach((p) => p.reject(new Error(message)));
    pending.current.clear();
    queue.current = [];
  };

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let m: { type: string; requestId?: number; error?: string; message?: string } & Partial<FaceMatch>;
    try {
      m = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') {
      ready.current = true;
      queue.current.forEach((msg) => web.current?.postMessage(msg));
      queue.current = [];
    } else if (m.type === 'failed') {
      failAll('Could not load the face check. Check your internet connection and try again.');
    } else if (m.type === 'result' && m.requestId) {
      const p = pending.current.get(m.requestId);
      pending.current.delete(m.requestId);
      if (!p) return;
      if (m.error) p.reject(new Error(m.error));
      else p.resolve({ similarity: m.similarity ?? null, idFace: !!m.idFace, selfieFace: !!m.selfieFace });
    }
  }, []);

  const compare = useCallback(
    (idBase64: string, selfieBase64: string) =>
      new Promise<FaceMatch>((resolve, reject) => {
        const requestId = nextId.current++;
        pending.current.set(requestId, { resolve, reject });
        const msg = JSON.stringify({ type: 'compare', requestId, id: idBase64, selfie: selfieBase64 });
        if (ready.current) web.current?.postMessage(msg);
        else queue.current.push(msg);
        // First run downloads the models, so allow a generous wait
        setTimeout(() => {
          if (pending.current.delete(requestId)) reject(new Error('The face check took too long. Try again.'));
        }, 90_000);
      }),
    [],
  );

  const element = (
    <WebView<object>
      ref={web}
      source={{ html: HTML, baseUrl: 'https://localhost' }}
      originWhitelist={['*']}
      onMessage={onMessage}
      style={styles.hidden}
    />
  );

  return { element, compare };
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
