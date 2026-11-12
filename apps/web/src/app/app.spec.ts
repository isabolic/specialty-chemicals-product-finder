import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('renders the shell with a link back to the search', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const brand = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(brand?.textContent).toContain('Product Finder');
    expect(brand?.getAttribute('href')).toBe('/products');
  });
});
