import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './shared/toasts';

/** Root component: the current route's page, plus the notification stack on top of every page. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts],
  template: `<router-outlet /><app-toasts />`,
})
export class App {}
