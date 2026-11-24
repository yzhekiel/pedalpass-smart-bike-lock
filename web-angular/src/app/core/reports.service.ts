import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Report, ReportStatus } from './models';
import { SupabaseApi } from './supabase-api.service';

/**
 * Issue reports (table work_orders). Riders create them from the mobile app's checklists; admins move
 * them along and mark them fixed. The database then makes the bike available again by itself.
 */
@Injectable({ providedIn: 'root' })
export class ReportsService {
  private api = inject(SupabaseApi);

  list(): Observable<Report[]> {
    return this.api.select<Report>('work_orders', '*', {}, 'created_at.desc', 1000);
  }

  setStatus(id: string, status: ReportStatus): Observable<Report> {
    return this.api.update<Report>('work_orders', { status }, { id: `eq.${id}` }).pipe(map((rows) => rows[0]));
  }

  /** Maintenance said it's fixed: record who fixed it and what was done. */
  markFixed(id: string, fixedBy: string, notes: string): Observable<Report> {
    return this.api
      .update<Report>(
        'work_orders',
        {
          status: 'Resolved',
          resolved_at: new Date().toISOString(),
          assigned_tech: fixedBy.trim() || null,
          resolution_notes: notes.trim() || null,
        },
        { id: `eq.${id}` },
      )
      .pipe(map((rows) => rows[0]));
  }
}
