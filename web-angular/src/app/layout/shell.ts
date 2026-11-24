import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';

/** Sidebar + top bar around every portal page; the page itself renders in <router-outlet>. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { path: '/bikes', label: 'Bikes', icon: 'pedal_bike' },
    { path: '/reports', label: 'Reports', icon: 'list_alt' },
    { path: '/approvals', label: 'Approvals', icon: 'how_to_reg' },
    { path: '/activity', label: 'Activity Log', icon: 'receipt_long' },
  ];

  protected readonly menuOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly profile = this.auth.profile;
  protected readonly initial = computed(() => this.profile()?.name.charAt(0).toUpperCase() ?? '?');

  /** The current page's title, from the route's data ({ title: 'Bikes' }). */
  protected readonly title = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.deepestTitle()),
    ),
    { initialValue: this.deepestTitle() },
  );

  protected signOut() {
    this.auth.signOut();
    this.router.navigateByUrl('/login');
  }

  private deepestTitle(): string {
    // During the very first navigation the child page isn't activated yet, so its snapshot can be missing
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    return r.snapshot?.data?.['title'] ?? 'PedalPass';
  }
}
