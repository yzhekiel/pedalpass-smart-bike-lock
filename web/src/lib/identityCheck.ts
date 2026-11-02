/**
 * AI-assisted identity check — runs entirely in the staff member's browser (free, open source):
 *   • Human (@vladmandic/human) compares the face on the school ID with the selfie
 *   • Tesseract.js reads the text on the school ID and COR to find the student number
 * Photos never leave PedalPass's own system (Supabase storage → this browser).
 * The result only helps staff decide; a person still clicks Approve or Reject.
 */
import { Human } from '@vladmandic/human';
import { createWorker, Worker } from 'tesseract.js';

export type CheckResult = {
  /** 0–1, null when a face couldn't be found in one of the photos */
  faceSimilarity: number | null;
  faceVerdict: 'strong' | 'possible' | 'no_match' | 'no_face';
  idNumberOnId: boolean;
  idNumberOnCor: boolean;
};

// Human's guidance: similarity above 0.5 can be considered the same person.
// ID photos are small and often old, so 0.5–0.6 is shown as "possible" for staff to look at closely.
const STRONG = 0.6;
const POSSIBLE = 0.5;

let human: Human | null = null;
let ocr: Promise<Worker> | null = null;

async function getHuman(): Promise<Human> {
  if (!human) {
    human = new Human({
      modelBasePath: '/models/', // web/public/models — served by the portal itself
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 3, minConfidence: 0.3 },
        mesh: { enabled: true },
        description: { enabled: true }, // the face "fingerprint" used for matching
        iris: { enabled: false },
        attention: { enabled: false },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      filter: { enabled: false },
    });
    await human.load();
  }
  return human;
}

const getOcr = () => (ocr ??= createWorker('eng'));

/** Face "fingerprint" of the biggest face in the photo (the person, not a background face). */
async function embedding(image: ImageBitmap): Promise<number[] | null> {
  const h = await getHuman();
  const result = await h.detect(image);
  const faces = result.face.filter((f) => f.embedding?.length);
  if (!faces.length) return null;
  const biggest = faces.reduce((a, b) => (a.box[2] * a.box[3] >= b.box[2] * b.box[3] ? a : b));
  return biggest.embedding ?? null;
}

/** Letters/digits only, fixing common OCR mix-ups (O→0, I/L→1, S→5, B→8). */
const normalize = (text: string) =>
  text
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

/** The student number on DYCI IDs is small print — enlarge, grey out and sharpen it for the text reader. */
async function enhanceForText(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(2, 3000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.6)';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not prepare photo'))), 'image/png'),
  );
}

async function textContains(image: Blob, studentId: string): Promise<boolean> {
  const wanted = normalize(studentId);
  if (wanted.length < 4) return false;
  const worker = await getOcr();
  // Try the cleaned-up photo first, then the original
  for (const candidate of [await enhanceForText(image), image]) {
    const { data } = await worker.recognize(candidate);
    if (normalize(data.text).includes(wanted)) return true;
  }
  return false;
}

async function fetchBlob(url: string): Promise<Blob> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`photo download failed (${resp.status})`);
  return resp.blob();
}

export async function checkIdentity(
  urls: { id: string; selfie: string; cor?: string },
  studentId: string | null,
): Promise<CheckResult> {
  const [idBlob, selfieBlob, corBlob] = await Promise.all([
    fetchBlob(urls.id),
    fetchBlob(urls.selfie),
    urls.cor ? fetchBlob(urls.cor) : Promise.resolve(null),
  ]);

  const h = await getHuman();
  const [idFace, selfieFace] = [
    await embedding(await createImageBitmap(idBlob)),
    await embedding(await createImageBitmap(selfieBlob)),
  ];
  const faceSimilarity = idFace && selfieFace ? h.match.similarity(idFace, selfieFace) : null;
  const faceVerdict =
    faceSimilarity === null
      ? 'no_face'
      : faceSimilarity >= STRONG
        ? 'strong'
        : faceSimilarity >= POSSIBLE
          ? 'possible'
          : 'no_match';

  const idNumberOnId = studentId ? await textContains(idBlob, studentId) : false;
  const idNumberOnCor = studentId && corBlob ? await textContains(corBlob, studentId) : false;

  return { faceSimilarity, faceVerdict, idNumberOnId, idNumberOnCor };
}
