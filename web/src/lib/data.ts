/**
 * Reads the staff portal's live data from Supabase (the security rules in supabase/schema.sql decide
 * what each role can see). useQuery loads once and then refreshes every 30 seconds.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { BicycleItem, InventoryItem, StationItem, WorkOrderItem } from '../types';

const PRIORITY_LABEL = {
  P1: 'High Priority (P1)',
  P2: 'Medium Priority (P2)',
  P3: 'Low Priority (P3)',
} as const;

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function useQuery<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(() => load().then(setData).catch((e) => setError(e.message ?? 'Could not load data.')), []);
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 30_000);
    return () => clearInterval(timer);
  }, [reload]);
  return { data, error, reload };
}

/** Shown while a screen's data loads (or if it fails). */
export const loadingText = (error: string) => (error ? `Could not load data: ${error}` : 'Loading…');

/* ---------- Work orders ---------- */

type WorkOrderRow = {
  id: string;
  bike_id: string;
  station: string;
  bay: string;
  priority: WorkOrderItem['priority'];
  issue_title: string;
  reported_by: string;
  status: WorkOrderItem['status'];
  assigned_tech: string | null;
  parts_allocated: string | null;
  node_id: string | null;
  photo_url: string | null;
  created_at: string;
};

export const toWorkOrder = (r: WorkOrderRow): WorkOrderItem => ({
  id: r.id,
  bikeId: r.bike_id,
  station: r.station,
  bay: r.bay,
  priority: r.priority,
  priorityLabel: PRIORITY_LABEL[r.priority],
  issueTitle: r.issue_title,
  reportedBy: r.reported_by,
  timestamp: formatTime(r.created_at),
  status: r.status,
  assignedTech: r.assigned_tech ?? undefined,
  partsAllocated: r.parts_allocated ?? undefined,
  nodeId: r.node_id ?? '',
  caliperPhotoUrl: r.photo_url ?? undefined,
});

/** Tickets that are not resolved yet, highest priority first. */
export async function fetchOpenWorkOrders(): Promise<WorkOrderItem[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .neq('status', 'Resolved')
    .order('priority')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as WorkOrderRow[]).map(toWorkOrder);
}

/* ---------- Bikes, hubs, parts ---------- */

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

export async function fetchBikes(): Promise<BicycleItem[]> {
  const { data, error } = await supabase.from('bikes').select('*').order('id');
  if (error) throw error;
  return (data as BikeRow[]).map((b) => ({
    id: b.id,
    model: b.model,
    battery: b.battery,
    rangeKm: b.range_km,
    station: b.station,
    bay: b.bay,
    status: b.status,
    imageUrl: b.image_url ?? '',
    nodeId: b.node_id,
  }));
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from('inventory').select('*').order('id');
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    stock: r.stock,
    unit: r.unit,
    percentage: r.percentage,
    statusTag: r.status_tag ?? '',
    statusType: r.status_type,
    reorderThreshold: r.reorder_threshold ?? undefined,
  }));
}

/** Hubs with the number of bikes currently available at each. */
export async function fetchStations(): Promise<StationItem[]> {
  const [stations, bikes] = await Promise.all([supabase.from('stations').select('*').order('id'), fetchBikes()]);
  if (stations.error) throw stations.error;
  return stations.data.map((s) => {
    const here = bikes.filter((b) => b.station === s.name);
    const availableBikes = here.filter((b) => b.status === 'available').length;
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      totalBays: s.total_bays,
      availableBikes,
      freeBays: Math.max(0, s.total_bays - here.length),
      nodeId: s.node_id ?? '',
      status: s.status,
      statusMessage: s.status_message ?? undefined,
    };
  });
}
