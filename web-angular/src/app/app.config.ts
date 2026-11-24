import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route parameters such as /bikes/:id are passed to the page as inputs
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient for the Supabase API; every request goes through the auth interceptor
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
