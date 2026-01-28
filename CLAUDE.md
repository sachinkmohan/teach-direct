# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Learn From A Tutor is a peer-to-peer online tutoring marketplace built with React 19, TypeScript, and Vite. Students can browse teachers, purchase lesson packages via Stripe, and book lessons. Teachers receive payments through Stripe Connect with a 90/10 revenue split (90% to teacher, 10% platform fee).

## Development Commands

```bash
# Start development server on port 5174
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

## Environment Configuration

Copy `.env.example` to `.env.local` and configure:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_APP_URL=http://localhost:5174
```

## Architecture Overview

### Technology Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 6
- **Routing**: React Router DOM v7
- **State Management**:
  - Zustand (authentication state)
  - TanStack React Query v5 (server state/data fetching)
- **Forms**: React Hook Form v7 + Zod v4 (validation)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Payments**: Stripe + Stripe Connect
- **Styling**: Tailwind CSS v4
- **Date/Time**: date-fns + date-fns-tz (timezone support)

### Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components (Button, Card, Input, etc.)
│   ├── layout/          # MainLayout, Header, Footer
│   ├── auth/            # LoginForm, SignupForm
│   ├── teacher/         # Teacher-specific components
│   ├── lessons/         # Lesson management components
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
└── functions/           # Edge Functions (serverless API endpoints)
    ├── purchase-package/
    ├── confirm-lesson/
    ├── stripe-connect-onboard/
    └── auto-release-lessons/
```

### Path Aliases

Import using `@/` alias for src directory:

```typescript
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
```

## Key Architectural Patterns

### Authentication Flow

Authentication uses Zustand store (`stores/authStore.ts`) with Supabase:

- `App.tsx` initializes auth on mount via `useAuthStore.initialize()`
- Supabase session checked and auth state changes monitored
- User metadata includes `role` field (`student` or `teacher`)
- Protected routes use `<ProtectedRoute>` component
- Access auth via `useAuth()` hook: `{ user, loading, error, isAuthenticated }`

### Data Fetching Pattern

All API calls use React Query with custom hooks in `src/hooks/`:

```typescript
// Example: useTeachers hook
useQuery({
  queryKey: ["teachers", filters],
  queryFn: async () => {
    /* Supabase query */
  },
  enabled: condition,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

**Query Invalidation**: Mutations automatically invalidate related queries:

```typescript
// After booking a lesson
queryClient.invalidateQueries({ queryKey: ["lessons"] });
queryClient.invalidateQueries({ queryKey: ["packages"] });
```

### Database Schema (Supabase)

**Core Tables**:

- `users` - User profiles with role, email, timezone
- `teacher_profiles` - Teacher data (Stripe Connect ID, balance)
- `teacher_lesson_offerings` - Duration-based pricing (30/45/60 min offerings with active/inactive toggle)
- `packages` - Lesson packages purchased by students (includes `duration_minutes`)
- `lessons` - Individual lesson bookings with status lifecycle (duration inherited from package)
- `transactions` - Payment history
- `monthly_earnings` - Aggregated teacher earnings

**RPC Functions** (atomic operations):

- `book_lesson_atomic` - Book lesson and deduct package classes
- `cancel_lesson_atomic` - Cancel lesson and refund classes
- `complete_lesson_atomic` - Teacher marks lesson complete
- `dispute_lesson` - Student disputes a lesson

**Edge Functions** (serverless API):

- `purchase-package` - Creates Stripe PaymentIntent
- `confirm-lesson` - Releases funds to teacher (90/10 split)
- `stripe-connect-onboard` - Initiates Stripe Connect onboarding
- `auto-release-lessons` - Auto-confirms lessons after 3 days

### Payment Processing

**Student Purchase Flow**:

1. Browse teachers → select package → `PackagePurchase.tsx` modal
2. Enter card via Stripe CardElement
3. Call `purchase-package` Edge Function
4. Edge Function creates PaymentIntent
5. Frontend confirms payment with Stripe
6. Package record created in database

**Teacher Payout Flow**:

1. Teacher completes Stripe Connect onboarding
2. `stripe_connect_id` stored in `teacher_profiles`
3. On lesson confirmation → `confirm-lesson` Edge Function
4. Stripe transfer: 90% to teacher, 10% platform fee
5. Transaction recorded, teacher balance updated

### Lesson Lifecycle

```
Package Purchase → Student has remaining_classes
    ↓
Book Lesson (book_lesson_atomic)
    ↓
Status: "scheduled" (remaining_classes--)
    ↓
Teacher marks complete → "pending_confirmation"
    ↓
Student confirms OR auto-release after 3 days → "confirmed"
    ↓
Stripe transfer executed (90/10 split)
    ↓
OR Student disputes → "disputed"
OR Cancelled before lesson → "cancelled" (refund)
```

### State Management Strategy

- **Auth State (Zustand)**: Persistent global state in `useAuthStore`
- **Server State (React Query)**: Cached, auto-synchronized with backend
- **Component State (useState)**: UI-specific state (modals, tabs)

## Working with Supabase

### Local Development with Supabase

```bash
# Start local Supabase (PostgreSQL, Auth, Edge Functions)
supabase start

# Reset database and apply all migrations + seed data
supabase db reset

# View local Supabase status and URLs
supabase status
```

### Running Migrations

Database migrations are in `supabase/migrations/`. Apply via Supabase Dashboard or CLI:

```bash
# Link to remote project
supabase link --project-ref your-project-ref

# Apply migrations to remote
supabase db push
```

### Deploying Edge Functions

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy purchase-package
```

### Calling Edge Functions from Frontend

```typescript
const { data, error } = await supabase.functions.invoke("function-name", {
  body: {
    /* payload */
  },
});
```

## Form Validation

All forms use React Hook Form + Zod schemas:

```typescript
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

## Timezone Handling

Lesson times are stored in UTC and displayed in user's timezone:

- User timezone stored in `users.timezone` field
- `useTimezone()` hook provides timezone utilities
- `date-fns-tz` used for conversions

## Common Development Patterns

### Creating a New Query Hook

```typescript
// src/hooks/useExample.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useExample() {
  return useQuery({
    queryKey: ["example"],
    queryFn: async () => {
      const { data, error } = await supabase.from("table").select("*");

      if (error) throw error;
      return data;
    },
  });
}
```

### Creating a New Mutation Hook

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useCreateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ExampleInput) => {
      const { data: result, error } = await supabase
        .from("table")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["example"] });
    },
  });
}
```

### Adding a New Protected Route

```typescript
// In App.tsx
<Route
  path="/new-route"
  element={
    <ProtectedRoute>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

## Database Type Safety

Database types are defined in `src/types/database.ts`. When schema changes:

1. Update migration in `supabase/migrations/`
2. Update TypeScript types in `database.ts`
3. Run migrations via Supabase Dashboard or CLI

## Stripe Integration Notes

- **Test Mode**: Use test publishable key (`pk_test_...`)
- **Webhook Events**: Edge Functions handle payment events
- **Connect Onboarding**: Teachers must complete before receiving payouts
- **Platform Fee**: 10% taken on each lesson confirmation

## Important Constraints

- **Package Booking**: Students can only book if `remaining_classes > 0`
- **Lesson Cancellation**: Can only cancel lessons with status "scheduled"
- **Confirmation**: Only students can confirm completed lessons
- **Auto-Release**: Lessons auto-confirm 3 days after completion
- **Teacher Onboarding**: Must have active Stripe Connect to receive payments

## Other Constraints

- When asked to review the comments by coderabbit on my PR, always fetch the git URL and don't use the 'gh commands'
