# Web Finance

Web app for freelancers, founders, and creators with irregular income.
The product name is a working name. It lives only in
`packages/core/src/config.ts` (`PRODUCT_NAME`, `PRODUCT_TAGLINE`,
`PRODUCT_DOMAIN`). Import those constants; a test fails if the name appears
anywhere else.

This is **step 1**: monorepo, routes, app shell, and auth. All data is mock
data behind a typed API client. No Plaid, no AI, no database writes.

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
| `packages/db` | Drizzle + postgres-js connection and one placeholder migration. No schema yet. |

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
- **Keyboard**: Cmd/Ctrl+K palette, `g` then `o/i/e/v/t` to navigate, `?` for
  the cheat sheet. Single-key shortcuts never fire while typing in a field.

## Database

```bash
DATABASE_URL=postgres://... pnpm db:migrate    # runs the placeholder migration
pnpm db:generate                               # after schema changes
```
