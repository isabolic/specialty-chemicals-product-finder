# Decisions

## 1. Architecture

```text
 nightly PIM export (CSV)
          │  import CLI (idempotent, transactional, audited)
          ▼
┌──────────────────┐     ┌─────────────────────────┐     ┌──────────────────────┐
│ PostgreSQL       │◄────│ NestJS API (/api)       │◄────│ Angular SPA (PrimeNG)│
│ products         │     │ ProductsModule          │     │ search page (URL =   │
│ reviews          │     │ ReviewsModule           │     │ state), detail page, │
│ import_runs      │     │ Prisma 7 + pg adapter   │     │ review form          │
└──────────────────┘     └─────────────────────────┘     └──────────────────────┘
```

- **Monorepo** (pnpm workspace): `apps/api` and `apps/web`, one Compose file. Both apps change together, and one command runs everything.
- **The PIM owns catalogue data; customers own reviews.** Only the import writes catalogue columns. Only the review flow writes reviews and the rating aggregate. Neither ever overwrites the other's data, which is why the import can re-run safely.
- **The import is a plain CLI**, not part of the API process. It is the same code that `docker compose up` runs on start-up and that a nightly job would run in production.
- `normalize.ts` is a pure function and holds every data decision; it is tested in isolation. `import-products.ts` only writes to the database.

## 2. Key decisions

| Decision | Alternatives considered | Why |
| --- | --- | --- |
| **Import: set-based upsert by SKU that skips unchanged rows** (`INSERT … ON CONFLICT … WHERE … IS DISTINCT FROM`), in one transaction under an advisory lock | `prisma.upsert` per row; delete everything and re-insert | Re-runs are no-ops (a second run reports "200 unchanged"), so `updated_at` stays meaningful. It takes one statement per 2,000 rows instead of 50k round trips. Delete-and-insert would cascade into reviews. |
| **Products are never deleted.** A SKU missing from the export gets `delisted_at` and is relisted if it returns | Hard delete; ignore missing SKUs | Reviews must survive. Shared links must keep working. Ignoring missing SKUs would recreate the "stale spreadsheet" problem. |
| **Import safety guard:** abort with no changes if the export would delist >50% of the catalogue (`--force` to override). There is also a `--dry-run` | Trust the file | A truncated nightly file would otherwise wipe the catalogue overnight. |
| **Only `ACTIVE` products are shown by default**, with an explicit "include phase-out and discontinued" toggle, a status badge and a notice on the detail page | Show everything with a badge | This is the business problem sales described. Opting in is the safest default. |
| **The URL is the single source of truth** for search, filters, sort and page | Component state plus a "copy link" button | Shareable links, the back button and reload all work without extra code. One pure, tested module translates between URL, UI and API. |
| **Search uses `ILIKE`** on name, SKU, chemistry and description, with wildcards escaped. **Offset pagination** with a stable SKU tie-breaker | Postgres full-text search, Elasticsearch; cursor pagination | Good enough for v1 and simple to reason about. At 50k products the next step is a `tsvector`/`pg_trgm` index in Postgres; Elasticsearch only if relevance or typo tolerance becomes a requirement. Offset pages are cheap at this size and give "page N" URLs that can be shared. |
| **Rating aggregate stored on the product** and recounted in the review transaction after `SELECT … FOR UPDATE` | Aggregate on every read; running average | Sorting by rating needs no aggregation. Recounting cannot drift, and the row lock serialises concurrent reviews (covered by a test). |
| **Angular 21 + PrimeNG 21.1.10 (MIT) instead of 22** | Angular 22 + PrimeNG 22 with a license key | PrimeNG 22 moved to the commercial *PrimeUI License*: it needs a key, shows a banner without one, and forbids removing that check. A company of BASF's size would need paid per-developer licences. PrimeNG 21.1.10 is the last MIT release and requires Angular 21, which is still supported. PrimeNG is pinned exactly so an update cannot pull in a different licence. |
| **Prisma 7.10.1** (stable), with raw SQL only where it matters | Prisma 8 (only a release candidate when this was built); a query builder | Type-safe CRUD for most of the code. Raw SQL for the bulk upsert and the row lock, which Prisma cannot express. |
| **Mobile-first UI**: cards, filters in a bottom drawer on phones and a sidebar on desktop, native share sheet | Data table | Customers use the app at trade fairs. An 8-column table does not work at 390px. |

