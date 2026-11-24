import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ActivityEntry } from './models';
import { Filters, SupabaseApi } from './supabase-api.service';

export const ACTION_LABEL: Record<string, string> = {
  ride_started: 'Ride started',
  ride_ended: 'Bike returned',
  ride_cancelled: 'Ride cancelled',
  bike_swapped: 'Bike swapped',
  issue_reported: 'Issue reported',
  maintenance_assigned: 'Assigned',
  maintenance_update: 'Report status changed',
  issue_resolved: 'Marked fixed',
  bike_status_changed: 'Bike status changed',
  qr_regenerated: 'QR code regenerated',
  bike_removed: 'Bike removed',
  identity_pending_review: 'Identity submitted',
  identity_approved: 'Identity approved',
  identity_rejected: 'Identity rejected',
};

/** The activity log the database writes by itself (migration 010); read-only. */
@Injectable({ providedIn: 'root' })
export class ActivityService {
  private api = inject(SupabaseApi);

  /** Entries between two dates (YYYY-MM-DD, inclusive), newest first, optionally for one bike. */
  list(from: string, to: string, bikeId?: string): Observable<ActivityEntry[]> {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    const filters: Filters = {
      and: `(created_at.gte.${new Date(`${from}T00:00:00`).toISOString()},created_at.lt.${end.toISOString()})`,
    };
    if (bikeId) filters['bike_id'] = `eq.${bikeId.toUpperCase()}`;
    return this.api.select<ActivityEntry>('activity_log', '*', filters, 'created_at.desc', 2000);
  }
}
