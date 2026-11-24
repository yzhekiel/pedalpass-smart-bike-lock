import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Adds Supabase's API key to every request to the database, plus the signed-in admin's token
 * (the database's security rules use it to know who is asking). A token about to expire is renewed first.
 */
export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  if (!req.url.startsWith(environment.supabaseUrl)) return next(req);

  const auth = inject(AuthService);
  const withKey = (token?: string) =>
    req.clone({
      setHeaders: {
        apikey: environment.supabaseKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  // Sign-in and token renewal must not carry an old token
  if (req.url.includes('/auth/v1/token')) return next(withKey());

  const session = auth.session();
  if (!session) return next(withKey());
  if (auth.expiresSoon(session)) {
    return auth.refresh().pipe(switchMap((fresh) => next(withKey(fresh.access_token))));
  }
  return next(withKey(session.access_token));
};