## 3. Assumptions

- **Data quality.** The sample export contains real-world problems, and the import handles each one explicitly. Every fix is recorded in `import_runs.issues` for the PIM team:

  | In `products.csv` | Handling |
  | --- | --- |
  | Status `active` / `ACTIVE` / `Phase out` | Normalised to `ACTIVE / PHASE_OUT / DISCONTINUED`. An unknown status rejects the row (guessing could show a discontinued product as available), and the existing data stays untouched. |
  | Duplicate SKU `P-10013` (identical) / `P-10151` (Active, then Discontinued) | The last row wins, with a warning. **Assumes the export is chronological; to confirm with the PIM owners.** |
  | Empty name (`P-10119`) | The SKU is used as the name, with a warning. Not `chemical_name`: customers would read it as a trade name, and many products share the same chemistry. |
  | `" EMEA "`, `"  Puraxin SF 120 "` | All fields are trimmed, otherwise filters would show duplicate values. |
  | Launch year `n/a` or empty | Stored as `null`. |

- **SKU is the stable business key** in the PIM, and SKUs are not reused for different products.
- The **nightly export is delivered as a file**. Delivery (SFTP, blob storage) and scheduling belong to the environment, not to the app.
- **Phase-out products are still sellable** but should not be the default answer. Reviews are allowed for phase-out and discontinued products (that experience is still useful), but not for delisted ones.
- **Reviews without authentication.** Authors give a display name only, with no e-mail or other personal data, so there is nothing to protect under GDPR beyond the free text itself.
- **English-only UI** for v1. Product data comes in English from the PIM.

## 4. Risks and how they are addressed

| Risk | Mitigation now | Next step |
| --- | --- | --- |
| Truncated or corrupt export wipes the catalogue | Header validation, a single transaction, the >50% delisting guard, `--dry-run`, the audit trail | Alerting when an import fails or produces many warnings |
| Spam or fake reviews (public, unauthenticated) | Validation, length limits, 5 posts per minute per IP, plain-text rendering (no XSS), no editing | Authentication or verified customers, moderation, captcha. Per-IP limits do not stop distributed spam |
| Rate limiter is in memory, so with several API instances each instance has its own limit | Acceptable for a single instance | Redis-backed throttler storage |
| Search performance at 50k products | Indexed filters, a GIN index on certifications, page size capped at 50 | Full-text or trigram index; load test |
| Hand-maintained API types drift between web and API | One types file, HTTP integration tests | OpenAPI spec and a generated client |
| Migrations run on API start-up (fine for one instance, a race with several) | Single instance in Compose | Run migrations as a separate deployment job |
| PIM data mistakes reach customers immediately | Issues logged per run | Quality report to the PIM team; block publishing on critical errors |

## 5. Deliberately left out, and next steps to production

**Left out for v1:** authentication, moderation, i18n, Elasticsearch, side-by-side product comparison, filter counts that react to the current selection, relevance ranking, scheduled import (it is a CLI; the scheduler belongs to the platform), observability, CI.

**To take this to production:**

1. A CI pipeline (lint, unit and integration tests against Postgres, image build) and separate migration and import jobs, with the import scheduled nightly.
2. Production images: multi-stage builds, no dev dependencies, non-root user, health and readiness checks.
3. Observability: structured logs, metrics for import runs and API latency, alerts on failed imports.
4. Postgres full-text or trigram search and a load test at 50k products.
5. Review integrity: authentication or verified purchases, moderation and reporting, a Redis-backed rate limit.
6. An OpenAPI contract and generated client, and e2e tests for the critical flows (search → detail → review).
7. Accessibility audit (WCAG 2.1 AA) and caching of filter options.
