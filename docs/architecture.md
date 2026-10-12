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

- **Name**: `calorie_app` (tentative name).
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

## 6. Code organization: `home-expenses` pattern to replicate

`home-expenses` (sibling repo, same author) follows a clean/hexagonal architecture with a very clear layer separation, which is worth replicating in Baco-Fit even though the project is smaller. Here's how it's organized there:

### Monorepo with npm workspaces

- The root `package.json` declares `"workspaces": ["domain", "services"]`.
- `domain/`: independent package (`home-expenses-domain`) with all the business logic, compiled from TypeScript to JS (`domain/lib`) before the app consumes it. Build: `npm run build:domain && npm run build:next`.
- `services/`: package with HTTP (`fetch`) clients that the UI uses to talk to the app's own `/api` routes — they do **not** talk to the `domain` layer directly, only to the route handlers.
- The root (Next.js) app imports `domain` as a workspace dependency (`"home-expenses-domain": "1"`) and uses `services` from React components/hooks.

### `domain` layer (business logic)

Inside `domain/src/`:

- **`domain/models/`**: entities (e.g. `Expense.ts`, `Guest.ts`). Plain classes with `fromDto(dto)` / `fromPrimitives(data)` methods to build the entity from different sources, and `flatten()` to turn it back into a serializable plain object. They encapsulate conversion rules, with no infrastructure dependencies.
- **`domain/services/`**: domain logic that doesn't belong to a single entity (e.g. `InvoiceService`, `TimetableService`).
- **`application/<feature>/<verb><Entity>UseCase.ts`**: one use case = one class with a single public `execute(...)` method. Decorated with `@injectable()`, receives its dependencies (repositories) via constructor with `@inject(Types.Repository.X)`. Example (`addExpenseUseCase.ts`): converts the DTO to an entity (`Expense.fromDto`) and delegates to the repository.
- **`repositories/`**: infrastructure adapters (`ExpenseRepository`, `GuestRepository` over DynamoDB via `DbAdapterFactory`; `PdfReader`, `ExpenseParser` for other integrations). They are the only layer that knows the database details.
- **`di.ts` + `types.ts`**: dependency injection container using `inversify`. `types.ts` defines symbols (`Types.Repository.Expense`, `Types.UseCase.AddExpense`...); `di.ts` does `DI.bind(Types.X).to(ClassY)`.
- **`index.ts`**: the package's public entry point — exports `DI`, `Types`, `config`, and in some cases already-built use case instances.

### Thin API routes

Each `app/api/<resource>/route.js` is deliberately thin: it resolves the use case from the DI container and translates the response, with no logic of its own.

```javascript
import {DI, Types} from 'home-expenses-domain'
import {NextResponse} from 'next/server'

export async function POST(request) {
  const {id, name, amount, paid, period} = await request.json()
  const usecase = DI.get(Types.UseCase.AddExpense)
  await usecase.execute({id, name, amount, paid, period})
  return NextResponse.json({})
}
```

### MVVM in views

UI pages are split into three files: `XPage.view.js` (pure JSX), `XPage.viewModel.js` (state and handlers, uses hooks over `services/`), `XPage.model.js` (data shape). The `viewModel` is the one that calls `services/` (not the `domain` layer), manages `useState`/`useEffect`, and exposes handlers to the view.

### Build, test and lint

- Two-step build: `domain` is compiled first (TypeScript → `lib/`), then Next.js.
- Tests with Jest, `NODE_OPTIONS=--experimental-vm-modules` to support ESM.
- Centralized lint/formatting with `@s-ui/lint` (shared eslint + prettier + stylelint).
- No `vercel.json`: "zero-config" deployment on Vercel, auto-detected as a Next.js project.

### How this translates to Baco-Fit

Baco-Fit is much smaller (one write endpoint, four read views), so replicating the full pattern as-is would be over-engineering at some points. The following is proposed:

- **Yes, from the start**: the `domain/models`, `application/<use case>`, `repositories/` layer separation inside a `domain/` folder in the repo itself (no need for it to be a separate npm workspace since there's no second consumer of the package). Planned use cases: `AddEntriesUseCase`, `GetDailySummaryUseCase`, `GetHistoryUseCase`, `GetUserGoalUseCase`, `SetUserGoalUseCase`.
- **Yes, from the start**: thin `app/api/.../route.ts` routes, which only resolve a use case and return `NextResponse.json`, same as the `expenses` example.
- **Yes, from the start**: a dedicated repository per ElectroDB entity (`CalorieEntryRepository`, `UserConfigRepository`) as the only layer that knows the ElectroDB `schema` — equivalent to `ExpenseRepository`/`DbAdapterFactory`.
- **To be assessed later, not upfront**: the `inversify` container + `di.ts`/`types.ts`. With 4-5 use cases and a single consumer (the Next.js routes themselves), instantiating use cases directly (`new AddEntriesUseCase(new CalorieEntryRepository())`) is simpler and still allows swapping implementations in tests. `inversify` can be introduced the day the number of use cases/repositories grows enough that manual injection becomes cumbersome.
- **Not applicable yet**: the MVVM view pattern and separate npm workspaces (`domain`/`services` as independent packages), because Baco-Fit doesn't have (for now) complex UI forms or a second consumer of the domain outside the app itself.

## 7. Out of scope for this architecture

- Environment separation (dev/prod): a single table, a single environment.
- Secondary indexes (GSI/LSI): not needed with the proposed SK design.
- Infrastructure as code (Terraform/CDK) to create the DynamoDB table: manual creation is assumed, as was presumably done for `expenses`/`guests`.
- Data backup/retention strategy.
