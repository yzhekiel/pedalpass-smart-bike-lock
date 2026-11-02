/**
 * Scan COR — sends a photo of the Certificate of Registration to the "scan-cor" Edge Function
 * (supabase/functions/scan-cor), which reads the text (OCR) and finds the sign-up fields.
 * The photo is only used for the scan; nothing is saved.
 */
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';

export type CorScan = {
  is_cor: boolean;
  student_no: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  year_level: number | null;
  section: string | null;
  course: string | null;
  enrolled: boolean | null;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
};

const MAX_WIDTH = 1600;
const FAILED = 'Scan failed, please try again.';

/** Shrinks the photo to 1600px wide (never enlarges) so it uploads faster. */
async function shrink(uri: string, width: number): Promise<string> {
  const result = await manipulateAsync(uri, width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [], {
    compress: 0.6, // keeps the upload under the OCR service's 1 MB limit
    format: SaveFormat.JPEG,
    base64: true,
  });
  return result.base64 ?? '';
}

export async function scanCor(uri: string, width: number): Promise<CorScan> {
  const image = await shrink(uri, width);
  const { data, error } = await supabase.functions.invoke('scan-cor', { body: { image } });
  if (error || !data) throw new Error(FAILED);
  // supabase-js returns the body already parsed when the function replies with JSON
  const scan = typeof data === 'string' ? safeParse(data) : data;
  if (!scan || typeof scan.is_cor !== 'boolean') throw new Error(FAILED);
  return { ...scan, issues: Array.isArray(scan.issues) ? scan.issues : [] } as CorScan;
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
