/**
 * "AI-assisted" analytics for the admin Analytics page: fixed, explainable rules over PedalPass's own
 * records (rides, reports, approvals). Every recommendation says which numbers it came from,
 * so admins can check it — nothing is guessed or random.
 */

export type RideRec = { bike_id: string; started_at: string; ended_at: string | null; duration_min: number | null; status: string };
export type OrderRec = { id: string; bike_id: string; priority: 'P1' | 'P2' | 'P3'; status: string; issue_title: string; created_at: string; resolved_at: string | null };
export type BikeRec = { id: string; status: string; battery: number };

export type Insight = { tone: 'urgent' | 'warn' | 'info'; title: string; detail: string };
export type BikePriority = { bikeId: string; score: number; reasons: string[] };

const HOUR = 3600000;
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

/** Which parts a report is about: "Pre-ride check: Brakes, Tires — squeaks" → ["Brakes", "Tires"]. */
export function issueParts(title: string): string[] {
  const check = title.match(/^(?:Pre-ride check|Return check):\s*([^—(]+)/);
  if (check) return check[1].split(',').map((s) => s.trim()).filter(Boolean);
  const swap = title.match(/^Bike swap:\s*([^—]+)/);
  if (swap) return [swap[1].trim()];
  return [title.split(' — ')[0].trim()];
}

/** Most bikes out on rides at the same moment, and when. */
export function peakConcurrent(rides: RideRec[], now = Date.now()): { count: number; at: number | null } {
  const events: [number, number][] = [];
  for (const r of rides) {
    const start = Date.parse(r.started_at);
    const end = r.ended_at ? Date.parse(r.ended_at) : r.status === 'active' ? now : start + (r.duration_min ?? 1) * 60000;
    events.push([start, 1], [end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // an end before a start at the same instant
  let cur = 0;
  let best = { count: 0, at: null as number | null };
  for (const [t, d] of events) {
    cur += d;
    if (cur > best.count) best = { count: cur, at: t };
  }
  return best;
}

export function ridesByHour(rides: RideRec[]): number[] {
  const hours = Array<number>(24).fill(0);
  for (const r of rides) hours[new Date(r.started_at).getHours()]++;
  return hours;
}

/** Bikes ranked by how urgently maintenance should look at them. */
export function maintenancePriority(bikes: BikeRec[], orders: OrderRec[], rides: RideRec[], now = Date.now()): BikePriority[] {
  const monthAgo = now - 30 * 24 * HOUR;
  return bikes
    .map((b) => {
      const mine = orders.filter((o) => o.bike_id === b.id);
      const open = mine.filter((o) => o.status !== 'Resolved');
      const recent = mine.filter((o) => Date.parse(o.created_at) > monthAgo);
      const minutes = rides.filter((r) => r.bike_id === b.id).reduce((s, r) => s + (r.duration_min ?? 0), 0);
      const reasons: string[] = [];
      let score = 0;
      const add = (points: number, reason: string) => {
        score += points;
        reasons.push(reason);
      };
      const plural = (n: number) => (n > 1 ? 's' : '');
      const count = (k: 'P1' | 'P2' | 'P3') => open.filter((o) => o.priority === k).length;
      const [p1, p2, p3] = [count('P1'), count('P2'), count('P3')];
      if (p1) add(10 * p1, `${p1} open unsafe (P1) report${plural(p1)}`);
      if (p2) add(5 * p2, `${p2} open P2 report${plural(p2)}`);
      if (p3) add(2 * p3, `${p3} open minor report${plural(p3)}`);
      if (recent.length >= 2) add(2 * recent.length, `${recent.length} reports in the last 30 days`);
      if (b.battery < 30) add(3, `lock battery ${b.battery}%`);
      if (score > 0 && minutes >= 120) add(Math.floor(minutes / 120), `${Math.round(minutes / 60)} h of riding in this period`);
      return { bikeId: b.id, score, reasons };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Bikes whose problems keep coming back: 3+ reports, or the same part reported twice or more. */
export function recurringProblems(orders: OrderRec[]): { bikeId: string; reports: number; part: string; partCount: number }[] {
  const byBike = new Map<string, OrderRec[]>();
  for (const o of orders) byBike.set(o.bike_id, [...(byBike.get(o.bike_id) ?? []), o]);
  return [...byBike.entries()]
    .map(([bikeId, list]) => {
      const parts = new Map<string, number>();
      for (const o of list) for (const p of issueParts(o.issue_title)) parts.set(p, (parts.get(p) ?? 0) + 1);
      const [part, partCount] = [...parts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
      return { bikeId, reports: list.length, part, partCount };
    })
    .filter((x) => x.reports >= 3 || x.partCount >= 2)
    .sort((a, b) => b.reports - a.reports);
}

export function buildInsights(input: {
  days: number;
  bikes: BikeRec[];
  rides: RideRec[];
  orders: OrderRec[];
  pendingApprovals: number;
  oldestPendingHours: number | null;
  /** At or below this lock battery (%) a bike is Unavailable */
  lowBattery: number;
}): Insight[] {
  const { days, bikes, rides, orders } = input;
  const out: Insight[] = [];

  // 1. Maintenance priority
  const top = maintenancePriority(bikes, orders, rides).slice(0, 3);
  if (top.length) {
    out.push({
      tone: top[0].score >= 10 ? 'urgent' : 'warn',
      title: `Fix first: ${top.map((t) => t.bikeId).join(', ')}`,
      detail: top.map((t) => `${t.bikeId} — ${t.reasons.join(', ')}`).join(' • '),
    });
  }

  // 2. Recurring problems
  const since = Date.now() - days * 24 * HOUR;
  for (const r of recurringProblems(orders.filter((o) => Date.parse(o.created_at) >= since)).slice(0, 3)) {
    out.push({
      tone: 'warn',
      title: `${r.bikeId} keeps having problems`,
      detail: `${r.reports} reports in the last ${days} days${r.partCount >= 2 ? `, ${r.partCount}× about ${r.part}` : ''}. A full overhaul${r.partCount >= 2 ? ` of the ${r.part.toLowerCase()}` : ''} may save repeat repairs.`,
    });
  }

  // 3. Peak hours vs. bikes available
  const byHour = ridesByHour(rides);
  const total = rides.length;
  if (total >= 5) {
    const peakHour = byHour.indexOf(Math.max(...byHour));
    const campusHours = byHour.map((n, h) => ({ h, n })).filter((x) => x.h >= 6 && x.h <= 18);
    const quiet = [...campusHours].sort((a, b) => a.n - b.n || a.h - b.h).slice(0, 2).map((x) => hourLabel(x.h));
    const ready = bikes.filter((b) => b.status === 'available' && b.battery > input.lowBattery).length;
    const peak = peakConcurrent(rides);
    const tight = peak.count >= Math.max(1, Math.ceil(ready * 0.8));
    out.push({
      tone: tight ? 'warn' : 'info',
      title: `Busiest hour: ${hourLabel(peakHour)}–${hourLabel((peakHour + 1) % 24)}`,
      detail:
        `${byHour[peakHour]} of ${total} rides started then. Up to ${peak.count} bikes were out at once; ${ready} are ready now. ` +
        (tight
          ? `That is close to the whole ready fleet — finish repairs and charge locks before ${hourLabel(peakHour)}, and schedule maintenance at quiet times (${quiet.join(', ')}).`
          : `There is spare capacity. Schedule maintenance at quiet times (${quiet.join(', ')}).`),
    });
  }

  // 4. Low lock batteries
  const low = bikes.filter((b) => b.battery <= input.lowBattery);
  const soon = bikes.filter((b) => b.battery > input.lowBattery && b.battery < 30);
  if (low.length || soon.length) {
    out.push({
      tone: low.length ? 'urgent' : 'warn',
      title: low.length ? `${low.length} bike${low.length > 1 ? 's' : ''} unavailable: low lock battery` : 'Lock batteries running low',
      detail: [
        low.length && `At ${input.lowBattery}% or lower: ${low.map((b) => `${b.id} (${b.battery}%)`).join(', ')}.`,
        soon.length && `Charge soon (under 30%): ${soon.map((b) => `${b.id} (${b.battery}%)`).join(', ')}.`,
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  // 5. Bikes nobody used
  const idle = bikes.filter((b) => b.status === 'available' && !rides.some((r) => r.bike_id === b.id));
  if (total >= 5 && idle.length) {
    out.push({
      tone: 'info',
      title: `${idle.length} available bike${idle.length > 1 ? 's were' : ' was'} never ridden`,
      detail: `${idle.map((b) => b.id).join(', ')} had no rides in ${days} days while available. Check the QR code and lock, or move ${idle.length > 1 ? 'them' : 'it'} to the front of the rack.`,
    });
  }

  // 6. Approval backlog
  if (input.pendingApprovals >= 10) {
    out.push({
      tone: input.pendingApprovals >= 50 ? 'urgent' : 'warn',
      title: `${input.pendingApprovals} riders waiting for identity approval`,
      detail: `The oldest has waited ${Math.round(input.oldestPendingHours ?? 0)} h. Use "Select all recommended" on Identity Approvals to approve the clear cases in one step.`,
    });
  }

  if (!out.length) out.push({ tone: 'info', title: 'Nothing needs attention', detail: `No open problems or low batteries in the last ${days} days.` });
  const rank = { urgent: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
