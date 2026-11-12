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
