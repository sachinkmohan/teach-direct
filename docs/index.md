# Learn From A Tutor — Dev Docs

Peer-to-peer online tutoring marketplace. Students browse teachers, purchase lesson packages via Stripe, and book lessons. Teachers receive payouts through Stripe Connect (90/10 split).

## Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 6 |
| Routing | React Router DOM v7 |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| Server Logic | Supabase Edge Functions (Deno) |
| Payments | Stripe + Stripe Connect |
| State | Zustand (auth) + TanStack React Query v5 (server) |
| Forms | React Hook Form v7 + Zod v4 |
| Styling | Tailwind CSS v4 |
| Date/Time | date-fns + date-fns-tz |

## Dev Commands

```bash
npm run dev          # Start app on port 5174
npm run build        # Production build
npm run lint         # ESLint
npm run docs:dev     # Start this doc site
```

## Environment Setup

Copy `.env.example` to `.env.local`:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_APP_URL=http://localhost:5174
```
