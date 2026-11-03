/**
 * Bikes, rides, issue reports and SOS alerts in Supabase.
 *
 * Writes that touch two tables go through database functions (supabase/schema.sql and
 * migrations/003_unlock_tokens.sql), so the server decides who may ride which bike.
 */
import { supabase } from '../lib/supabase';
import { BicycleItem, RideRecord, UserProfile, WorkOrderItem } from '../types';
import { describeInspection, InspectionMode, InspectionResult } from '../components/InspectionSheet';

const PRIORITY_LABEL = {
  P1: 'High Priority (P1)',
  P2: 'Medium Priority (P2)',
  P3: 'Low Priority (P3)',
} as const;

type BikeRow = {
  id: string;
  model: string;
  battery: number;
  range_km: number;
  station: string;
  bay: string;
  status: BicycleItem['status'];
  image_url: string | null;
  node_id: string;
};

type RideRow = {
  id: string;
  bike_id: string;
  from_location: string;
  to_location: string | null;
  started_at: string;
  duration_min: number | null;
  distance_km: number | null;
  status: 'active' | RideRecord['status'];
  note: string | null;
};

export type ActiveRide = { rideId: string; bike: BicycleItem; startedAt: number };

const toBike = (row: BikeRow): BicycleItem => ({
  id: row.id,
  model: row.model,
  battery: row.battery,
  rangeKm: row.range_km,
  station: row.station,
  bay: row.bay,
  status: row.status,
  imageUrl: row.image_url ?? '',
  nodeId: row.node_id,
});

