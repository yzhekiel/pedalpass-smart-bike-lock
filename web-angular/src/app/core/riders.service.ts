import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Profile } from './models';
import { SupabaseApi } from './supabase-api.service';

/** Photos a rider uploads at sign-up (private bucket "verification", folder = their id). */
const DOCS = ['id.jpg', 'cor.jpg', 'selfie.jpg'] as const;
export type RiderPhotos = Partial<Record<(typeof DOCS)[number], string>>;

/** Riders' profiles and the identity approval step. */
@Injectable({ providedIn: 'root' })
export class RidersService {
  private api = inject(SupabaseApi);

  all(): Observable<Profile[]> {
    return this.api.select<Profile>('profiles', '*', { role: 'eq.user' }, 'created_at.desc');
  }

  pending(): Observable<Profile[]> {
    return this.api.select<Profile>('profiles', '*', { verification_status: 'eq.pending_review' }, 'submitted_at');
  }

  /** 10-minute links to a rider's uploaded photos (missing photos are left out). */
  photos(riderId: string): Observable<RiderPhotos> {
    const links = DOCS.map((file) =>
      this.api.signedUrl('verification', `${riderId}/${file}`).pipe(
        map((url): [string, string | null] => [file, url]),
        // a photo that isn't there (e.g. faculty have no COR) is left out instead of failing the rest
        catchError(() => of<[string, string | null]>([file, null])),
      ),
    );
    return forkJoin(links).pipe(map((pairs) => Object.fromEntries(pairs.filter(([, url]) => url)) as RiderPhotos));
  }

  /**
   * Approve or reject (database function review_verification). After review the selfie and COR are
   * deleted; an approved rider's ID photo is kept so admins can identify who rode a bike.
   */
  review(rider: Profile, approve: boolean, reason?: string): Observable<unknown> {
    const remove = (approve ? DOCS.filter((d) => d !== 'id.jpg') : [...DOCS]).map((d) => `${rider.id}/${d}`);
    return this.api
      .rpc('review_verification', { p_user_id: rider.id, p_approve: approve, p_reason: reason ?? null })
      .pipe(switchMap(() => this.api.removeFiles('verification', remove)));
  }
}
