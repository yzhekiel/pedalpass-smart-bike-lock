import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

/** The stack of success / error messages in the corner (see ToastService). */
@Component({
  selector: 'app-toasts',
  template: `
    <div class="stack" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" role="status">
          <span class="icon filled">
            @switch (t.kind) {
              @case ('success') { check_circle }
              @case ('error') { error }
              @default { info }
            }
          </span>
          <span class="grow">{{ t.text }}</span>
          <button class="close" (click)="toasts.dismiss(t.id)" aria-label="Close"><span class="icon">close</span></button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; right: 20px; bottom: 20px; z-index: 60; display: grid; gap: 10px; width: min(380px, calc(100vw - 32px)); }
    .toast {
      display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px;
      background: var(--surface-2); border: 1px solid var(--line); box-shadow: 0 12px 30px rgba(0,0,0,.45);
    }
    .toast.success .icon { color: var(--green); }
    .toast.error { border-color: var(--red); }
    .toast.error .icon { color: var(--red); }
    .toast.info .icon { color: var(--blue); }
    .close { background: none; border: 0; color: var(--muted); cursor: pointer; padding: 0; }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