/** "Today • 08:14 AM", "Yesterday • 02:40 PM" or "Mar 3 • 09:00 AM" (Ride History filters on Today/Yesterday). */
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
  const day = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${day} • ${time}`;
}

const toRide = (row: RideRow): RideRecord => ({
  id: row.id,
  bikeId: row.bike_id,
  from: row.from_location,
  to: row.to_location ?? row.from_location,
  dateLabel: dateLabel(row.started_at),
  durationMin: row.duration_min ?? 0,
  distanceKm: Number(row.distance_km ?? 0),
  status: row.status === 'active' ? 'Completed' : row.status,
  note: row.note ?? undefined,
});

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function fetchBikes(): Promise<BicycleItem[]> {
  // Bikes an admin removed (retired, migration 011) are not shown to riders
  return check<BikeRow[]>(await supabase.from('bikes').select('*').is('retired_at', null).order('id')).map(toBike);
}

/** The bike as it is right now (null if no such bike). */
export async function fetchBike(id: string): Promise<BicycleItem | null> {
  const row = check<BikeRow | null>(await supabase.from('bikes').select('*').eq('id', id).maybeSingle());
  return row ? toBike(row) : null;
}

/** The rider's ride that has not ended yet — survives app restarts. */
export async function fetchActiveRide(userId: string): Promise<ActiveRide | null> {
  const row = check<(RideRow & { bikes: BikeRow }) | null>(
    await supabase.from('rides').select('*, bikes(*)').eq('user_id', userId).eq('status', 'active').maybeSingle(),
  );
  return row ? { rideId: row.id, bike: toBike(row.bikes), startedAt: Date.parse(row.started_at) } : null;
}

export async function fetchRideHistory(userId: string): Promise<RideRecord[]> {
  const rows = check<RideRow[]>(
    await supabase
      .from('rides')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(50),
  );
  return rows.map(toRide);
}

/** At or below this lock battery (%) a bike is Unavailable — same rule as min_ride_battery() in migration 011. */
export const LOW_BATTERY = 20;
export const isLowBattery = (b: BicycleItem) => b.battery <= LOW_BATTERY;
/** Can be borrowed right now: docked, available and with enough lock battery. */
export const isReady = (b: BicycleItem) => b.status === 'available' && !isLowBattery(b);

/**
 * Server checks the QR code is the bike's current one, the rider is approved and has no other ride,
 * and the bike is available with enough lock battery, then starts the ride.
 */
export async function startRide(bikeId: string, qrCode: string): Promise<{ rideId: string; startedAt: number }> {
  const row = check<RideRow>(await supabase.rpc('start_ride', { p_bike_id: bikeId, p_qr_token: qrCode }));
  return { rideId: row.id, startedAt: Date.parse(row.started_at) };
}

/**
 * Swap during a ride: the server ends the current ride, files a ticket for the old bike (it goes Under
 * Inspection) and starts the new bike — all or nothing. Returns the new ride.
 */
export async function swapBike(
  rideId: string,
  newBikeId: string,
  qrCode: string,
  reason: string,
): Promise<{ rideId: string; startedAt: number }> {
  const row = check<RideRow>(
    await supabase.rpc('swap_bike', { p_ride_id: rideId, p_new_bike_id: newBikeId, p_qr_token: qrCode, p_reason: reason }),
  );
  return { rideId: row.id, startedAt: Date.parse(row.started_at) };
}

/** A 60-second token signed with the lock's own key, valid only for this active ride. */
export async function requestUnlockToken(rideId: string): Promise<string> {
  return check<string>(await supabase.rpc('issue_unlock_token', { p_ride_id: rideId }));
}

/** Undo a ride that just started because the lock did not open. */
export async function cancelRide(rideId: string): Promise<void> {
  check(await supabase.rpc('cancel_ride', { p_ride_id: rideId }));
}

export async function endRide(rideId: string, condition: 'good' | 'minor' | 'damaged'): Promise<RideRecord> {
  return toRide(check<RideRow>(await supabase.rpc('end_ride', { p_ride_id: rideId, p_condition: condition })));
}

export type IssueReport = {
  reporterId: string;
  reportedBy: string;
  bike: BicycleItem;
  priority: WorkOrderItem['priority'];
  issueTitle: string;
};

/**
 * Saves the report for the maintenance team. The database sets the ticket number, reporter and
 * location, and may lower P1 to P2 if the rider has not ridden this bike in the last hour
 * (migrations/004_privacy_and_reports.sql) — so use the returned priority.
 */
export async function submitIssue(r: IssueReport): Promise<WorkOrderItem> {
  const row = check<{ id: string; priority: WorkOrderItem['priority'] }>(
    await supabase
      .from('work_orders')
      .insert({
        bike_id: r.bike.id,
        station: r.bike.station,
        bay: r.bike.bay,
        priority: r.priority,
        issue_title: r.issueTitle,
        reported_by: r.reportedBy,
        reporter_id: r.reporterId,
        node_id: r.bike.nodeId,
      })
      .select('id, priority')
      .single(),
  );
  return {
    id: row.id,
    bikeId: r.bike.id,
    station: r.bike.station,
    bay: r.bike.bay,
    priority: row.priority,
    priorityLabel: PRIORITY_LABEL[row.priority],
    issueTitle: r.issueTitle,
    reportedBy: r.reportedBy,
    timestamp: 'Just now',
    status: 'Reported / Queued',
    nodeId: r.bike.nodeId,
  };
}

/** "Ana Cruz (Student)" — the database fills this in too, but the insert needs a value. */
export const reporterLabel = (user: UserProfile) => `${user.name} (${user.memberType === 'faculty' ? 'Faculty' : 'Student'})`;

/**
 * Sends the problems from a borrow/return checklist to maintenance.
 * Unsafe → P1 (takes the bike out of service if the rider just rode it), reported before
 * choosing another bike → P2, minor → P3.
 */
export async function reportInspection(
  user: UserProfile,
  bike: BicycleItem,
  mode: InspectionMode,
  result: InspectionResult,
  keepRiding: boolean,
): Promise<WorkOrderItem> {
  const priority = result.unsafe ? 'P1' : keepRiding || mode === 'return' ? 'P3' : 'P2';
  return submitIssue({
    reporterId: user.id,
    reportedBy: reporterLabel(user),
    bike,
    priority,
    issueTitle: describeInspection(mode, result),
  });
}

/** Raises an SOS for campus security (shown on the staff web portal). */
export async function sendSos(userId: string, bikeId: string): Promise<void> {
  check(
    await supabase.from('alerts').insert({ type: 'sos', user_id: userId, bike_id: bikeId, message: `SOS during ride on ${bikeId}` }),
  );
}
