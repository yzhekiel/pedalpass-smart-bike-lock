/**
 * Shapes of the records the admin portal reads from Supabase.
 * Column names match the database (snake_case), so API responses can be used directly.
 */

/** A bike's status as stored in the database (migrations 009–011). */
export type BikeStatus = 'available' | 'in_use' | 'inspection' | 'maintenance' | 'locked';

/** What a bike shows as: an available bike at 20% lock battery or lower is "unavailable". */
export type ShownStatus = BikeStatus | 'unavailable';

export interface Bike {
  id: string; // 'BP-001' — the code printed on the QR
  model: string;
  battery: number; // lock battery, 0–100
  station: string;
  bay: string;
  status: BikeStatus;
  node_id: string; // smart lock ID
  image_url: string | null;
  retired_at: string | null;
  updated_at: string;
}

export type Priority = 'P1' | 'P2' | 'P3';
export type ReportStatus = 'Reported / Queued' | 'Under Inspection' | 'Scheduled for Overhaul' | 'Resolved';

/** An issue report (table work_orders). */
export interface Report {
  id: string; // 'TKT-905'
  bike_id: string;
  station: string;
  bay: string;
  priority: Priority;
  issue_title: string;
  reported_by: string;
  status: ReportStatus;
  assigned_tech: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Ride {
  id: string;
  user_id: string;
  bike_id: string;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  status: 'active' | 'Completed' | 'Issue Reported';
  note: string | null;
  profiles?: { name: string; student_id: string | null } | null;
}

export type VerificationStatus = 'needs_documents' | 'pending_review' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  member_type: 'student' | 'faculty';
  student_id: string | null;
  course: string | null;
  year_level: string | null;
  section: string | null;
  department: string | null;
  verification_status: VerificationStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  created_at: string;
  action: string;
  status: string | null;
  bike_id: string | null;
  user_name: string | null;
  actor_name: string | null;
  details: string | null;
}

/** Current QR text of a bike, from the bike_qr_codes() database function. */
export interface BikeQr {
  bike_id: string;
  payload: string; // 'PEDALPASS:BP-001:<secret code>'
  version: number;
  updated_at: string;
}

/** A signed-in admin's saved session (Supabase Auth). */
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // seconds since 1970
  user: { id: string; email: string };
}

/** Lock battery at or below this (%) makes a bike Unavailable — same rule as the database (migration 011). */
export const LOW_BATTERY = 20;

export const shownStatus = (b: Pick<Bike, 'status' | 'battery'>): ShownStatus =>
  b.status === 'available' && b.battery <= LOW_BATTERY ? 'unavailable' : b.status;

export const STATUS_LABEL: Record<ShownStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  in_use: 'In use',
  inspection: 'Under inspection',
  maintenance: 'Maintenance',
  locked: 'Locked',
};

/** Report steps in the admin → maintenance flow ("Resolved" is shown as Fixed). */
export const REPORT_STEP_LABEL: Record<ReportStatus, string> = {
  'Reported / Queued': 'New — maintenance not contacted',
  'Under Inspection': 'Sent to maintenance',
  'Scheduled for Overhaul': 'Big repair',
  Resolved: 'Fixed',
};
