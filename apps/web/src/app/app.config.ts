import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    // Route params and query params bind straight to component inputs;
    // the URL is the single source of truth for what the user is looking at.
    provideRouter(routes, withComponentInputBinding()),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } }),
  ],
};
