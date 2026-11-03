export type ScreenType =
  | 'login'
  | 'register'
  | 'home'
  | 'scan'
  | 'active_ride'
  | 'ride_history'
  | 'security'
  | 'maintenance'
  | 'resolution'
  | 'admin_dashboard'
  | 'verifications'
  | 'qr_codes'
  | 'activity_log'
  | 'bikes'
  | 'bike_history'
  | 'maintenance_list'
  | 'analytics';

/** Two roles: riders ('user', mobile app) and 'admin' (this portal). */
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title?: string;
  department?: string;
  studentId?: string;
  course?: string;
  yearLevel?: string;
  section?: string;
  email: string;
  avatarUrl: string;
  isVerified: boolean;
}

export interface BicycleItem {
  id: string; // e.g. "BP-001"
  model: string; // "DYCI Campus Cruiser"
  battery: number;
  rangeKm: number;
  station: string;
  bay: string;
  /** inspection = an issue was reported, maintenance must check it first (migration 009) */
  status: 'available' | 'in_use' | 'inspection' | 'maintenance' | 'locked';
  imageUrl: string;
  nodeId: string;
}

export interface StationItem {
  id: string;
  name: string;
  code: string;
  totalBays: number;
  availableBikes: number;
  freeBays: number;
  nodeId: string;
  status: 'optimal' | 'warning' | 'offline';
  statusMessage?: string;
}

export interface WorkOrderItem {
  id: string; // e.g. "TKT-884"
  bikeId: string;
  station: string;
  bay: string;
  priority: 'P1' | 'P2' | 'P3';
  priorityLabel: 'High Priority (P1)' | 'Medium Priority (P2)' | 'Low Priority (P3)';
  issueTitle: string;
  reportedBy: string;
  timestamp: string;
  status: 'Under Inspection' | 'Reported / Queued' | 'Scheduled for Overhaul' | 'Resolved';
  assignedTech?: string;
  assignedStaffId?: string;
  partsAllocated?: string;
  nodeId: string;
  caliperPhotoUrl?: string;
  createdAt: string; // ISO
  resolvedAt?: string; // ISO
  resolutionNotes?: string;
}
