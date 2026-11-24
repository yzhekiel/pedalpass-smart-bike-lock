import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Bike, BikeQr, STATUS_LABEL, ShownStatus, shownStatus } from '../../core/models';
import { BikeInput, BikesService } from '../../core/bikes.service';
import { errorMessage } from '../../core/supabase-api.service';
import { ToastService } from '../../core/toast.service';
import { QrImage } from '../../shared/qr-image';
import { BikeForm } from './bike-form';
import { BikeRow } from './bike-row';
import { RemoveBikeDialog } from './remove-bike-dialog';

/**
 * PARENT component — the fleet. It owns the data and every API call; its children (BikeRow,
 * BikeForm, RemoveBikeDialog) only show things and report what the admin clicked, through outputs.
 */
@Component({
  selector: 'app-bikes',
  imports: [FormsModule, BikeRow, BikeForm, RemoveBikeDialog, QrImage],
  templateUrl: './bikes.html',
})
export class BikesPage implements OnInit {
  private bikesApi = inject(BikesService);
  private toast = inject(ToastService);
  private router = inject(Router);

  protected readonly bikes = signal<Bike[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  // Search and filter (two-way bound to the inputs with [(ngModel)])
  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | ShownStatus>('all');
  protected readonly statusOptions = Object.entries(STATUS_LABEL) as [ShownStatus, string][];

  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.bikes().filter(
      (b) =>
        (this.statusFilter() === 'all' || shownStatus(b) === this.statusFilter()) &&
        (!q || `${b.id} ${b.node_id} ${b.bay} ${b.model}`.toLowerCase().includes(q)),
    );
  });

  // Dialog state
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Bike | null>(null);
  protected readonly removing = signal<Bike | null>(null);
  protected readonly saving = signal(false);
  protected readonly newQr = signal<BikeQr | null>(null);

  protected readonly takenCodes = computed(() => this.bikes().map((b) => b.id));
  protected readonly nextCode = computed(() => {
    const used = this.bikes().map((b) => Number(b.id.match(/^BP-(\d{3})$/)?.[1] ?? 0));
    return `BP-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
  });

  ngOnInit() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.bikesApi.list().subscribe({
      next: (rows) => {
        this.bikes.set(rows);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  // ----- Reacting to the children's outputs -----

  protected openHistory(id: string) {
    this.router.navigate(['/bikes', id]);
  }

  protected openAdd() {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(bike: Bike) {
    this.editing.set(bike);
    this.formOpen.set(true);
  }

  /** BikeForm's `saved` output: add a new bike, or save changes to the one being edited. */
  protected save(input: BikeInput) {
    const editing = this.editing();
    this.saving.set(true);
    const request = editing
      ? this.bikesApi.update(editing.id, { model: input.model, bay: input.bay, node_id: input.node_id, battery: input.battery })
      : this.bikesApi.add(input);

    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (editing) {
          this.bikes.update((list) => list.map((b) => (b.id === saved.id ? saved : b)));
          this.toast.success(`${saved.id} updated.`);
        } else {
          this.bikes.update((list) => [...list, saved].sort((a, b) => a.id.localeCompare(b.id)));
          this.toast.success(`${saved.id} added.`);
          this.showNewQr(saved.id);
        }
      },
      error: (e) => {
        this.saving.set(false);
        const m = errorMessage(e);
        this.toast.error(m.includes('duplicate') ? `${input.id} already exists.` : `Could not save: ${m}`);
      },
    });
  }

  /** RemoveBikeDialog's `confirmed` output. */
  protected remove(bike: Bike) {
    this.saving.set(true);
    this.bikesApi.remove(bike.id).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.removing.set(null);
        this.bikes.update((list) => list.filter((b) => b.id !== bike.id));
        this.toast.success(
          result === 'deleted'
            ? `${bike.id} was never used, so it was deleted.`
            : `${bike.id} removed. Its QR code no longer works; its history is kept.`,
        );
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(`Could not remove ${bike.id}: ${errorMessage(e)}`);
      },
    });
  }

  /** After adding a bike: show its new QR code to print. */
  private showNewQr(id: string) {
    this.bikesApi.qrCodes().subscribe({
      next: (codes) => this.newQr.set(codes.find((c) => c.bike_id === id) ?? null),
      error: () => this.toast.info(`Open ${id}'s history page to print its QR code.`),
    });
  }
}
