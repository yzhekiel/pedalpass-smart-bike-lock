import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Report } from '../../core/models';

/**
 * CHILD component — "Mark as fixed" (PARENT: ReportsPage). Maintenance has no account: they tell the
 * admin a bike is fixed, and the admin records it here. Sends { fixedBy, notes } up through `fixed`.
 */
@Component({
  selector: 'app-mark-fixed-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="!busy() && cancelled.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="submit()" #f="ngForm">
        <div>
          <h2>Mark as fixed</h2>
          <p class="small muted"><span class="mono">{{ report().id }}</span> • {{ report().bike_id }} • {{ report().issue_title }}</p>
        </div>
        <div class="field">
          <label for="by">Fixed by</label>
          <input id="by" name="by" class="input" [(ngModel)]="fixedBy" placeholder="Name of the maintenance person" />
        </div>
        <div class="field">
          <label for="notes">What was fixed</label>
          <textarea id="notes" name="notes" class="input" [(ngModel)]="notes" placeholder="e.g. replaced the front brake pads"></textarea>
        </div>
        <label class="row small">
          <input type="checkbox" name="ok" [(ngModel)]="confirmed" />
          Maintenance confirmed {{ report().bike_id }} is fixed and safe to ride.
        </label>
        <div class="row">
          <button type="button" class="btn grow" (click)="cancelled.emit()" [disabled]="busy()">Not fixed yet</button>
          <button type="submit" class="btn primary grow" [disabled]="!confirmed() || busy()">{{ busy() ? 'Saving…' : 'Mark as fixed' }}</button>
        </div>
        <p class="small muted">{{ report().bike_id }} becomes Available by itself unless it still has another open report.</p>
      </form>
    </div>
  `,
})
export class MarkFixedDialog {
  readonly report = input.required<Report>();
  readonly busy = input(false);
  readonly fixed = output<{ fixedBy: string; notes: string }>();
  readonly cancelled = output<void>();

  protected readonly fixedBy = signal('');
  protected readonly notes = signal('');
  protected readonly confirmed = signal(false);

  protected submit() {
    if (this.confirmed()) this.fixed.emit({ fixedBy: this.fixedBy(), notes: this.notes() });
  }
}
