import { Component, effect, input, signal } from '@angular/core';
import QRCode from 'qrcode';

/** Draws a QR code picture from its text (e.g. 'PEDALPASS:BP-001:<code>'), always on white so phones can scan it. */
@Component({
  selector: 'app-qr-image',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="'QR code for ' + label()" [width]="size()" [height]="size()" />
    } @else {
      <div class="spinner"></div>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; justify-content: center; background: #fff; border-radius: 14px; padding: 10px; }
    img { display: block; }
  `,
})
export class QrImage {
  readonly payload = input.required<string>();
  readonly label = input('bike');
  readonly size = input(200);
  protected readonly src = signal('');

  constructor() {
    // Redraw whenever the parent passes a new code (after Regenerate)
    effect(() => {
      QRCode.toDataURL(this.payload(), { width: this.size() * 2, margin: 1 }).then((url) => this.src.set(url));
    });
  }
}
