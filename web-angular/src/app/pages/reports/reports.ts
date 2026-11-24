import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Priority, Report, ReportStatus } from '../../core/models';
import { ReportsService } from '../../core/reports.service';
import { errorMessage } from '../../core/supabase-api.service';
import { ToastService } from '../../core/toast.service';
import { ReportStepPipe } from '../../shared/report-step.pipe';
import { MarkFixedDialog } from './mark-fixed-dialog';

/** Every problem riders reported, from New to Fixed. */
@Component({
  selector: 'app-reports',
  imports: [DatePipe, FormsModule, RouterLink, ReportStepPipe, MarkFixedDialog],
  templateUrl: './reports.html',
})
export class ReportsPage implements OnInit {
  private reportsApi = inject(ReportsService);
  private toast = inject(ToastService);

  protected readonly reports = signal<Report[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly tab = signal<'open' | 'fixed' | 'all'>('open');
  protected readonly search = signal('');
  protected readonly priority = signal<'all' | Priority>('all');
  protected readonly steps: ReportStatus[] = ['Reported / Queued', 'Under Inspection', 'Scheduled for Overhaul'];

  protected readonly fixing = signal<Report | null>(null);
  protected readonly busy = signal('');

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.reports().filter(
      (r) =>
        (this.tab() === 'all' || (this.tab() === 'open') === (r.status !== 'Resolved')) &&
        (this.priority() === 'all' || r.priority === this.priority()) &&
        (!q || `${r.id} ${r.bike_id} ${r.issue_title} ${r.reported_by} ${r.assigned_tech ?? ''}`.toLowerCase().includes(q)),
    );
  });
  protected readonly openCount = computed(() => this.reports().filter((r) => r.status !== 'Resolved').length);
  protected readonly unsafeCount = computed(() => this.reports().filter((r) => r.status !== 'Resolved' && r.priority === 'P1').length);
  protected readonly newCount = computed(() => this.reports().filter((r) => r.status === 'Reported / Queued').length);

  ngOnInit() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.reportsApi.list().subscribe({
      next: (rows) => {
        this.reports.set(rows);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected setStep(report: Report, status: ReportStatus) {
    this.busy.set(report.id);
    this.reportsApi.setStatus(report.id, status).subscribe({
      next: (saved) => {
        this.replace(saved);
        this.busy.set('');
        this.toast.success(`${report.id} updated.`);
      },
      error: (e) => {
        this.busy.set('');
        this.toast.error(`Could not update ${report.id}: ${errorMessage(e)}`);
        this.load(); // put the dropdown back to the saved value
      },
    });
  }

  /** MarkFixedDialog's `fixed` output. */
  protected markFixed(report: Report, v: { fixedBy: string; notes: string }) {
    this.busy.set(report.id);
    this.reportsApi.markFixed(report.id, v.fixedBy, v.notes).subscribe({
      next: (saved) => {
        this.replace(saved);
        this.busy.set('');
        this.fixing.set(null);
        this.toast.success(`${report.id} marked fixed.`);
      },
      error: (e) => {
        this.busy.set('');
        this.toast.error(`Could not save: ${errorMessage(e)}`);
      },
    });
  }

  private replace(saved: Report) {
    this.reports.update((list) => list.map((r) => (r.id === saved.id ? saved : r)));
  }
}
