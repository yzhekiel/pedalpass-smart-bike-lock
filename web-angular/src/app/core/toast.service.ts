import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

/** Short messages in the corner after an action ("BP-011 added", "Could not save: …"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 1;

  success(text: string) {
    this.show('success', text);
  }
  error(text: string) {
    this.show('error', text, 7000);
  }
  info(text: string) {
    this.show('info', text);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: Toast['kind'], text: string, ms = 4000) {
    const id = this.next++;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
