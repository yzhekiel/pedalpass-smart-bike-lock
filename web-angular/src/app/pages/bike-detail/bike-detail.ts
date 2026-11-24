import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import QRCode from 'qrcode';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Bike, BikeQr, Profile, REPORT_STEP_LABEL, Report, Ride } from '../../core/models';
import { BikesService } from '../../core/bikes.service';
import { RidersService } from '../../core/riders.service';
import { SupabaseApi, errorMessage } from '../../core/supabase-api.service';
import { ToastService } from '../../core/toast.service';
import { QrImage } from '../../shared/qr-image';
import { StatusBadge } from '../../shared/status-badge';

/**
 * One bike's page (route /bikes/:id): its details and QR code, who rode it, and its reports.
 * The `id` input is filled from the URL by the router (withComponentInputBinding).
 */
@Component({
  selector: 'app-bike-detail',
  imports: [DatePipe, RouterLink, QrImage, StatusBadge],
  templateUrl: './bike-detail.html',
})
export class BikeDetailPage implements OnInit {
  readonly id = input.required<string>();

  private bikesApi = inject(BikesService);
  private riders = inject(RidersService);
  private api = inject(SupabaseApi);
  private toast = inject(ToastService);

  protected readonly bike = signal<Bike | null>(null);
  protected readonly qr = signal<BikeQr | null>(null);
  protected readonly rides = signal<Ride[]>([]);
  protected readonly reports = signal<Report[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly stepLabel = REPORT_STEP_LABEL;

  // Rider details window
  protected readonly rider = signal<Profile | null>(null);
  protected readonly riderPhoto = signal<string | null | undefined>(undefined);

  /** The QR as a PNG data URL, for Download and Print (redrawn after Regenerate). */
  protected readonly qrSrc = signal('');

  constructor() {
    effect(() => {
      const q = this.qr();
      if (q) QRCode.toDataURL(q.payload, { width: 520, margin: 2 }).then((url) => this.qrSrc.set(url));
    });
  }

  protected readonly openReports = computed(() => this.reports().filter((r) => r.status !== 'Resolved').length);
  protected readonly onHold = computed(() => ['inspection', 'maintenance'].includes(this.bike()?.status ?? ''));

  ngOnInit() {
    this.load();
  }

  protected load() {
    const id = this.id().toUpperCase();
    this.loading.set(true);
    this.error.set('');
    // Four requests at once; forkJoin waits for all of them
    forkJoin({
      bike: this.bikesApi.get(id),
      rides: this.bikesApi.rides(id),
      reports: this.bikesApi.reports(id),
      codes: this.bikesApi.qrCodes(),
    }).subscribe({
      next: ({ bike, rides, reports, codes }) => {
        if (!bike) this.error.set(`There is no bike ${id}.`);
        this.bike.set(bike ?? null);
        this.rides.set(rides);
        this.reports.set(reports);
        this.qr.set(codes.find((c) => c.bike_id === id) ?? null);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected regenerate() {
    const b = this.bike();
    if (!b || !confirm(`Make a new QR code for ${b.id}?\n\nThe QR code on the bike now stops working right away.`)) return;
    this.busy.set(true);
    this.bikesApi.regenerateQr(b.id).subscribe({
      next: (payload) => {
        this.qr.update((q) => (q ? { ...q, payload, version: q.version + 1 } : q));
        this.busy.set(false);
        this.toast.success(`New QR code for ${b.id}. Print it and replace the old sticker.`);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(`Could not regenerate: ${errorMessage(e)}`);
      },
    });
  }

  protected makeAvailable() {
    const b = this.bike();
    if (!b || !confirm(`Make ${b.id} available to riders again?`)) return;
    this.bikesApi.makeAvailable(b.id).subscribe({
      next: ([saved]) => {
        this.bike.set(saved);
        this.toast.success(`${b.id} is available again.`);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  protected print() {
    const q = this.qr();
    const src = this.qrSrc();
    if (!q || !src) return;
    const win = window.open('', '_blank');
    if (!win) {
      this.toast.error('Allow pop-ups for this site to print the QR code.');
      return;
    }
    win.document.write(
      `<!doctype html><title>${q.bike_id} QR</title><body style="font-family:sans-serif;text-align:center;padding:40px">` +
        `<img src="${src}" style="width:260px"><h1>${q.bike_id}</h1><p>PedalPass • Scan to unlock • v${q.version}</p>` +
        `<script>onload = () => print()</script></body>`,
    );
    win.document.close();
  }

  protected downloadName = computed(() => `${this.qr()?.bike_id}-qr-v${this.qr()?.version}.png`);

  protected viewRider(userId: string) {
    this.riderPhoto.set(undefined);
    this.api.select<Profile>('profiles', '*', { id: `eq.${userId}` }).subscribe({
      next: ([p]) => this.rider.set(p ?? null),
      error: (e) => this.toast.error(errorMessage(e)),
    });
    this.riders.photos(userId).subscribe((photos) => this.riderPhoto.set(photos['id.jpg'] ?? null));
  }
}
