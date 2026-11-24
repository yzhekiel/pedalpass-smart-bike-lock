import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACTION_LABEL, ActivityService } from '../../core/activity.service';
import { ActivityEntry } from '../../core/models';
import { errorMessage } from '../../core/supabase-api.service';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Everything that happened, written by the database (it can't be edited). */
@Component({
  selector: 'app-activity',
  imports: [DatePipe, FormsModule],
  templateUrl: './activity.html',
})
export class ActivityPage implements OnInit {
  private activity = inject(ActivityService);

  protected readonly from = signal(isoDay(new Date(Date.now() - 7 * 86400000)));
  protected readonly to = signal(isoDay(new Date()));
  protected readonly bike = signal('');
  protected readonly search = signal('');
  protected readonly rows = signal<ActivityEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly label = ACTION_LABEL;

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) =>
      [r.user_name, r.actor_name, r.details, r.bike_id, r.status, ACTION_LABEL[r.action]].join(' ').toLowerCase().includes(q),
    );
  });

  ngOnInit() {
    this.load();
  }

  /** Runs on start and whenever the dates or bike filter change. */
  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.activity.list(this.from(), this.to(), this.bike().trim() || undefined).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
