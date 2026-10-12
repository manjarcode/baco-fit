# Baco-Fit

Calorie intake logging app. Data is captured outside the app, through a Telegram bot orchestrated by a Make scenario that uses an AI to turn the user's message into a structured call to this app's HTTP endpoint. The app only persists that data and serves a minimal web view to query it (daily summary, history, entry listing, goal settings).

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- Amazon DynamoDB via [ElectroDB](https://electrodb.dev/)
- Deployed on [Vercel](https://vercel.com/)

## Documentation

- [Functional specification](docs/functional%20description.md) — actors, data model, endpoint, web view, scope.
- [Architecture](docs/architecture.md) — stack, DynamoDB single-table design, access patterns, code organization.

## Getting started

Not implemented yet — this repo currently holds the functional and architecture specs that precede implementation.
