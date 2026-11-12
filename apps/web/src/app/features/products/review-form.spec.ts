import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Review } from '../../core/api.types';
import { ReviewForm } from './review-form';

describe('ReviewForm', () => {
  let fixture: ComponentFixture<ReviewForm>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ReviewForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReviewForm);
    fixture.componentRef.setInput('sku', 'P-1');
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const form = () => (fixture.componentInstance as unknown as { form: ReviewForm['form'] }).form;
  const submitButton = () => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  async function fillValid(): Promise<void> {
    form().setValue({ rating: 4, authorName: 'Ana', title: '', body: 'Great thickener.' });
    await fixture.whenStable();
  }

  it('cannot be submitted without rating, name and text', async () => {
    form().setValue({ rating: 0, authorName: '   ', title: '', body: 'x' });
    await fixture.whenStable();
    expect(submitButton().disabled).toBe(true);
  });

  it('posts the review, omits an empty title, resets and emits', async () => {
    const created: Review[] = [];
    fixture.componentInstance.created.subscribe((r) => created.push(r));
    await fillValid();

    submitButton().click();
    const req = http.expectOne('/api/products/P-1/reviews');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ rating: 4, authorName: 'Ana', body: 'Great thickener.' });

    const review: Review = { id: '1', rating: 4, authorName: 'Ana', title: null, body: 'Great thickener.', createdAt: '2026-11-12T10:00:00Z' };
    req.flush(review);
    await fixture.whenStable();

    expect(created).toEqual([review]);
    expect(form().getRawValue().body).toBe('');
  });

  it('explains rate limiting in plain language', async () => {
    await fillValid();
    submitButton().click();
    http.expectOne('/api/products/P-1/reviews').flush({}, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Please wait a minute');
  });
});
