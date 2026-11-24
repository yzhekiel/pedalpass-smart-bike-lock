import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Portal pages need a signed-in admin; anyone else is sent to the login page. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.signedIn()) return of(true);
  // After a page refresh the saved session is checked once
  return auth.restore().pipe(map((p) => (p ? true : router.parseUrl('/login'))));
};
