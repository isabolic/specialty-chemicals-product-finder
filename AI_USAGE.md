# AI usage

## Tools

**Claude Code** (Anthropic, in VS Code) was the only coding agent. It ran commands, wrote code and tests, and checked the app in a headless browser.

## How I split the work

| I did (lead) | Delegated to the agent (then reviewed) |
| --- | --- |
| Read the brief and asked for a proposal first, before any code. I reviewed the proposal and changed it (e.g. pnpm instead of npm workspaces) | Profiling the CSV, i.e. finding the data-quality issues |
| Decided scope and order of work: import first, then API, then UI, then docs, against a 2–3 hour target | Scaffolding: workspace, Compose, Dockerfiles, Prisma schema and migration |
| Product decisions: default to active products, how to treat duplicates, empty names and delisted products, reviews without authentication | Implementing the import, API, UI and tests to those decisions |
| Licence decision: Angular 21 + PrimeNG 21 instead of 22 | Researching the PrimeNG licence and version compatibility |
| Reviewing every change, asking for explanations (e.g. how NestJS wires in Prisma) until I could defend them | Writing the first drafts of README and DECISIONS |
| Git history and repository setup | Verifying each step: unit and integration tests on a real Postgres, a clean-clone build, screenshots |

## Where I rejected or corrected the agent

1. **PrimeNG 22's licence.** The agent installed the "latest stable" Angular 22 and PrimeNG 22, as the brief says. All tests passed. Only when the running app was viewed in a browser did an "Invalid PrimeUI License" banner appear: PrimeNG 22 had moved to a commercial licence with a license-key check. Hiding the banner was not an option (the licence forbids removing that check). I chose to drop to Angular 21 + PrimeNG 21.1.10, the last MIT release. I pinned it exactly and documented the deviation. **Lesson:** "latest" is not a decision. Green tests don't prove a UI works.

2. **Search wildcards.** The agent's first search used Prisma's `contains`, which looks correct but does not escape LIKE wildcards: searching for `%` returned the whole catalogue, and `_` matched any character. A test with deliberately awkward input caught it, and it is now fixed and covered by tests. **Lesson:** ORM convenience APIs need edge-case tests.

3. **Name fallback for products without a name.** The first proposal used `chemical_name` as the fallback name. I rejected it: customers would read "Bentonite" as a trade name, and several products share the same chemistry. The SKU is an honest placeholder, and the import logs a warning for the PIM team.

4. **Over-engineered data model.** The first proposal had lookup tables for function, region and certifications. I dropped them for plain indexed columns and a `text[]`. The PIM owns that vocabulary, so the lookup tables would only add join and sync logic to the import.

5. **Versions and setup the agent got wrong or nearly wrong:**
   - npm's `latest` tag for Prisma pointed at a **v8 release candidate**, so we stayed on stable 7.10.1.
   - The Angular CLI generated **Vitest**, but the brief requires Jest, so it was replaced.
   - A clean clone of the repo showed that `pnpm install && pnpm test` **failed**, because the generated Prisma client was only on my machine. That was fixed with a `postinstall` step.

6. **Not trusting a single signal.** Early headless screenshots suggested a blank desktop page and a mobile overflow. Measuring the page in the browser showed both were capture artefacts, not bugs, so no "fix" was made for a problem that didn't exist.

## What I'd keep doing

Ask for a proposal before code, check each step against a real database and a real browser, and keep the reasoning in DECISIONS.md so that every line can be explained in the review.
