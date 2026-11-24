import { Component, computed, input, output } from '@angular/core';
import { Bike, LOW_BATTERY } from '../../core/models';
import { StatusBadge } from '../../shared/status-badge';

/**
 * CHILD component — one bike in the Bikes table (PARENT: BikesPage).
 * Parent → child: the bike comes in through an input().
 * Child → parent: button presses go out through output()s; the parent decides what to do
 * (open the history page, open the edit form, ask to confirm removal). This row never calls the API.
 */
@Component({
  selector: 'tr[appBikeRow]',
  imports: [StatusBadge],
  template: `
    <td>
      <strong>{{ bike().id }}</strong>
      <div class="small muted">{{ bike().node_id }} • {{ bike().bay }}</div>
    </td>
    <td [class.low]="lowBattery()">{{ bike().battery }}%</td>
    <td><app-status-badge [bike]="bike()" /></td>
    <td class="muted">{{ bike().status === 'in_use' ? 'Unlocked' : 'Locked' }}</td>
    <td class="actions">
      <button class="btn small" (click)="history.emit(bike().id)"><span class="icon">history</span> History</button>
      <button class="btn small" (click)="edit.emit(bike())"><span class="icon">edit</span> Edit</button>
      <button
        class="btn small danger"
        [disabled]="bike().status === 'in_use'"
        [title]="bike().status === 'in_use' ? 'Out on a ride — remove it after it is returned' : 'Remove ' + bike().id"
        (click)="remove.emit(bike())"
      >
        <span class="icon">delete</span> Remove
      </button>
    </td>
  `,
  styles: `
    .low { color: var(--red); font-weight: 700; }
    .actions { text-align: right; white-space: nowrap; }
    .actions .btn { margin-left: 6px; }
  `,
})
export class BikeRow {
  /** The bike to show (from the parent). */
  readonly bike = input.required<Bike>();

  /** "Show this bike's history" — sends the bike code up. */
  readonly history = output<string>();
  /** "Edit this bike" — sends the bike up. */
  readonly edit = output<Bike>();
  /** "Remove this bike" — sends the bike up; the parent asks for confirmation. */
  readonly remove = output<Bike>();

  protected readonly lowBattery = computed(() => this.bike().battery <= LOW_BATTERY);
}
