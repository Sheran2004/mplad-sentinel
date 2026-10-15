# MPLAD Sentinel

> Screening dashboard for 37K+ MPLADS completed works: explainable risk indicators, data-quality checks,
> review workflow with roles and an audit log, CSV export, and a Hinglish AI desk.

## What is this?

MPLADS (Members of Parliament Local Area Development Scheme) funds local works such as roads, street lights, hand pumps,
school rooms and community halls, recommended by MPs. The official dashboard lists the completed works, but with 37,000+
rows it is very hard to spot patterns by eye. **MPLAD Sentinel** loads the official dashboard export into a database and
makes it searchable, comparable and reviewable: it points a reviewer to the works that deserve a closer look and records
what was checked.

It is a **screening tool, not a fraud detector.** A flag means "worth a closer look", never proof of wrongdoing.

## Who is it for?

- Journalists and RTI activists: decide which works to ask about
- Civil society and social-audit teams: build a shortlist and track what has been verified
- Researchers and students: explore spending by state, member, work type and time
- Monitoring staff: a shared review queue with notes and an audit trail

## How it is used

1. **Overview:** see totals, monthly disbursement, top states and work types.
2. **Works:** filter by state, year, work type, indicator, photo or amount; keep "Flagged only" on to see the review queue.
3. **Open a work:** read the official fields and why each indicator fired, including which other works to compare with.
4. **Sign in as a reviewer:** set the status (open / reviewed / dismissed) and write a note; every change is audited.
5. **Export:** download the filtered list as CSV, then verify with sanction orders, measurement books, bills, geo-tagged
   photos or a site visit (for example through an RTI request) before drawing any conclusion.
6. **Ask the desk:** ask in English, Hindi or Hinglish; answers use the database context (for example "which work types look unusual?").

## What you get

- **Overview** – totals, monthly disbursement, top states and work types, severity counts
- **Works** – server-side search, filters (state, year, type, severity, indicator, photo, amount), sorting, paging, CSV export
- **Work detail** – official fields, every indicator that fired with its explanation, review status + notes + history, "ask AI about this work"
- **Members** – works, disbursed amount, allocation (from the allocation export), photo coverage, flagged count
- **Cases** – everything a reviewer has marked or annotated
- **Data & method** – provenance, data-quality findings, exact rule thresholds
- **AI desk** (Groq) – answers from database context; English / Hindi / Hinglish
- **Accounts** – email + password, roles `admin` / `reviewer` / `viewer`, signed httpOnly session cookie, login lockout, audit log, admin screen to manage users

## Run locally

```bash
npm install
cp .env.example .env      # add GROQ_API_KEY for the AI desk; keep PGLITE_DIR to persist reviews
npm run dev               # http://localhost:8080
```

With no `DATABASE_URL` the app uses an embedded PostgreSQL (PGlite) and loads the dataset on the
first request (about 10 s once). `PGLITE_DIR=.pglite-data` keeps it on disk so reviews survive restarts.

## Accounts and roles

| Role | Can do |
| --- | --- |
| viewer | Read everything |
| reviewer | + change review status, write notes |
| admin | + manage users, read the audit log |

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (10+ chars) in the environment: the first admin is created on startup if that
email does not exist. Further users are created in the **Admin** tab. `SESSION_SECRET` (32+ random chars) is **required in
production**. `REQUIRE_LOGIN=true` hides the data from signed-out visitors too. With no accounts configured the app is in
open mode (fine for local use; a banner says so). The last active admin cannot be demoted or disabled.

## Deploy (Vercel + Neon/Postgres)

Set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GROQ_API_KEY` in the project settings.
`npm run build` runs `db:migrate` and `db:seed` (loads `data/mplads-official-export.json`).

## Refreshing the data

The dashboard has no public API, so data comes from its exports. To update:

```bash
npm run data:import -- --file path/to/new-export.json --dry-run   # validate + data-quality summary, writes nothing
npm run data:import -- --file path/to/new-export.json             # load into DATABASE_URL (Postgres)
```

The file needs the same 4 arrays as `data/mplads-official-export.json` plus `source`, `sourceUrl`, `retrievedDate`. Works are
replaced and re-scored; **reviews, notes, users and audit log are kept**. Locally (embedded DB) just replace the data file (or
point `DATASET_FILE` at it): the app notices the changed content and reloads by itself.

## Layout

| Path | What |
| --- | --- |
| `data/mplads-official-export.json` | Unmodified dashboard export (source of truth) |
| `migrations/0004_official_dataset.sql` | Works, flags, allocations, dataset meta |
| `src/lib/dataset/normalize.ts` | Parsing, dedupe, member/chamber attribution, data-quality report |
| `src/lib/dataset/analyze.ts` | Screening rules and thresholds |
| `src/lib/dataset/queries.server.ts` | All SQL (parameterized) |
| `src/lib/api.ts`, `reviews.ts`, `ask.ts` | Server functions (the only browser → DB path) |
| `scripts/seed.mjs` | Deploy-time loader |

Tests: `npm run test:dataset` (parsers, merge/dedupe, every rule, password hashing, session tokens, roles).

## Read this before trusting the output

1. **The "Rajya Sabha" export is not Rajya Sabha data.** All 37,280 rows match Lok Sabha members, and it
   repeats every row of the Lok Sabha export, which itself stops at exactly 27,000 rows (a download cap).
   The files are merged by work code, so nothing is double counted. Re-download the Rajya Sabha tab
   from the dashboard to get genuine Rajya Sabha works.
2. **The export has no vendor, sanctioned amount, physical progress, geo-tag or bills.** Rules that need
   them are deliberately not faked. Indicators are triage signals; confirm on documents and site visits.
3. **Auth is deliberately simple** (email/password, no email verification, no self-service password reset, no 2FA).
   An admin resets passwords. Fine for a small review team; add SSO/2FA before wider rollout.
4. Never commit `.env`. If a key was ever shared or committed, revoke it and create a new one.