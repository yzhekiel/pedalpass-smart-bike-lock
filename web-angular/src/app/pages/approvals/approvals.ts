import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Profile } from '../../core/models';
import { RiderPhotos, RidersService } from '../../core/riders.service';
import { errorMessage } from '../../core/supabase-api.service';
import { ToastService } from '../../core/toast.service';

/** Riders waiting for the identity check: compare the selfie with the ID, check the COR, decide. */
@Component({
  selector: 'app-approvals',
  imports: [DatePipe, FormsModule],
  templateUrl: './approvals.html',
})
export class ApprovalsPage implements OnInit {
  private riders = inject(RidersService);
  private toast = inject(ToastService);

  protected readonly pending = signal<Profile[]>([]);
  protected readonly photos = signal<Record<string, RiderPhotos>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busy = signal('');
  protected readonly rejecting = signal<string | null>(null); // rider id
  protected readonly reason = signal('');
  protected readonly zoom = signal<string | null>(null);

  ngOnInit() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.riders.pending().subscribe({
      next: (rows) => {
        this.pending.set(rows);
        this.loading.set(false);
        // Each rider's photos load on their own, so one missing photo doesn't hold up the page
        for (const r of rows) {
          this.riders.photos(r.id).subscribe((p) => this.photos.update((all) => ({ ...all, [r.id]: p })));
        }
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected approve(rider: Profile) {
    this.decide(rider, true);
  }

  protected reject(rider: Profile) {
    if (!this.reason().trim()) return;
    this.decide(rider, false, this.reason().trim());
  }

  private decide(rider: Profile, approve: boolean, reason?: string) {
    this.busy.set(rider.id);
    this.riders.review(rider, approve, reason).subscribe({
      next: () => {
        this.busy.set('');
        this.rejecting.set(null);
        this.reason.set('');
        this.pending.update((list) => list.filter((p) => p.id !== rider.id));
        this.toast.success(`${rider.name} ${approve ? 'approved' : 'rejected'}.`);
      },
      error: (e) => {
        this.busy.set('');
        this.toast.error(`${rider.name}: ${errorMessage(e)}`);
      },
    });
  }
}
