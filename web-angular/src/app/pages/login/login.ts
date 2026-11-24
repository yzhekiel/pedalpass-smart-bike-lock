import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Admin sign-in. A reactive form checks the fields before anything is sent. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly mascotShaking = signal(false);

  /** Restarts the mascot shake on every click. */
  protected shakeMascot() {
    this.mascotShaking.set(false);
    requestAnimationFrame(() => this.mascotShaking.set(true));
  }

  /** True when a field was touched and is invalid (shows its message). */
  protected bad(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.signIn(email, password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (e: Error) => {
        this.error.set(e.message);
        this.loading.set(false);
      },
    });
  }
}
