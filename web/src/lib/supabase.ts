/**
 * Supabase client for the staff web portal.
 *
 * Keys come from web/.env (copy .env.example). Vite only exposes variables
 * that start with VITE_. Restart `npm run dev` after editing it.
 * The publishable key is safe in the browser — the database security rules (RLS) protect the data.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** False until the .env keys are filled in — the portal keeps using mock data until then. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'missing-key');
