# Auth Flow

Authentication is handled by Supabase Auth, with session state managed in Zustand.

## How It Works

1. `App.tsx` calls `useAuthStore.initialize()` on mount
2. Supabase checks for an existing session
3. Auth state changes (login/logout) are monitored via `supabase.auth.onAuthStateChange`
4. Auth state (user, loading, error) derived from Supabase is stored in the Zustand `useAuthStore`

## Using Auth in Components

```typescript
import { useAuth } from '@/hooks/useAuth'

const { user, loading, error, isAuthenticated } = useAuth()
```

## User Roles

The `role` field lives in Supabase Auth user metadata:

```typescript
user?.user_metadata?.role ?? 'student'  // 'student' | 'teacher'
```

Set at signup time and used to control routing and feature access.

## Protected Routes

Wrap any route that requires login with `<ProtectedRoute>`:

```typescript
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

Unauthenticated users are redirected to `/login`.
