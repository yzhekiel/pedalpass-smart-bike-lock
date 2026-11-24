import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BikesService } from '../../core/bikes.service';
import { Bike, Report, STATUS_LABEL, ShownStatus, shownStatus } from '../../core/models';
import { ReportsService } from '../../core/reports.service';
import { SupabaseApi, errorMessage } from '../../core/supabase-api.service';
import { ReportStepPipe } from '../../shared/report-step.pipe';

/** Order and colour of the fleet status bar (each status also shows its name and count). */
const STATUS_ORDER: ShownStatus[] = ['available', 'unavailable', 'in_use', 'inspection', 'maintenance', 'locked'];
const STATUS_COLOR: Record<ShownStatus, string> = {
  available: '#4ade80',
  unavailable: '#fb923c',
  in_use: '#7f9cf3',
  inspection: '#f5b82e',
  maintenance: '#ff6b6b',
  locked: '#8a8a96',
};

/** PedalPass at a glance. */
@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, ReportStepPipe],
  templateUrl: './dashboard.html',
  styles: `
    .bar { display: flex; gap: 3px; height: 34px; border-radius: 10px; overflow: hidden; }
    .bar span { display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #111114; min-width: 14px; }
    .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .track { height: 10px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
    .fill { height: 100%; border-radius: 999px; background: var(--blue); }
  `,
})
export class DashboardPage implements OnInit {
  private bikesApi = inject(BikesService);
  private reportsApi = inject(ReportsService);
  private api = inject(SupabaseApi);

  protected readonly bikes = signal<Bike[]>([]);
  protected readonly reports = signal<Report[]>([]);
  protected readonly rides30 = signal(0);
  protected readonly ridesToday = signal(0);
  protected readonly waiting = signal(0);
  protected readonly usage = signal<{ id: string; rides: number }[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly ready = computed(() => this.bikes().filter((b) => shownStatus(b) === 'available').length);
  protected readonly openReports = computed(() => this.reports().filter((r) => r.status !== 'Resolved'));
  protected readonly fleet = computed(() => {
    const total = this.bikes().length || 1;
    return STATUS_ORDER.map((s) => {
      const n = this.bikes().filter((b) => shownStatus(b) === s).length;
      return { status: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s], count: n, pct: Math.round((n / total) * 100) };
    }).filter((x) => x.count > 0);
  });

  ngOnInit() {
    this.load();
  }

  protected load() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthAgo = new Date(today.getTime() - 29 * 86400000).toISOString();
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      bikes: this.bikesApi.list(),
      reports: this.reportsApi.list(),
      rides: this.api.select<{ bike_id: string; started_at: string }>('rides', 'bike_id,started_at', { started_at: `gte.${monthAgo}` }),
      waiting: this.api.count('profiles', { verification_status: 'eq.pending_review' }),
    }).subscribe({
      next: ({ bikes, reports, rides, waiting }) => {
        this.bikes.set(bikes);
        this.reports.set(reports);
        this.rides30.set(rides.length);
        this.ridesToday.set(rides.filter((r) => Date.parse(r.started_at) >= today.getTime()).length);
        this.waiting.set(waiting);
        const perBike = new Map<string, number>();
        for (const r of rides) perBike.set(r.bike_id, (perBike.get(r.bike_id) ?? 0) + 1);
        this.usage.set([...perBike].map(([id, n]) => ({ id, rides: n })).sort((a, b) => b.rides - a.rides).slice(0, 5));
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected barWidth(rides: number): number {
    return (rides / Math.max(1, ...this.usage().map((u) => u.rides))) * 100;
  }
}
