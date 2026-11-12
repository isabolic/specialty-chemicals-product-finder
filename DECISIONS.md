# Decisions

## Assumptions: data quality in the PIM export

The sample export has the following problems. The import fixes what it safely can and records every fix as an issue in `import_runs`, so the PIM team can correct the data at its source.

| Problem in `products.csv` | Decision | Why |
| --- | --- | --- |
| Empty product name (`P-10119`) | Import the product and use the **SKU** as its name, with a `MISSING_NAME` warning | Skipping the row would hide a sellable product. `chemical_name` was the obvious fallback, but customers would read it as the trade name, and many products share the same chemistry (e.g. several "Bentonite" products). The SKU is clearly a placeholder, is unique, and can be searched. |
| Inconsistent status (`active`, `ACTIVE`, `Phase out`) | Map known variants to `ACTIVE / PHASE_OUT / DISCONTINUED`. **Reject** rows with an unknown status and leave the existing data as it is | Guessing could show a discontinued product as available, which is the exact problem sales complained about. |
| Duplicate SKU, same data (`P-10013`) | Keep one row and record a `DUPLICATE_SKU` issue | Harmless. |
| Duplicate SKU, different data (`P-10151`: Active, then Discontinued) | **The last row wins**, with a `CONFLICTING_DUPLICATE_SKU` warning | Assumes the export is appended in chronological order. Needs to be confirmed with the PIM owners. |
| Leading/trailing whitespace (`" EMEA "`) | Trim every field | Otherwise the region filters would show duplicate values. |
| Invalid launch year (`n/a`, empty) | Store `null`. Warn only for values that are present but not a year | The launch year is optional information. |
| SKU missing from the export | Mark the product as delisted (`delisted_at`), never delete it | Reviews must survive and links customers have shared must keep working. |

## API

| Decision | Alternatives considered | Why |
| --- | --- | --- |
| By default, the list returns only `ACTIVE`, listed products. `?status=` adds phase-out and discontinued ones | Show all products with a badge | Sales' main complaint is customers asking about products we no longer sell. Making them opt in is the safest default. |
| The detail page also works for delisted products and returns `delisted: true` | 404 / 410 | Links customers have shared keep working, and the page can say clearly that the product is no longer offered. |
| Values within one filter are OR-ed. Certifications are AND-ed | OR everywhere | A customer who needs Halal **and** Vegan needs both. "Surfactant or Emulsifier" is a normal comparison. |
| Search uses `ILIKE` on name, SKU, chemistry and description, with LIKE wildcards escaped | Postgres full-text search, Elasticsearch | Simple and good enough for 200 products. At 50k products, the next step is a generated `tsvector` column with a GIN index (or `pg_trgm`). Elasticsearch only if relevance ranking or typo tolerance becomes a requirement. |
| Offset pagination, max 50 per page, SKU as the final sort key | Cursor pagination | With 50k products and filters, offset is cheap enough and gives "page N" URLs that can be shared. The SKU tie-breaker keeps pages stable. |
| Filter counts cover the whole listed catalogue, not the current selection | Counts that update as filters change | One cheap query that can be cached. Counts that react to the current selection are a UX improvement for later. |
| The rating aggregate is stored on the product and **recounted** inside the review transaction, after locking the product row with `FOR UPDATE` | Computing the aggregate on every read; updating a running average | Sorting by rating then needs no aggregation over 50k rows. Recounting cannot drift, and the lock serialises concurrent reviews of the same product (covered by a test). |
| Reviews: strict validation, trimmed text, max lengths, rate limit of 5 per minute per IP. The text is rendered only as plain text | Captcha, moderation queue | There is no authentication and moderation is out of scope. This is the minimum for a public write endpoint. The remaining risk (spam from many IPs, fake reviews) is listed under risks. |
| API DTOs are separate from the Prisma model | Returning Prisma entities directly | Internal columns (id, timestamps, `delisted_at`) stay internal, and a schema change does not silently change the API contract. |

## Frontend

| Decision | Alternatives considered | Why |
| --- | --- | --- |
| **Angular 21 + PrimeNG 21.1.10 (MIT) instead of Angular 22 + PrimeNG 22** | Angular 22 + PrimeNG 22 with a license key | PrimeNG 22 (July 2026) moved to the commercial *PrimeUI License*: it needs a key and shows an "Invalid PrimeUI License" banner without one. Removing that mechanism is forbidden by the license. A company of BASF's size does not qualify for the free Community License, so it would need per-developer licences. PrimeNG 21.1.10 is the last MIT release and requires Angular 21, which is still supported (LTS). This is a deliberate deviation from "latest stable". PrimeNG is pinned to an exact version so an update cannot silently pull in a different licence. |
| The URL is the single source of truth for the search: query, filters, sort, page | Component state plus a "copy link" feature | "Send a colleague a link to exactly what I'm looking at" then works without extra effort, along with the back button and reload. All conversion happens in one pure, tested module (`search-state.ts`). Defaults are left out of the URL so links stay short. |
| Search typing is debounced and replaces the history entry; filter changes add a history entry | Pushing every change | The back button undoes a filter, not a single keystroke. |
| Mobile-first: cards instead of a table, filters in a bottom drawer on phones and a sidebar on desktop, native share sheet on phones (clipboard elsewhere) | Data table | Customers use the app at trade fairs. A table with 8 columns does not work at 390px. |
| Clear availability messaging: status badge, and a notice on the detail page for phase-out, discontinued and delisted products | Badge only | This is the business problem ("customers ask about products we no longer sell"), so it is spelled out. |
| Reviews are rendered only through interpolation (plain text), never `[innerHTML]` | Sanitised HTML | Untrusted public input. Verified end-to-end with an HTML payload. |
| API types are mirrored by hand in `core/api.types.ts` | Shared contracts package, generated OpenAPI client | This is the cheapest option for two endpoints. A generated client is the next step once the API grows. |
