import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Profile, Session } from './models';

const STORAGE_KEY = 'pedalpass-admin-session';

/**
 * Admin sign-in with Supabase Auth's REST endpoints. The session is kept in localStorage so the
 * admin stays signed in after a page refresh, and renewed shortly before it expires.
 * Only accounts whose profile role is "admin" may use this portal.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private auth = `${environment.supabaseUrl}/auth/v1`;
  private refreshing: Observable<Session> | null = null;

  readonly session = signal<Session | null>(this.load());
  readonly profile = signal<Profile | null>(null);
  readonly signedIn = computed(() => !!this.profile());

  signIn(email: string, password: string): Observable<Profile> {
    return this.http
      .post<Session>(`${this.auth}/token?grant_type=password`, { email: email.trim().toLowerCase(), password })
      .pipe(
        catchError((err) => throwError(() => new Error(friendly(err)))),
        tap((s) => this.save(s)),
        switchMap(() => this.loadProfile()),
      );
  }

  /** On app start: the saved session's admin, or null. */
  restore(): Observable<Profile | null> {
    if (!this.session()) return of(null);
    return this.loadProfile().pipe(catchError(() => of(null)));
  }

  /** A new access token from the refresh token (several requests at once share one refresh). */
  refresh(): Observable<Session> {
    const current = this.session();
    if (!current) return throwError(() => new Error('Not signed in'));
    this.refreshing ??= this.http
      .post<Session>(`${this.auth}/token?grant_type=refresh_token`, { refresh_token: current.refresh_token })
      .pipe(
        tap((s) => this.save(s)),
        catchError((err) => {
          this.clear();
          return throwError(() => err);
        }),
        finalize(() => (this.refreshing = null)),
        shareReplay(1),
      );
    return this.refreshing;
  }

  signOut(): void {
    const s = this.session();
    if (s) this.http.post(`${this.auth}/logout`, {}).subscribe({ error: () => {} });
    this.clear();
  }

  /** True when the token runs out within a minute. */
  expiresSoon(s: Session): boolean {
    return s.expires_at * 1000 - Date.now() < 60_000;
  }

  private loadProfile(): Observable<Profile> {
    const id = this.session()?.user.id;
    return this.http
      .get<Profile[]>(`${environment.supabaseUrl}/rest/v1/profiles`, { params: { select: '*', id: `eq.${id}` } })
      .pipe(
        map((rows) => {
          const p = rows[0];
          if (!p) throw new Error('Your profile could not be loaded.');
          if (p.role !== 'admin') {
            this.signOut();
            throw new Error('This is not an admin account. Riders use the PedalPass mobile app.');
          }
          return p;
        }),
        tap((p) => this.profile.set(p)),
      );
  }

  private save(s: Session): void {
    // Supabase sends expires_in (seconds); keep an absolute time so a reload knows when it ends
    const withExpiry = { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + 3600 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withExpiry));
    this.session.set(withExpiry);
  }

  private clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
    this.profile.set(null);
  }

  private load(): Session | null {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }
}

function friendly(err: { error?: { error_description?: string; msg?: string; message?: string } }): string {
  const m = (err.error?.error_description ?? err.error?.msg ?? err.error?.message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'This email is not verified yet.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Could not sign in. Check your internet connection.';
}
