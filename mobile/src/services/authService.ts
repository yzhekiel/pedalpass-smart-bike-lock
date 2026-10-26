/**
 * Sign in / sign up with Supabase Auth.
 *
 * Sign-up flow: signUp() → Supabase emails a 6-digit code → verifyCode() → signed in.
 * The database trigger (supabase/schema.sql → handle_new_user) creates the "profiles" row
 * and rejects any email that is not @dyci.edu.ph.
 */
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

export type SignUpInput = {
  email: string;
  password: string;
  role: 'student' | 'faculty';
  name: string;
  studentId: string;
  course?: string;
  yearLevel?: string;
  section?: string;
};

type ProfileRow = {
  id: string;
  name: string;
  role: UserProfile['role'];
  email: string;
  student_id: string | null;
  course: string | null;
  year_level: string | null;
  section: string | null;
  title: string | null;
  department: string | null;
  avatar_url: string | null;
  is_verified: boolean;
};

const toProfile = (row: ProfileRow): UserProfile => ({
  id: row.id,
  name: row.name,
  role: row.role,
  email: row.email,
  studentId: row.student_id ?? undefined,
  course: row.course ?? undefined,
  yearLevel: row.year_level ?? undefined,
  section: row.section ?? undefined,
  title: row.title ?? undefined,
  department: row.department ?? undefined,
  avatarUrl: row.avatar_url ?? '',
  isVerified: row.is_verified,
});

/** Turns Supabase's English error messages into something a student understands. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Your email is not verified yet.';
  if (m.includes('token has expired') || m.includes('otp')) return 'That code is wrong or has expired. Request a new one.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('database error saving new user')) return 'Only @dyci.edu.ph email addresses can register.';
  if (m.includes('network')) return 'No internet connection.';
  return message;
}

export class AuthError extends Error {
  constructor(message: string, readonly needsVerification = false) {
    super(friendly(message));
  }
}

export async function loadProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) throw new AuthError(error?.message ?? 'Profile not found.');
  return toProfile(data as ProfileRow);
}

/** The signed-in user from the saved session, or null. */
export async function restoreSession(): Promise<UserProfile | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? loadProfile(user.id) : null;
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new AuthError(error.message, error.message.toLowerCase().includes('email not confirmed'));
  return loadProfile(data.user.id);
}

/**
 * Creates the account. Returns the profile if the user is signed in right away
 * ("Confirm email" turned off in Supabase), or null when a code was emailed.
 */
export async function signUp(input: SignUpInput): Promise<UserProfile | null> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        role: input.role,
        name: input.name.trim(),
        student_id: input.studentId.trim(),
        course: input.course?.trim(),
        year_level: input.yearLevel?.trim(),
        section: input.section?.trim(),
      },
    },
  });
  if (error) throw new AuthError(error.message);
  // Supabase hides "email already registered" by returning a user with no identities
  if (data.user && data.user.identities?.length === 0) {
    throw new AuthError('This email is already registered. Log in instead.');
  }
  return data.session && data.user ? loadProfile(data.user.id) : null;
}

export async function verifyCode(email: string, code: string): Promise<UserProfile> {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error || !data.user) throw new AuthError(error?.message ?? 'Verification failed.');
  return loadProfile(data.user.id);
}

export async function resendCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
  if (error) throw new AuthError(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
