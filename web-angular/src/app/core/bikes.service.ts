import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Bike, BikeQr, Report, Ride } from './models';
import { SupabaseApi } from './supabase-api.service';

/** New or edited bike details an admin can type in. Status is never typed: the database sets it. */
export type BikeInput = Pick<Bike, 'id' | 'model' | 'bay' | 'node_id' | 'battery'>;

export const STATION = 'Covered Court Hub'; // the only station (migration 006)

/** Bike records: list, add, edit, remove, and each bike's QR code and history. */
@Injectable({ providedIn: 'root' })
export class BikesService {
  private api = inject(SupabaseApi);

  /** The fleet: removed (retired) bikes are hidden (migration 011). */
  list(): Observable<Bike[]> {
    return this.api.select<Bike>('bikes', '*', { retired_at: 'is.null' }, 'id');
  }

  get(id: string): Observable<Bike | undefined> {
    return this.api.select<Bike>('bikes', '*', { id: `eq.${id}` }).pipe(map((rows) => rows[0]));
  }

  add(input: BikeInput): Observable<Bike> {
    return this.api.insert<Bike>('bikes', { ...input, station: STATION, status: 'available' });
  }

  update(id: string, changes: Partial<BikeInput>): Observable<Bike> {
    return this.api
      .update<Bike>('bikes', { ...changes, updated_at: new Date().toISOString() }, { id: `eq.${id}` })
      .pipe(map((rows) => rows[0]));
  }

  /** The database deletes a never-used bike, or retires one with history ('deleted' | 'retired'). */
  remove(id: string): Observable<'deleted' | 'retired'> {
    return this.api.rpc<'deleted' | 'retired'>('remove_bike', { p_bike_id: id });
  }

  /** Put a bike that is on hold with no open report back in service. */
  makeAvailable(id: string): Observable<Bike[]> {
    return this.api.update<Bike>('bikes', { status: 'available', updated_at: new Date().toISOString() }, { id: `eq.${id}` });
  }

  /** Every bike's current QR text; also creates codes for bikes that have none yet. */
  qrCodes(): Observable<BikeQr[]> {
    return this.api.rpc<BikeQr[]>('bike_qr_codes');
  }

  /** New secret code: the bike's old printed QR stops working. Returns the new QR text. */
  regenerateQr(id: string): Observable<string> {
    return this.api.rpc<string>('regenerate_bike_qr', { p_bike_id: id });
  }

  rides(bikeId: string): Observable<Ride[]> {
    return this.api.select<Ride>('rides', '*, profiles(name, student_id)', { bike_id: `eq.${bikeId}` }, 'started_at.desc', 100);
  }

  reports(bikeId: string): Observable<Report[]> {
    return this.api.select<Report>('work_orders', '*', { bike_id: `eq.${bikeId}` }, 'created_at.desc');
  }
}
