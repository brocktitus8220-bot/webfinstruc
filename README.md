# Web Finance

Web app for freelancers, founders, and creators with irregular income.
The product name is a working name. It lives only in
`packages/core/src/config.ts` (`PRODUCT_NAME`, `PRODUCT_TAGLINE`,
`PRODUCT_DOMAIN`). Import those constants; a test fails if the name appears
anywhere else.

Step 1 set up the monorepo, routes, app shell, and auth. Step 2 added the
Postgres schema and a real API. Step 3 adds Plaid bank and card connections,
Apple Card statement import, and the Credit Cards tab. The app still defaults
to mock data, so nothing needs a database or Plaid keys until you switch them on.

## Quick start

```bash
pnpm install
cp .env.example apps/web/.env.local   # optional: add Clerk keys
pnpm dev                              # http://localhost:3000
```

Without Clerk keys the app runs in **demo mode**: sign-in pages show a
"Continue with sample data" card and `/app` is open. Add
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to turn on real
auth; middleware then protects `/app/*` and `/onboarding/*`.

```bash
pnpm typecheck   # all packages, TypeScript strict
pnpm test        # Vitest: core math, API client, shortcuts, name check
pnpm build       # production build
```

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js App Router, Tailwind, shadcn-style UI, Recharts, TanStack Table, Clerk |
| `packages/core` | Framework-free. Zod schemas, types, pure money math (`runway`, `baselineIncome`, `averageIncome`, `allocate`, `formatCurrency`). All money is integer cents. |
| `packages/api-client` | Typed client derived from a contract of core Zod schemas. Takes a token provider and workspace getter, so web and a future native app can share it. Includes a mock transport with sample data. |
| `packages/design-tokens` | Colors (light and dark), spacing, radii, typography as plain TS, plus a Tailwind preset. |
| `packages/db` | Drizzle schema (Postgres), SQL migrations, and the postgres-js connection. |
| `packages/api-server` | Framework-free API handlers for every endpoint in the contract, backed by `@repo/db`. Mounted in the web app at `/api/v1`. Tested against in-memory Postgres (PGlite). |

## Conventions

- **Money**: integer cents everywhere. Convert to dollars only for display.
- **Sub-tabs**: always a `tab` search param (`/app/overview?tab=forecast`).
  The first tab is the default and has no param. Tabs are links, so refresh
  and back/forward work.
- **Workspace** (Business, Personal, All): stored in the `workspace` cookie,
  read on the server for first render, and sent as the `x-workspace` header
  on every API call.
- **Mock state**: onboarding answers, allocation rules, and quick-add entries
  persist in `localStorage` through the mock transport. Settings > Data resets it.
- **Keyboard**: Cmd/Ctrl+K palette, `g` then `o/i/e/c/v/t` to navigate, `?` for
  the cheat sheet. Single-key shortcuts never fire while typing in a field.

## Real API and database

The API client has two modes, set by `NEXT_PUBLIC_API_MODE`:

- `mock` (default): sample data in the browser. No backend needed.
- `http`: real calls to `/api/v1/*`, which this Next app serves from Postgres.

To run against Postgres locally:

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_MODE=http
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app

DATABASE_URL=postgres://... pnpm db:migrate   # create the tables
DATABASE_URL=postgres://... pnpm db:seed      # optional: sample data for the demo user
pnpm dev
```

Without Clerk, every request is the demo user. With Clerk, each signed-in
user gets their own rows, created on their first API call. Picking "Use
sample data" in onboarding loads the sample set into an empty account.

How it fits together:

- `packages/api-client/src/contract.ts` lists every endpoint with its Zod
  schemas. The client, the mock, and the server all derive from it, so a
  shape change is a type error everywhere at once.
- `packages/api-server` matches the request to a contract route, validates
  params, query, and body, runs the handler, and validates the response.
- Users own workspaces (one business, one personal). Accounts, transactions,
  invoices, and holdings hang off a workspace. Every query is filtered by the
  signed-in user and the `x-workspace` scope.
- Money columns are `bigint` cents. Percentages are integer basis points.
- Enum columns use the core Zod enums, so the database and the types agree.

After changing `packages/db/src/schema.ts`, run `pnpm db:generate` and commit
the new SQL file in `packages/db/migrations`.

## Bank connections (Plaid)

Plaid Link connects checking, savings, and credit card accounts. Investment
accounts are left out on purpose, so the self-managed and custodian
investment views keep their own data.

```bash
# apps/web/.env.local, on top of the http mode settings above
PLAID_CLIENT_ID=...
PLAID_SECRET=...            # sandbox secret to start
PLAID_ENV=sandbox
PLAID_TOKEN_KEY=...         # openssl rand -base64 32
DATABASE_URL=postgres://... pnpm db:migrate   # adds migration 0001
```

Then Settings > Accounts > Connect an account. In sandbox, pick any bank and
sign in with `user_good` / `pass_good`.

- **Link**: the server creates a link token, the browser opens Plaid Link
  (loaded from Plaid's CDN), and the public token is exchanged on the server.
  Access tokens are encrypted with AES-256-GCM (`PLAID_TOKEN_KEY`) and never
  reach the browser.
- **Sync**: `/transactions/sync` with a stored cursor. Added and modified
  transactions are upserted by Plaid's transaction id, removed ones deleted,
  and the cursor saved in the same database transaction. Balances refresh on
  every sync. Plaid's sign (positive is money out) is flipped to ours.
- **Webhooks**: set `PLAID_WEBHOOK_URL` to `https://<host>/api/plaid/webhook`.
  Every request is checked against the `Plaid-Verification` JWT (ES256, body
  SHA-256, 5 minute window) before it is used. `SYNC_UPDATES_AVAILABLE`
  triggers a sync; `ITEM` events update the connection status.
- **Repair**: when a bank needs a new sign-in, Settings shows Reconnect, which
  opens Link in update mode. Disconnecting keeps the accounts and history.
- **OAuth banks** (production): set `PLAID_REDIRECT_URI` to
  `https://<host>/app/plaid-oauth` and register it in the Plaid dashboard.

## Credit cards and Apple Card

The Credit Cards tab shows what you owe, utilization, rewards earned, and
rewards missed, plus which card to use for each kind of spending. Each card
has an editable profile (limit, APR, fee, statement and due day, cash back or
points with a point value, bonus categories with yearly caps). Presets are
starting points only. The math lives in `packages/core/src/calc/credit-cards.ts`.

Apple Card is not reachable from a website: Apple shares card data only with
iPhone apps through FinanceKit, and Plaid's Apple Card support runs through
that iPhone path. Apple does let you export each monthly statement as CSV
(card.apple.com > Statements > Export Transactions), so the Cards tab imports
those files. They are parsed in the browser, and each row gets a stable key so
re-importing a month skips what is already there.
