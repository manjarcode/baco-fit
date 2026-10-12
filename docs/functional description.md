# Baco-Fit — Calorie counter app

## 1. Overview

Calorie intake logging application. It has no data-entry interface of its own: data capture happens outside the app, through a Telegram bot orchestrated by a Make scenario, which uses an AI to interpret the user's message and turn it into a structured call to an HTTP endpoint exposed by this app.

This app is responsible only for:
- Exposing an HTTP endpoint that receives and persists already-interpreted food entries.
- Exposing a minimal web view for querying data (daily summary, history, entry listing).

This app is **not** responsible for:
- Interpreting natural language or calculating calories/macros (that's done by the AI in Make, before calling the endpoint).
- Communicating with Telegram (that's done by Make).

## 2. Actors

| Actor | Description |
|---|---|
| End user | Person who sends messages to the Telegram bot describing what they ate. Several people (family/friends) use the same bot. |
| Make scenario | External flow that receives the Telegram message, runs it through an AI, and does the `POST` to this app's endpoint. It's the only client of the endpoint. |
| Calorie counter app | System described in this document. Receives the `POST`, persists the data, and serves a query view. |

This app never interacts directly with Telegram or with the end user at logging time; it only does so when the end user opens the web query view.

## 3. User identity

- There is no login system of its own.
- Each user's identity is their `telegram_user_id`.
- Each `telegram_user_id` has its own daily goal and its own data.
- Users don't share data with each other: each one sees exclusively their own information in the web view.

## 4. Data model

### 4.1 User

| Field | Type | Description |
|---|---|---|
| `telegram_user_id` | string/number | Unique user identifier, comes from Telegram. |
| `calorie_goal` | number | Daily calorie goal. Fixed, doesn't vary by day. |
| `macro_goals` | object | `{ protein, fat, carbs }`. Fixed daily macronutrient goal (in grams). |

The goal is fixed per user: there's no concept of a different goal per day of the week, training day, etc. (out of scope, see section 7).

### 4.2 Log entry (payload received by the endpoint)

Each call to the endpoint represents **one Telegram message**, which can contain **one or more foods**.

```json
{
  "telegram_user_id": "123456789",
  "date": "2026-10-10",
  "category": "breakfast",
  "foods": [
    {
      "name": "toast with butter",
      "quantity": "2 units",
      "calories": 180,
      "macros": {
        "protein": 4,
        "fat": 7,
        "carbs": 24
      },
      "confidence": 55,
      "low_confidence_reason": "It's not specified whether it has butter, oil or jam, nor the exact amount"
    }
  ]
}
```

Notes on the fields:

- `date`: date only (`YYYY-MM-DD`), no time component. There's no exact consumption timestamp.
- `category`: intake window of the day. Closed enum, e.g.: `breakfast`, `lunch`, `afternoon_snack`, `dinner`, `snack`. It's unique per call (applies to all foods in that call's `foods` array).
- `foods`: array of 1 or more items. Each item represents a distinct food detected in the message.
- `name`, `quantity`: free text, as determined by Make's AI.
- `calories`: already calculated by Make's AI. The app doesn't recalculate or validate this value.
- `macros`: already calculated by Make's AI, in grams. The app doesn't recalculate or validate this value.
- `confidence`: percentage (0-100) calculated by Make's AI based on how much ambiguity there is in the food description (e.g. "a coffee and a toast" has low confidence because it doesn't specify whether the coffee has milk, nor what's on the toast).
- `low_confidence_reason`: free text explaining why confidence is low. Present only when confidence is low (threshold to be defined during implementation); optional in the payload.

The app persists this data as-is, without applying calculation logic, nutritional validation, or automatic correction.

### 4.3 Persisted entry

This is the result of "unrolling" the `foods` array from the payload: each food in the array is persisted as an individual entry, inheriting `telegram_user_id`, `date` and `category` from the call that contained it.

| Field | Source |
|---|---|
| `telegram_user_id` | from the call |
| `date` | from the call |
| `category` | from the call |
| `name` | from the item |
| `quantity` | from the item |
| `calories` | from the item |
| `macros` | from the item |
| `confidence` | from the item |
| `low_confidence_reason` | from the item (optional) |

## 5. Endpoint

- **Method/route**: `POST /entries` (route name is tentative, not final).
- **Client**: exclusively the Make scenario. No other consumers are planned.
- **Authentication**: fixed shared API key, sent in a header (e.g. `Authorization` or `X-Api-Key`). A single secret for the whole flow, no rotation or multiple keys per user.
- **Body**: see structure in section 4.2.
- **Expected behavior**:
  1. Validate the authentication header.
  2. Persist each food in the `foods` array as an individual entry (section 4.3), without transforming or recalculating calories/macros/confidence.
  3. No deduplication or idempotency is specified: each call generates new entries.
- **Response**: simple success or error confirmation (e.g. `200 OK` / `4xx`/`5xx` with a minimal body). The response is not expected to include accumulated totals or summary data; Make doesn't use the response to reply to the user on Telegram with data calculated by the app.

## 6. Web query view

For each user (identified implicitly by their `telegram_user_id`, no login), the view must allow:

1. **Daily summary**: total calories and each macro consumed on a date, compared against the user's goal (section 4.1).
2. **History**: evolution of calories/macros over several days or weeks.
3. **Entry listing for a day**: all entries persisted for that date, grouped or filterable by `category`, showing a visual indicator when `confidence` is low (no edit action associated).
4. **Goal settings**: screen to set/view the user's `calorie_goal` and `macro_goals` (fixed, not per day).

Not required:
- Editing or deleting entries.
- Own login (direct access or some simple mechanism out of scope for this document is assumed).
- Aggregated or comparative view across different users.

## 7. Explicitly out of scope (v1)

- Editing or deleting already-logged entries.
- Own end-user login/authentication (`telegram_user_id` is used as implicit identity).
- Shared or comparative view across multiple users (each user sees only their own).
- Variable daily goals (by day of the week, training day, etc.): the goal is fixed per user.
- Exact consumption timestamp: only date + category are logged, never time.
- Recalculation, validation or correction of calories/macros/confidence by the app: these values are always whatever arrives in the payload, calculated externally by the Make flow's AI.
- Enriched endpoint response back to Make (accumulated totals, personalized messages, etc.): only success/error confirmation.
- Direct integration with Telegram: all interaction with Telegram happens in the Make scenario, outside this app.

## 8. Assumptions and open points for implementation

- The `category` enum (intake windows) must be fixed during implementation; this document assumes at least `breakfast`, `lunch`, `afternoon_snack`, `dinner`, `snack`, but the final set isn't closed.
- The `confidence` threshold that determines what's considered "low" (to show the visual indicator) must be defined during implementation.
- The timezone used to interpret `date` isn't specified; since there's no time component, it's assumed that `date` arrives already resolved in the correct timezone from Make.
- No access mechanism for the web view has been defined (whether it requires some lightweight authentication or is direct access); it's out of scope for this functional document.
