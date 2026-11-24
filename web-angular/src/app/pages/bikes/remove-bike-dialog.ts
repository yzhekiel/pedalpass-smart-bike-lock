import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Bike } from '../../core/models';

/**
 * CHILD component — "Remove BP-016?" confirmation (PARENT: BikesPage).
 * The admin must type the bike code; only then can `confirmed` be sent up to the parent.
 */
@Component({
  selector: 'app-remove-bike-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="!busy() && cancelled.emit()">
      <div class="dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <h2>Remove {{ bike().id }}?</h2>
        <ul class="muted small">
          <li>It disappears from the Bikes list and the mobile app.</li>
          <li>Its QR code stops working right away.</li>
          <li>If it was ever ridden or reported, its history is kept.</li>
        </ul>
        <div class="field">
          <label for="confirm">Type <strong class="mono">{{ bike().id }}</strong> to confirm</label>
          <!-- two-way binding: the input and the typed signal stay in sync -->
          <input id="confirm" class="input mono" [(ngModel)]="typed" [placeholder]="bike().id" />
        </div>
        <div class="row">
          <button class="btn grow" (click)="cancelled.emit()" [disabled]="busy()">Cancel</button>
          <button class="btn solid-danger grow" [disabled]="typed().trim().toUpperCase() !== bike().id || busy()" (click)="confirmed.emit(bike())">
            {{ busy() ? 'Removing…' : 'Remove bike' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RemoveBikeDialog {
  readonly bike = input.required<Bike>();
  readonly busy = input(false);
  readonly confirmed = output<Bike>();
  readonly cancelled = output<void>();
  protected readonly typed = signal('');
}
