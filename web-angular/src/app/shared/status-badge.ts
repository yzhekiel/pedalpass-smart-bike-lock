import { Component, computed, input } from '@angular/core';
import { Bike, STATUS_LABEL, shownStatus } from '../core/models';

/**
 * A bike's status as a coloured pill. The parent passes the bike in (input); the badge works out
 * what to show — an available bike at 20% lock battery or lower shows "Unavailable".
 */
@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [class]="status()" [title]="title()">{{ label() }}</span>`,
  host: { style: 'display: contents' },
})
export class StatusBadge {
  readonly bike = input.required<Pick<Bike, 'status' | 'battery'>>();

  protected readonly status = computed(() => shownStatus(this.bike()));
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
  protected readonly title = computed(() => (this.status() === 'unavailable' ? 'Lock battery 20% or lower' : ''));
}
