/**
 * Scan COR — reads a DYCI Certificate of Registration photo and pulls out the sign-up details.
 *
 * The mobile app sends { image: <base64 JPEG> }. This function reads the text with the free OCR.space
 * service, then finds the fields with fixed rules (no AI). The photo is never saved.
 *
 * Deploy (sign-up happens before login, so JWT checking is off). Free key: https://ocr.space/ocrapi
 *   supabase secrets set OCR_SPACE_API_KEY=your-key
 *   supabase functions deploy scan-cor --no-verify-jwt
 */

const MAX_BASE64_LENGTH = 1_400_000; // OCR.space's free plan accepts files up to 1 MB

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase());

/** Finds the sign-up fields in the OCR text. Same output shape the app expects. */
function parseCor(text: string) {
  const issues: string[] = [];
  const upper = text.toUpperCase();
  const is_cor = /REGISTRATION/.test(upper);
  const empty = {
    student_no: null, last_name: null, first_name: null, middle_name: null,
    year_level: null, section: null, course: null, enrolled: null,
  };
  if (!is_cor) {
    return { is_cor, ...empty, confidence: 'low', issues: ['This does not look like a DYCI COR.'] };
  }

  const no = upper.match(/\b(\d{4})\s*[-–—]\s*(\d{5})\b/);
  const student_no = no ? `${no[1]}-${no[2]}` : null;

  // "STUDENT NAME: LASTNAME, FIRSTNAME(S) MIDDLENAME" — on the label's line or the next one
  const name =
    upper.match(/NAME[\s:|]*([A-ZÑ][A-ZÑ.'-]*(?: [A-ZÑ.'-]+)*)\s*,\s*([A-ZÑ][A-ZÑ.'-]*(?: [A-ZÑ.'-]+)*)/) ??
    upper.match(/^([A-ZÑ][A-ZÑ.'-]*(?: [A-ZÑ.'-]+)*)\s*,\s*([A-ZÑ][A-ZÑ.'-]*(?: [A-ZÑ.'-]+)*)$/m);
  let last_name: string | null = null;
  let first_name: string | null = null;
  let middle_name: string | null = null;
  if (name) {
    last_name = titleCase(name[1]);
    const given = name[2].split(' ');
    if (given.length > 1) {
      middle_name = titleCase(given.pop()!);
      first_name = titleCase(given.join(' '));
    } else {
      first_name = titleCase(given[0]);
    }
  }

  // Section like BSIT-3B; the year level is the digit after the dash (or "3RD YEAR")
  // OCR often mixes up look-alikes (BSIT-3B read as "8SIT-38"), so the code is fixed up after matching
  const raw =
    upper.match(/YEAR\s*[-–—]?\s*([A-Z0-9]{3,6})\s*[-–—]\s*([1-4])\s*([A-Z0-9])\b/) ??
    upper.match(/\b([A-Z]{2,6})\s*[-–—]\s*([1-4])\s*([A-Z])\b/);
  const fix = (s: string, map: Record<string, string>) => s.replace(/[0158]/g, (c) => map[c] ?? c);
  const sec = raw && [fix(raw[1], { 8: 'B', 0: 'O', 5: 'S', 1: 'I' }), raw[2], fix(raw[3], { 8: 'B', 0: 'D' })];
  const section = sec ? `${sec[0]}-${sec[1]}${sec[2]}` : null;
  const yr = upper.match(/\b([1-4])\s*(?:ST|ND|RD|TH)?\s*YEAR\b/);
  const year_level = yr ? Number(yr[1]) : sec ? Number(sec[1]) : null;
  const courseLabel = upper.match(/COURSE[\s:|]*([A-Z]{2,6})\b/);
  const course = courseLabel?.[1] ?? sec?.[0] ?? null;

  const enrolled = /\bENROLLED\b/.test(upper) && !/NOT\s+ENROLLED/.test(upper);

  const missing = [
    ['Student No.', student_no],
    ['name', last_name && first_name],
    ['middle name', middle_name],
    ['year and section', section && year_level],
    ['course', course],
  ].filter(([, v]) => !v);
  for (const [label] of missing) issues.push(`Could not read the ${label}.`);
  if (!enrolled) issues.push('The COR does not show "ENROLLED".');

  const confidence = missing.length === 0 ? 'high' : missing.length === 1 ? 'medium' : 'low';
  return { is_cor, student_no, last_name, first_name, middle_name, year_level, section, course, enrolled, confidence, issues };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_BASE64_LENGTH) {
    return json({ error: 'Photo is too large. Try again.' }, 400);
  }

  try {
    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: new URLSearchParams({
        apikey: Deno.env.get('OCR_SPACE_API_KEY') ?? '',
        base64Image: `data:image/jpeg;base64,${image}`,
        language: 'eng',
        OCREngine: '2',
        scale: 'true',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.IsErroredOnProcessing) {
      const detail = JSON.stringify(data.ErrorMessage ?? data.error ?? data).slice(0, 200);
      console.error('OCR.space error', res.status, detail);
      return json({ error: `Scan failed, please try again. (${detail})` }, 502);
    }
    const text: string = data.ParsedResults?.[0]?.ParsedText ?? '';
    return json(parseCor(text));
  } catch (e) {
    console.error('scan-cor failed', e);
    return json({ error: 'Scan failed, please try again.' }, 502);
  }
});
