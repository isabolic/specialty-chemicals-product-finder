import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="app-header">
      <a routerLink="/products" class="app-header__brand">Product Finder</a>
    </header>
    <main class="app-main">
      <router-outlet />
    </main>
  `,
  styles: `
    .app-header {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--p-content-border-color);
      background: var(--p-content-background);
    }
    .app-header__brand {
      font-weight: 600;
      font-size: 1.125rem;
      color: inherit;
      text-decoration: none;
    }
    .app-main {
      max-width: 72rem;
      margin: 0 auto;
      padding: 1rem;
    }
  `,
})
export class App {}
