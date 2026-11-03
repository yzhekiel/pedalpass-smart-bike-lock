/**
 * Staff sign-in with Supabase Auth. Only accounts whose role in the "profiles"
 * table is admin can use the portal (see supabase/migrations/007_user_and_admin_roles.sql
 * for how to promote an account).
 */
import { supabase } from './supabase';
import { UserProfile, UserRole } from '../types';

export type StaffRole = Extract<UserRole, 'admin'>;
export type StaffProfile = UserProfile & { role: StaffRole };

const STAFF_ROLES: UserRole[] = ['admin'];

async function loadStaffProfile(userId: string): Promise<StaffProfile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) throw new Error('Your profile could not be loaded.');
  if (!STAFF_ROLES.includes(data.role)) {
    await supabase.auth.signOut();
    throw new Error('This is not an admin account. Riders use the PedalPass mobile app.');
  }
  return {
    id: data.id,
    name: data.name,
    role: data.role,
    email: data.email,
    title: data.title ?? undefined,
    department: data.department ?? undefined,
    avatarUrl: data.avatar_url ?? '',
    isVerified: data.is_verified,
  };
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'This email is not verified yet.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  return message;
}

export async function staffSignIn(email: string, password: string): Promise<StaffProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(friendly(error.message));
  return loadStaffProfile(data.user.id);
}

/** The signed-in staff member from the saved browser session, or null. */
export async function restoreStaffSession(): Promise<StaffProfile | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  try {
    return await loadStaffProfile(user.id);
  } catch {
    return null;
  }
}

export async function staffSignOut(): Promise<void> {
  await supabase.auth.signOut();
}
