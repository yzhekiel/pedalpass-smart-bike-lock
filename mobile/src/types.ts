export type ScreenType =
  | 'login'
  | 'register'
  | 'verify_email'
  | 'verify_identity'
  | 'home'
  | 'scan'
  | 'active_ride'
  | 'ride_history'
  | 'security'
  | 'report_issue'
  | 'maintenance'
  | 'resolution'
  | 'admin_dashboard'
  | 'depot_inventory';

export type UserRole = 'student' | 'faculty' | 'security' | 'maintenance' | 'admin';

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
  /** Identity check (school ID + COR + selfie). Absent in mock-data mode. */
  verificationStatus?: VerificationStatus;
  rejectionReason?: string;
}

export type VerificationStatus = 'needs_documents' | 'pending_review' | 'approved' | 'rejected';

export interface BicycleItem {
  id: string; // e.g. "BP-001"
  model: string; // "DYCI Campus Cruiser"
  battery: number;
  rangeKm: number;
  station: string;
  bay: string;
  status: 'available' | 'in_use' | 'maintenance' | 'locked';
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
  partsAllocated?: string;
  nodeId: string;
  caliperPhotoUrl?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  stock: number;
  unit: string;
  percentage: number;
  statusTag: string;
  statusType: 'good' | 'warning' | 'critical' | 'normal';
  reorderThreshold?: number;
}

export interface RideRecord {
  id: string;
  bikeId: string;
  from: string;
  to: string;
  dateLabel: string;
  durationMin: number;
  distanceKm: number;
  status: 'Completed' | 'Issue Reported';
  note?: string;
}
