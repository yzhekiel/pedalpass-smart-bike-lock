import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

/** Query filters in Supabase's REST format, e.g. { status: 'eq.available', retired_at: 'is.null' }. */
export type Filters = Record<string, string>;

/**
 * The only place that talks to the database. Supabase exposes every table as a REST API
 * (PostgREST), so Angular's HttpClient can read and write it directly; every method returns an
 * Observable that the pages subscribe() to. The auth interceptor adds the API key and the admin's
 * sign-in token to each request, and the database's security rules decide what is allowed.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseApi {
  private http = inject(HttpClient);
  private rest = `${environment.supabaseUrl}/rest/v1`;
  private storage = `${environment.supabaseUrl}/storage/v1`;

  /** GET rows: select('bikes', '*', { retired_at: 'is.null' }, 'id') */
  select<T>(table: string, columns = '*', filters: Filters = {}, order?: string, limit?: number): Observable<T[]> {
    let params = new HttpParams({ fromObject: { select: columns, ...filters } });
    if (order) params = params.set('order', order);
    if (limit) params = params.set('limit', limit);
    return this.http.get<T[]>(`${this.rest}/${table}`, { params });
  }

  /** Number of rows matching the filters, without downloading them. */
  count(table: string, filters: Filters = {}): Observable<number> {
    const params = new HttpParams({ fromObject: { select: 'id', ...filters } });
    const headers = new HttpHeaders({ Prefer: 'count=exact', Range: '0-0' });
    return this.http
      .get(`${this.rest}/${table}`, { params, headers, observe: 'response' })
      .pipe(map((res) => Number(res.headers.get('content-range')?.split('/')[1] ?? 0)));
  }

  /** POST a new row and get it back as saved. */
  insert<T>(table: string, row: Partial<T>): Observable<T> {
    const headers = new HttpHeaders({ Prefer: 'return=representation' });
    return this.http.post<T[]>(`${this.rest}/${table}`, row, { headers }).pipe(map((rows) => rows[0]));
  }

  /** PATCH the rows matching the filters, e.g. update('bikes', { bay: 'Bay 03' }, { id: 'eq.BP-003' }). */
  update<T>(table: string, changes: Partial<T>, filters: Filters): Observable<T[]> {
    const headers = new HttpHeaders({ Prefer: 'return=representation' });
    const params = new HttpParams({ fromObject: filters });
    return this.http.patch<T[]>(`${this.rest}/${table}`, changes, { headers, params });
  }

  /** DELETE the rows matching the filters. */
  delete(table: string, filters: Filters): Observable<void> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.delete<void>(`${this.rest}/${table}`, { params });
  }

  /** Call a database function, e.g. rpc('remove_bike', { p_bike_id: 'BP-016' }). */
  rpc<T>(fn: string, args: object = {}): Observable<T> {
    return this.http.post<T>(`${this.rest}/rpc/${fn}`, args);
  }

  /** A 10-minute link to a private file (ID photos live in the private "verification" bucket). */
  signedUrl(bucket: string, path: string, seconds = 600): Observable<string> {
    return this.http
      .post<{ signedURL: string }>(`${this.storage}/object/sign/${bucket}/${path}`, { expiresIn: seconds })
      .pipe(map((res) => `${this.storage}${res.signedURL}`));
  }

  /** Delete private files, e.g. a rider's selfie and COR after review. */
  removeFiles(bucket: string, paths: string[]): Observable<unknown> {
    return this.http.delete(`${this.storage}/object/${bucket}`, { body: { prefixes: paths } });
  }
}

/** A readable message from a failed request (Supabase puts the reason in error.message). */
export function errorMessage(err: unknown): string {
  const e = err as { error?: { message?: string; msg?: string; error_description?: string }; message?: string; status?: number };
  if (e?.status === 0) return 'Cannot reach the server. Check your internet connection.';
  return e?.error?.message ?? e?.error?.msg ?? e?.error?.error_description ?? e?.message ?? 'Something went wrong.';
}
