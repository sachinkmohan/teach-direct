# Architecture

## Project Structure

```text
src/
├── components/
│   ├── ui/              # Reusable UI (Button, Card, Input, etc.)
│   ├── layout/          # MainLayout, Header, Footer
│   ├── auth/            # LoginForm, SignupForm
│   ├── teacher/         # Teacher-specific components
│   ├── lessons/         # Lesson management
│   ├── packages/        # Package purchase with Stripe
│   ├── wallet/          # Transaction history
│   └── ProtectedRoute.tsx
├── pages/               # Route components
├── hooks/               # Custom React hooks (API wrappers)
├── stores/              # Zustand stores (authStore)
├── types/               # TypeScript types (database.ts)
└── lib/                 # Utilities (supabase.ts, stripe.ts, utils.ts)

supabase/
├── migrations/          # Database schema and SQL migrations
└── functions/           # Edge Functions (serverless)
    ├── purchase-package/
    ├── confirm-lesson/
    ├── stripe-connect-onboard/
    └── auto-release-lessons/
```

## Path Aliases

Use `@/` to import from `src/`:

```typescript
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
```

## State Management Strategy

| Concern | Tool | Where |
|---------|------|--------|
| Auth session | Zustand (`useAuthStore`) | `stores/authStore.ts` |
| Server/API data | TanStack React Query | `hooks/` |
| UI-only state | `useState` | Component-local |

## Local Supabase

```bash
supabase start       # Start local PostgreSQL + Auth + Edge Functions
supabase db reset    # Apply all migrations + seed data
supabase status      # Show local URLs and keys
```
