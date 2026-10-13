# Baco-Fit — Calorie counter app architecture

This document complements `App-contador-calorias.md` (functional specification) and details the technical architecture decisions. It's meant so that another AI can analyze it alongside the functional document before implementing.

## 1. Stack

- **Framework**: Next.js with App Router (`app/`), TypeScript.
- **Deployment**: Vercel. Environment variables (AWS credentials, endpoint API key) managed in the Vercel dashboard.
- **Repository**: new independent repo (doesn't share code with `home-expenses`), although it reuses the same data access pattern already used there.
- **Environments**: a single one (production). No table or dev/prod deployment separation.
- **Database**: Amazon DynamoDB, accessed via [ElectroDB](https://electrodb.dev/) (instead of the `dynamodb-adapter` library used by `home-expenses` in `domain/src/repositories/DbAdapterFactory.ts`), configured with `accessKeyId` / `secretAccessKey` / `region` via environment variables.

## 2. Modeling decision: single-table design (Option B)

A design with two simple partition-key tables resolved with `scan()` was discarded (valid, but with unbounded growing cost, since entries are never purged). Instead, a **single-table** design with a composite partition key + sort key is adopted, which resolves all access patterns with `query` (no `scan`) from day one.

### 2.1 Table

- **Name**: `baco-fit`.
- **Partition key (PK)**: `telegram_user_id` (string).
- **Sort key (SK)**: composite string, format depends on item type (see 2.2).

All of a user's information (their settings and all their entries) lives under the same partition key, which allows queries to always be scoped to "this user's data" without touching anyone else's.

### 2.2 Item types

**User settings item**

| Attribute | Value |
|---|---|
| `telegram_user_id` (PK) | e.g. `"123456789"` |
| `SK` | constant `"CONFIG"` |
| `calorie_goal` | number |
| `macro_goals` | `{ protein, fat, carbs }` |

**Food entry item** (one per persisted food, see section 4.3 of the functional document)

| Attribute | Value |
|---|---|
| `telegram_user_id` (PK) | e.g. `"123456789"` |
| `SK` | `"{date}#{category}#{id}"`, e.g. `"2026-10-10#breakfast#a1b2c3d4"` |
| `date` | `"2026-10-10"` (duplicated as a plain attribute, in addition to being embedded in the SK, so it's readable without parsing the SK) |
| `category` | `"breakfast"` |
| `id` | food uuid, generated at persist time |
| `name` | string |
| `quantity` | string |
| `calories` | number |
| `macros` | `{ protein, fat, carbs }` |
| `confidence` | number (0-100) |
| `low_confidence_reason` | string, optional |

**Why this order in the SK (`date#category#id`)**: a date in `YYYY-MM-DD` format sorts lexicographically the same as chronologically, so a `query` with `begins_with` or `between` on the SK allows scoping by date or date range directly, without `scan` and without needing secondary indexes.

### 2.3 Access patterns

| Use case | Operation | Key condition |
|---|---|---|
| Save a food entry | `PutItem` | PK = `telegram_user_id`, SK = `{date}#{category}#{uuid}` (uuid generated on write) |
| Read/create the user's goal | `GetItem` / `PutItem` | PK = `telegram_user_id`, SK = `"CONFIG"` |
| Daily summary (all categories) | `Query` | PK = `telegram_user_id`, SK `begins_with "{date}#"` |
| Listing filtered by category for a day | `Query` | PK = `telegram_user_id`, SK `begins_with "{date}#{category}#"` |
| History (date range) | `Query` | PK = `telegram_user_id`, SK `between "{startDate}#" and "{endDate}#"` (high sentinel to include everything from the last day) |

No global secondary index (GSI) is needed: all access patterns are covered by the base table's PK + SK.

### 2.4 Writing an endpoint call

Each call to the endpoint (see section 5 of the functional document) brings a `foods` array. When persisting:

1. For each food in the array, generate a new `id` (uuid).
2. Build the entry item (table 2.2) with SK = `{date}#{category}#{id}`.
3. Write each item with `PutItem` (sequential or batched, to be decided during implementation — at this volume it's not a critical performance decision).

There's no upsert or deduplication: each food in the array always generates a new item.

## 3. Why ElectroDB instead of `dynamodb-adapter`

`home-expenses` uses `dynamodb-adapter` to access DynamoDB, but that library only generates a `KeyConditionExpression` with exact equality on the sort key (`sortKey = :value`): it doesn't support `begins_with` or `between`. The access patterns in section 2.3 "daily summary" and "history by date range" need precisely those two operators on the SK, so `dynamodb-adapter` can't resolve them without resorting to `@aws-sdk/lib-dynamodb` by hand or extending the library itself.

To avoid that dual path (one library for some operations, raw SDK for others), [ElectroDB](https://electrodb.dev/) is adopted as the single access layer for this project:

- Natively supports `begins_with` and `between` in its `query`, in addition to exact equality, covering all five access patterns in section 2.3 without leaving the library.
- Models the single-table design (entities, composite PK/SK) explicitly via its `schema`, which documents the structure from section 2.2 in code instead of building keys by hand in each repository.
- It's a different library from the one `home-expenses` uses; there's no shared code between the two repos, so there's no migration cost or inconsistency to resolve, just an independent library choice for this new project.

ElectroDB uses `@aws-sdk/lib-dynamodb` under the hood, so the credentials (`accessKeyId` / `secretAccessKey` / `region`) are configured the same way described in section 1.

## 4. Endpoint and security

(Already defined in the functional specification, repeated here for completeness of the architecture view.)

- `POST /api/entries` (route under App Router: `app/api/entries/route.ts`).
- Authentication: fixed shared API key, validated in the route handler itself against an environment variable (`ENTRIES_API_KEY` or similar) before touching DynamoDB.
- Environment variables needed in Vercel: `DB_ACCESS_KEY_ID`, `DB_SECRET_ACCESS_KEY`, `DB_REGION`, `ENTRIES_API_KEY`.

## 5. Web view

- Routes under `app/` (App Router) for: daily summary, history, entry listing for a day, goal settings — mapping 1:1 to the access patterns in section 2.3.
- No end-user authentication specified yet (out of scope, see functional document, section 8).

## 6. Code organization: `total-budget-tracker` pattern to replicate

`total-budget-tracker` (sibling repo, same author, the newer and more modern evolution of `home-expenses`) follows the same clean/hexagonal spirit for the backend but with a leaner setup: a single backend workspace instead of two, and a simplified View/ViewModel pattern on the frontend with no separate Model file. This is the version worth replicating in Baco-Fit, not the older `home-expenses` layout.

### Monorepo with a single backend workspace

- The root `package.json` declares `"workspaces": ["backend"]` — there's no separate `services` package.
- `backend/`: independent package (`total-budget-tracker-backend`) with all the business logic, compiled from TypeScript to JS (`backend/lib`) before the app consumes it. Build: `npm run build:be && next build`.
- The frontend does **not** have a `services/` layer: React hooks under `hooks/` (e.g. `useListExpenses.js`, `useSaveExpense.js`) call `fetch` directly against the app's own `/api` routes. There's one hook per use case/endpoint, which plays the role `services/` used to play, without a dedicated package for it.
- The root (Next.js) app imports `backend` as a workspace dependency (`"total-budget-tracker-backend": "^1.0.0"`), used only from `app/api/*/route.js`.

### `backend` layer (business logic)

Inside `backend/src/`:

- **`domain/models/`**: entities (e.g. `Expense.ts`, `Report.ts`, `Category.ts`, `DateRange.ts`, `ExpenseGroup.ts`). Plain classes/types that encapsulate the domain's shape and conversion rules, with no infrastructure dependencies.
- **`domain/services/`**: domain logic that doesn't belong to a single entity (e.g. `ReportService`).
- **`application/<Verb><Entity>UseCase.ts`**: one use case = one class with a single public `execute(...)` method. Decorated with `@injectable()`, receives its dependencies (repositories) via constructor with `@inject(Types.Repository.X)`. Examples: `SaveDocumentUseCase`, `CreateReportUseCase`, `ConsolidateReportUseCase`.
- **`infrastructure/`**: adapters per entity (`ExpenseRepository`, `ReportRepository`, `CategoryRepository`, `DocumentRepository` for Excel/BBVA parsing) over DynamoDB. They are the only layer that knows the database details.
- **`types.ts`**: dependency injection symbols (`Types.Repository.Expense`, `Types.UseCase.CreateReport`...), used by `inversify`.
- **`index.ts`**: the package's composition root — registers every binding (`DI.bind(Types.X).to(ClassY)`, around 25 of them) and exports `DI`, `Types`, and the use case instances the API routes consume.

Known weak point worth avoiding when copying this layer into Baco-Fit: `backend/tsconfig.json` has `strict: false` (only `strictNullChecks` on), and there are explicit `any`s in some repositories (e.g. `private client: any`). Baco-Fit should keep `strict: true` instead of inheriting this.

### Thin API routes

Each `app/api/<resource>/route.js` is deliberately thin: it resolves the use case from the DI container and translates the response, with no logic of its own.

```javascript
import {DI, Types} from 'total-budget-tracker-backend'
import {NextResponse} from 'next/server'

export async function POST(request) {
  const {id, name, amount, paid, period} = await request.json()
  const usecase = DI.get(Types.UseCase.AddExpense)
  await usecase.execute({id, name, amount, paid, period})
  return NextResponse.json({})
}
```

One thing *not* to copy from `total-budget-tracker`: none of its routes or hooks have error handling — no `try/catch` in the route handlers, no `response.ok` checks in the hooks. Baco-Fit should add that even while keeping the rest of the pattern.

### View + ViewModel in the UI (no separate Model file)

`total-budget-tracker` simplifies the three-file MVVM split down to two files plus boilerplate, consistently across `components/` and `views/`:

- `<name>.js` — pure JSX (the view).
- `<name>.viewModel.js` — a hook with all state, effects and handlers; it's the one calling the `hooks/` fetch wrappers (not the `backend` layer directly).
- `index.js` — the public export.
- `index.module.css` — CSS Modules for styling (mixed with MUI's `sx` prop depending on the component; Baco-Fit should pick one of the two consistently instead of mixing them).

There's no `.model.js` file: the data shape lives implicitly in the DTOs passed between hook and view. Simpler than the three-file `home-expenses` version, and enough for Baco-Fit's forms.

### Build, test and lint

- Two-step build: `backend` is compiled first (TypeScript → `lib/`), then Next.js — same idea as `home-expenses`'s `domain` build step.
- **Unlike `home-expenses`, `total-budget-tracker` currently has no tests at all** (no Jest/Vitest, no `*.test.*` files) and no CI pipeline (no `.github/workflows`). This is a regression, not an improvement, and should not be copied into Baco-Fit — Baco-Fit should keep real Jest coverage over its `application`/`domain` layer plus a basic CI workflow (lint + test + build), since that layer is cheap to test in isolation.
- Centralized lint/formatting with `@s-ui/lint` (shared eslint + prettier + stylelint) — same as `home-expenses`.
- No `vercel.json`: "zero-config" deployment on Vercel, auto-detected as a Next.js project.

### How this translates to Baco-Fit

Baco-Fit is much smaller (one write endpoint, four read views), and the `total-budget-tracker` pattern is already close to the right size for it. The following is proposed:

- **Yes, from the start**: the `domain/models`, `application/<use case>`, `infrastructure/` layer separation inside a `domain/` folder in the repo itself — matching `total-budget-tracker`'s single-workspace shape, no need for it to be a separate npm workspace since there's no second consumer of the package. Planned use cases: `AddEntriesUseCase`, `GetDailySummaryUseCase`, `GetHistoryUseCase`, `GetUserGoalUseCase`, `SetUserGoalUseCase`.
- **Yes, from the start**: thin `app/api/.../route.ts` routes, which only resolve a use case and return `NextResponse.json`, same as the example above — but *with* `try/catch` and proper error responses, unlike `total-budget-tracker`.
- **Yes, from the start**: a dedicated repository per ElectroDB entity (`CalorieEntryRepository`, `UserConfigRepository`) as the only layer that knows the ElectroDB `schema` — equivalent to `ExpenseRepository`/`ReportRepository`.
- **Yes, from the start, unlike `total-budget-tracker`**: `strict: true` in `tsconfig.json` and real test coverage (Jest) over `domain`/`application`, plus a minimal CI workflow. These are exactly the gaps found in `total-budget-tracker` and shouldn't be repeated.
- **To be assessed later, not upfront**: the `inversify` container + `types.ts`. With 4-5 use cases and a single consumer (the Next.js routes themselves), instantiating use cases directly (`new AddEntriesUseCase(new CalorieEntryRepository())`) is simpler and still allows swapping implementations in tests. `inversify` can be introduced the day the number of use cases/repositories grows enough that manual injection becomes cumbersome — this is roughly the point `total-budget-tracker` is already past, with ~25 bindings.
- **Not applicable yet**: separate npm workspaces for the domain layer, because Baco-Fit doesn't have (for now) a second consumer of the domain outside the app itself — `total-budget-tracker` itself no longer splits into two workspaces either, so there's nothing being skipped here that the reference project still does.

## 7. Out of scope for this architecture

- Environment separation (dev/prod): a single table, a single environment.
- Secondary indexes (GSI/LSI): not needed with the proposed SK design.
- Infrastructure as code (Terraform/CDK) to create the DynamoDB table: manual creation is assumed, as was presumably done for `expenses`/`guests`.
- Data backup/retention strategy.
