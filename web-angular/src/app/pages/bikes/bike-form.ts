import { Component, OnInit, inject, input, output } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Bike } from '../../core/models';
import { BikeInput, STATION } from '../../core/bikes.service';

/** The scanner in the mobile app reads bike codes in this form (mobile/src/services/lockService.ts). */
const BIKE_CODE = /^BP-\d{3}$/;

/** A code that another bike already uses. */
const uniqueCode = (taken: string[]): ValidatorFn => (c: AbstractControl): ValidationErrors | null =>
  taken.includes(String(c.value).trim().toUpperCase()) ? { taken: true } : null;

/**
 * CHILD component — the Add / Edit bike window (PARENT: BikesPage).
 * Parent → child: `bike` (null = add a new bike), `takenCodes`, `saving`.
 * Child → parent: `saved` with the checked values, or `cancelled`. The parent does the API call,
 * so this form stays a plain, reusable piece of UI.
 */
@Component({
  selector: 'app-bike-form',
  imports: [ReactiveFormsModule],
  templateUrl: './bike-form.html',
})
export class BikeForm implements OnInit {
  readonly bike = input<Bike | null>(null);
  readonly takenCodes = input<string[]>([]);
  readonly suggestedCode = input('BP-001');
  readonly saving = input(false);

  readonly saved = output<BikeInput>();
  readonly cancelled = output<void>();

  protected readonly station = STATION;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    id: ['', [Validators.required, Validators.pattern(BIKE_CODE)]],
    node_id: ['', Validators.required],
    bay: ['', Validators.required],
    model: ['DYCI Campus Cruiser', Validators.required],
    battery: [100, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  ngOnInit() {
    const b = this.bike();
    if (b) {
      // Editing: the code is the bike's identity (it is on the printed QR), so it can't change
      this.form.patchValue(b);
      this.form.controls.id.disable();
    } else {
      const n = this.suggestedCode().slice(3);
      this.form.patchValue({ id: this.suggestedCode(), node_id: `PP-LOCK-${n}`, bay: `Bay ${n.slice(1)}` });
      this.form.controls.id.addValidators(uniqueCode(this.takenCodes()));
    }
  }

  protected bad(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saved.emit({
      id: v.id.trim().toUpperCase(),
      node_id: v.node_id.trim().toUpperCase(),
      bay: v.bay.trim(),
      model: v.model.trim(),
      battery: Number(v.battery),
    });
  }
}
