# Learn From A Tutor -- Architecture Deep Dive

A comprehensive guide to the full-stack architecture of Learn From A Tutor, written for frontend developers stepping into full-stack for the first time.

---

## Table of Contents

1. [Introduction & Big Picture](#1-introduction--big-picture)
2. [Project Structure Walkthrough](#2-project-structure-walkthrough)
3. [Frontend Architecture (Deep Dive)](#3-frontend-architecture-deep-dive)
4. [Backend Architecture (Deep Dive)](#4-backend-architecture-deep-dive)
5. [Payment System (Deep Dive)](#5-payment-system-deep-dive)
6. [Core Business Logic](#6-core-business-logic)
7. [Key Architectural Patterns & Concepts](#7-key-architectural-patterns--concepts)
8. [How Things Connect (End-to-End Traces)](#8-how-things-connect-end-to-end-traces)
9. [Glossary](#9-glossary)

---

## 1. Introduction & Big Picture

### What the App Does

Learn From A Tutor is a **peer-to-peer online tutoring marketplace**. It connects students who want to learn with teachers who offer lessons. The core business loop is:

1. **Students** browse teachers, view their profiles and pricing
2. **Students** purchase lesson packages (1, 5, or 10 classes) via credit card
3. **Students** book individual lessons against their purchased package
4. **Teachers** mark lessons as complete after they happen
5. **Students** confirm the lesson occurred (or it auto-confirms after 3 days)
6. **Admin** approves the payout
7. **Teachers** receive 90% of the lesson price via Stripe; the platform keeps 10%

### Tech Stack Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript 5.9 + Vite 6 | Single-page application |
| **Routing** | React Router DOM v7 | Client-side routing |
| **State** | Zustand + TanStack React Query v5 | Auth state + server state |
| **Forms** | React Hook Form v7 + Zod v4 | Form handling + validation |
| **Styling** | Tailwind CSS v4 | Utility-first CSS |
| **Backend** | Supabase (PostgreSQL + Auth + Edge Functions) | Database, authentication, serverless API |
| **Payments** | Stripe + Stripe Connect | Payment processing + teacher payouts |
| **Date/Time** | date-fns + date-fns-tz | Timezone-aware date formatting |

### High-Level Architecture

```
                            +------------------+
                            |     Browser      |
                            |  (React 19 SPA)  |
                            +--------+---------+
                                     |
                            HTTPS (REST + WebSocket)
                                     |
                    +----------------+----------------+
                    |                                 |
           +--------v---------+            +----------v----------+
           |    Supabase       |            |       Stripe        |
           |  (Backend-as-a-  |            |   (Payments +       |
           |   Service)        |            |    Connect)         |
           +--+----+----+----++            +-----+-----+---------+
              |    |    |    |                   |     |
              v    v    v    v                   v     v
           Auth  DB  Edge  Realtime          Charges  Transfers
                 (PG) Func                   Webhooks  Payouts
```

**How the pieces fit together:**

- The **React SPA** runs in the browser. It talks to Supabase for everything: auth, data, and serverless functions.
- **Supabase** provides PostgreSQL (the database), Auth (login/signup), and Edge Functions (serverless TypeScript/Deno functions for sensitive operations like payment processing).
- **Stripe** handles all money movement. The frontend uses Stripe.js for card collection. Edge Functions create payment intents and transfers using Stripe's server-side API. Stripe sends webhook events back to an Edge Function to confirm payments.

---

## 2. Project Structure Walkthrough

```
teachdirect-web/
|
+-- src/                          # All frontend source code
|   +-- main.tsx                  # Entry point: renders <App /> into DOM
|   +-- App.tsx                   # Root component: providers, routing, auth init
|   +-- index.css                 # Global styles (Tailwind directives)
|   |
|   +-- components/
|   |   +-- ui/                   # Reusable UI primitives (Button, Card, Input)
|   |   +-- layout/               # Page layout (MainLayout, Header, Footer)
|   |   +-- auth/                 # Auth forms (LoginForm, SignupForm)
|   |   +-- teacher/              # Teacher-specific UI (profile, onboarding)
|   |   +-- lessons/              # Lesson components (BookingModal, LessonCard)
|   |   +-- packages/             # Package purchase (PackagePurchase with Stripe)
|   |   +-- wallet/               # Transaction history display
|   |   +-- ProtectedRoute.tsx    # Auth guard for routes
|   |   +-- AdminRoute.tsx        # Admin-only route guard
|   |
|   +-- pages/                    # Route-level page components
|   +-- hooks/                    # Custom hooks (API wrappers around React Query)
|   +-- stores/                   # Zustand stores (authStore)
|   +-- types/                    # TypeScript type definitions (database.ts)
|   +-- lib/                      # Utilities (supabase client, stripe client, cn())
|
+-- supabase/
|   +-- migrations/               # SQL migration files (schema, RPC functions, RLS)
|   +-- functions/                # Edge Functions (Deno serverless endpoints)
|       +-- purchase-package/     # Creates Stripe PaymentIntent for purchases
|       +-- confirm-lesson/       # Student confirms a lesson
|       +-- admin-approve-lesson/ # Admin approves payout + Stripe transfer
|       +-- stripe-connect-onboard/ # Initiates Stripe Connect for teachers
|       +-- stripe-webhook/       # Receives and processes Stripe webhook events
|       +-- auto-release-lessons/ # Auto-confirms lessons after 3-day timeout
|
+-- vite.config.ts                # Vite config (React plugin, path alias)
+-- tsconfig.json                 # TypeScript config
+-- tailwind.config.ts            # Tailwind CSS config
+-- .env.local                    # Environment variables (not committed)
```

### Path Alias

The `@/` alias maps to `src/`, configured in `vite.config.ts`:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

This means `import { Button } from "@/components/ui/button"` resolves to `src/components/ui/button.tsx`.

### Key Config Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Build tool config -- React plugin, `@/` path alias |
| `tsconfig.json` | TypeScript compiler options |
| `tailwind.config.ts` | Tailwind CSS theme and plugin config |
| `.env.local` | Runtime env vars (Supabase URL, Stripe key, etc.) |
| `package.json` | Dependencies and npm scripts |

---

## 3. Frontend Architecture (Deep Dive)

### 3.1 App Bootstrapping

The app boots in two files: `main.tsx` and `App.tsx`.

**`src/main.tsx`** -- The entry point. It mounts React into the DOM:

```tsx
// src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**`src/App.tsx`** -- Sets up the provider tree and routing:

```tsx
// src/App.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes -- data is "fresh" this long
      retry: 1,                   // only retry failed queries once
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>  {/* React Query cache */}
      <BrowserRouter>                            {/* Client-side routing */}
        <AppRoutes />                            {/* Route definitions */}
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

**The provider tree** (from outermost to innermost):

```
QueryClientProvider       -- makes React Query available everywhere
  BrowserRouter           -- enables client-side routing (URL-based navigation)
    AppRoutes             -- defines all routes, initializes auth
```

**Auth initialization** happens inside `AppRoutes` on mount:

```tsx
// src/App.tsx (inside AppRoutes)
function AppRoutes() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()  // Check for existing session, set up auth listener
  }, [initialize])

  // ... routes
}
```

This `initialize()` call does two things:
1. Checks if the user has an existing session (e.g., they logged in before and the JWT is still valid)
2. Sets up a listener for auth state changes (login, logout, token refresh)

### 3.2 Routing

All routes are defined in `App.tsx`:

```tsx
// src/App.tsx
<Routes>
  <Route element={<MainLayout />}>
    {/* Public routes -- anyone can access */}
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/teachers" element={<TeachersPage />} />
    <Route path="/teachers/:teacherId" element={<TeacherDetailPage />} />

    {/* Protected routes -- must be logged in */}
    <Route path="/dashboard" element={
      <ProtectedRoute><DashboardPage /></ProtectedRoute>
    } />
    <Route path="/teacher/onboarding" element={
      <ProtectedRoute><TeacherOnboardingPage /></ProtectedRoute>
    } />
    <Route path="/lessons" element={
      <ProtectedRoute><LessonsPage /></ProtectedRoute>
    } />
    <Route path="/settings" element={
      <ProtectedRoute><SettingsPage /></ProtectedRoute>
    } />

    {/* Admin route -- must be logged in AND be the admin */}
    <Route path="/admin" element={
      <AdminRoute><AdminDashboardPage /></AdminRoute>
    } />

    {/* Catch-all redirect */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
</Routes>
```

**Key concept: Layout Routes.** `<Route element={<MainLayout />}>` is a layout route. It wraps all child routes with the same layout (Header + content + Footer) without adding a URL segment. The child route renders inside the `<Outlet />` of `MainLayout`.

#### ProtectedRoute

The `ProtectedRoute` component is a **route guard**. It checks if the user is authenticated before rendering children:

```tsx
// src/components/ProtectedRoute.tsx
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>  // spinner while checking auth
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />  // redirect to login
  }

  return <>{children}</>  // render the protected page
}
```

#### AdminRoute

Similar to `ProtectedRoute`, but also checks the user's email against an admin email from env vars:

```tsx
// src/components/AdminRoute.tsx
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.email !== ADMIN_EMAIL) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
```

### 3.3 Layout System

The layout uses React Router's `<Outlet />` pattern:

```tsx
// src/components/layout/MainLayout.tsx
export function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />           {/* Navigation bar */}
      <main className="flex-1">
        <Outlet />         {/* Current route component renders here */}
      </main>
      <Footer />           {/* Footer */}
    </div>
  )
}
```

```
+------------------------------------------+
|              Header (nav)                |
+------------------------------------------+
|                                          |
|          <Outlet /> (page content)       |
|          Rendered by current route       |
|                                          |
+------------------------------------------+
|              Footer                      |
+------------------------------------------+
```

### 3.4 State Management (3 Layers)

The app uses three distinct layers of state. Understanding when to use each is crucial.

#### Layer 1: Zustand Auth Store (Global, Persistent)

**What:** A single global store for authentication state.
**When to use:** Anything related to the current user's identity (who they are, their role, login/logout).
**Why Zustand:** Auth state is needed everywhere (header, route guards, API calls) and must survive re-renders. Zustand is simpler than Redux -- no boilerplate, no actions/reducers.

```typescript
// src/stores/authStore.ts
interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  initialized: boolean
  signup: (email, password, role, displayName, timezone) => Promise<void>
  login: (email, password) => Promise<void>
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return       // prevent double init

    set({ loading: true })
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    set({ user: data.session?.user || null, initialized: true })

    // Listen for future auth changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user || null })
    })
  },

  login: async (email, password) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: data.user })
  },

  // ... signup and logout follow the same pattern
}))
```

**How to consume it:**

```tsx
// Direct store access (for specific slices)
const user = useAuthStore((state) => state.user)

// Or via the useAuth convenience hook
const { user, isAuthenticated, loading } = useAuth()
```

The `useAuth` hook is a thin wrapper:

```typescript
// src/hooks/useAuth.ts
export function useAuth() {
  const { user, loading, error } = useAuthStore()
  return { user, loading, error, isAuthenticated: !!user }
}
```

#### Layer 2: React Query (Server State, Cached)

**What:** All data fetched from Supabase (teachers, lessons, packages, transactions).
**When to use:** Any data that lives on the server and might be stale.
**Why React Query:** It handles caching, background refetching, loading/error states, and cache invalidation. Without it, you'd be writing `useState` + `useEffect` + loading flags everywhere.

**Query example -- fetching teachers:**

```typescript
// src/hooks/useTeachers.ts
export function useTeachers(filters?: { subject?: string; language?: string }) {
  return useQuery({
    queryKey: ['teachers', filters],    // Cache key -- changes when filters change
    queryFn: async () => {              // The actual fetch function
      let query = supabase
        .from('teacher_profiles')
        .select(`*, users (*)`)         // Join teacher_profiles with users table
        .not('hourly_rate', 'is', null)

      if (filters?.subject) {
        query = query.contains('subjects', [filters.subject])
      }
      const { data, error } = await query
      if (error) throw error
      return data as TeacherWithUser[]
    },
  })
}
```

**Query key concept:** `['teachers', filters]` is the cache key. React Query caches the result and associates it with this key. If another component calls `useTeachers()` with the same filters, it gets the cached result instantly (no new network request).

**Mutation example -- booking a lesson:**

```typescript
// src/hooks/useLessons.ts
export function useBookLesson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ packageId, teacherId, scheduledAt }) => {
      // Call the atomic booking RPC function
      const { data, error } = await supabase.rpc("book_lesson_atomic", {
        p_package_id: packageId,
        p_teacher_id: teacherId,
        p_student_id: user.id,
        p_scheduled_at: scheduledAt.toISOString(),
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      // After booking succeeds, invalidate related caches
      // This forces React Query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["lessons"] })
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] })
      queryClient.invalidateQueries({ queryKey: ["packages"] })
    },
  })
}
```

**Cache invalidation pattern:** When a mutation changes data on the server, we `invalidateQueries` for all related cache keys. This tells React Query: "this cached data is stale -- refetch it." Any component using those queries will automatically re-render with fresh data.

#### Layer 3: Component State (Local, Ephemeral)

**What:** `useState` for UI-specific state that doesn't need to be shared.
**When to use:** Modal open/close, selected tab, form input values, loading spinners for specific buttons.

```tsx
// Example from BookingModal.tsx
const [selectedDate, setSelectedDate] = useState<string>('')
const [selectedTime, setSelectedTime] = useState<string>('')
const [error, setError] = useState<string | null>(null)
```

### 3.5 Forms: React Hook Form + Zod

All forms follow the same pattern: define a Zod schema, wire it to React Hook Form, handle submission.

**Real example from `LoginForm.tsx`:**

```tsx
// src/components/auth/LoginForm.tsx

// 1. Define validation schema with Zod
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormData = z.infer<typeof loginSchema>  // auto-generates TypeScript type

export function LoginForm() {
  const { login } = useAuthStore()

  // 2. Wire schema to React Hook Form
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),  // Zod validates, errors shown by RHF
  })

  // 3. Handle form submission
  const onSubmit = async (data: LoginFormData) => {
    await login(data.email, data.password)
    navigate("/dashboard")
  }

  // 4. Render form with register() binding
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input type="email" {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}

      <Input type="password" {...register("password")} />
      {errors.password && <p>{errors.password.message}</p>}

      <Button type="submit">Log In</Button>
    </form>
  )
}
```

**Why this pattern works:**
- **Zod** handles validation logic (reusable, testable, type-safe)
- **React Hook Form** handles form state (no re-renders on every keystroke)
- **`zodResolver`** bridges the two
- **TypeScript types are auto-inferred** from the Zod schema (single source of truth)

### 3.6 UI Component Library

The `src/components/ui/` directory contains reusable, styled primitives. They follow the **variant pattern** -- each component accepts a `variant` and `size` prop.

**Example: Button component:**

```tsx
// src/components/ui/button.tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link"
  size?: "default" | "sm" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium ...",
          {
            "bg-slate-900 text-white hover:bg-slate-800": variant === "default",
            "border border-slate-200 bg-white hover:bg-slate-100": variant === "outline",
            "hover:bg-slate-100": variant === "ghost",
          },
          {
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
          },
          className  // allow override via className prop
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
```

**Key utility: `cn()`** -- a helper that merges Tailwind classes intelligently:

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`clsx` handles conditional classes. `twMerge` resolves Tailwind conflicts (e.g., if you pass both `bg-red-500` and `bg-blue-500`, the last one wins instead of both being applied).

### 3.7 Key Pages Overview

| Page | Route | Role | What It Does |
|------|-------|------|-------------|
| `HomePage` | `/` | Public | Landing page |
| `LoginPage` | `/login` | Public | Login form |
| `SignupPage` | `/signup` | Public | Sign up (student or teacher) |
| `TeachersPage` | `/teachers` | Public | Browse all teachers |
| `TeacherDetailPage` | `/teachers/:id` | Public | View teacher profile + purchase packages |
| `DashboardPage` | `/dashboard` | Auth | Student/teacher dashboard (lessons, earnings) |
| `LessonsPage` | `/lessons` | Auth | View and manage all lessons |
| `SettingsPage` | `/settings` | Auth | User settings (timezone, profile) |
| `TeacherOnboardingPage` | `/teacher/onboarding` | Auth | Teacher completes Stripe Connect setup |
| `AdminDashboardPage` | `/admin` | Admin | Approve lesson payouts |

---

## 4. Backend Architecture (Deep Dive)

### 4.1 What is Supabase?

If you're coming from pure frontend, think of Supabase as **"a backend you don't have to build."** It gives you:

| What you'd normally build | Supabase equivalent |
|---------------------------|-------------------|
| Express/Django server | Not needed -- client talks to Supabase directly |
| PostgreSQL database | Provided and managed |
| User auth (JWT, sessions) | Supabase Auth (built-in) |
| REST API for CRUD | Auto-generated from your database schema |
| Serverless functions | Edge Functions (Deno/TypeScript) |
| File storage | Supabase Storage (not used in this project) |

**How the frontend talks to Supabase:**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { detectSessionInUrl: true },
})
```

This `supabase` client is used everywhere. It handles:
- **Auth:** `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, etc.
- **Database queries:** `supabase.from('table').select()`, `.insert()`, `.update()`, etc.
- **RPC calls:** `supabase.rpc('function_name', { params })` -- calls PostgreSQL functions directly
- **Edge Function calls:** `supabase.functions.invoke('function-name', { body: {...} })`

**Important security concept:** The `anon key` is a public key. It's safe to expose in frontend code. Security comes from **Row Level Security (RLS)** policies in the database, which control what each user can read/write.

### 4.2 Database Schema

Here is every table in the database and how they relate:

```
+---------------+     +-------------------+     +------------------------+
|   auth.users  |     |   public.users    |     |  teacher_profiles      |
|   (Supabase)  |---->|   id (FK)         |---->|  user_id (FK)          |
|               |     |   email           |     |  bio, subjects         |
|               |     |   role            |     |  hourly_rate           |
|               |     |   display_name    |     |  stripe_connect_id     |
|               |     |   timezone        |     |  stripe_connect_status |
+---------------+     +-------------------+     |  available_balance     |
                                                |  pending_balance       |
                                                +------------------------+
                                                         |
                                                         | (teacher_id)
                                                         v
+-------------------+     +-------------------+     +-------------------+
|    packages       |---->|     lessons       |     | teacher_lesson_   |
|    student_id(FK) |     |   package_id (FK) |     |   offerings       |
|    teacher_id(FK) |     |   teacher_id (FK) |     |   teacher_id (FK) |
|    total_classes   |     |   student_id (FK) |     |   duration_minutes|
|    remaining_classes|    |   scheduled_at    |     |   single_rate     |
|    price_per_class |     |   duration_minutes|     |   package_5_rate  |
|    total_amount    |     |   status          |     |   package_10_rate |
|    duration_minutes|     |   auto_release_at |     |   is_active       |
|    status          |     |   meeting_link    |     +-------------------+
|    stripe_pi_id   |     |   notes           |
+-------------------+     +-------------------+

+-------------------+     +-------------------+     +-------------------+
|  transactions     |     |  monthly_earnings |     |  webhook_events   |
|  user_id (FK)     |     |  teacher_id (FK)  |     |  stripe_event_id  |
|  type             |     |  year, month      |     |  type             |
|  amount           |     |  total_amount     |     |  processed_at     |
|  status           |     |  lesson_count     |     |  metadata         |
|  stripe_pi_id     |     +-------------------+     +-------------------+
|  metadata (JSONB) |
+-------------------+
```

#### Table Details

**`users`** -- Core user profile. Created automatically when someone signs up (via `handle_new_user` trigger). The `id` is a foreign key to Supabase's `auth.users` -- this links the auth system to application data.

```sql
CREATE TABLE users (
    id uuid NOT NULL,              -- same as auth.users.id
    email text NOT NULL,
    role text NOT NULL,            -- 'student' or 'teacher'
    display_name text,
    timezone text DEFAULT 'UTC',
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT users_role_check CHECK (role IN ('student', 'teacher'))
);
```

**`teacher_profiles`** -- Extended data for teachers. Also auto-created on signup for teacher-role users. Contains Stripe Connect integration fields and balance tracking.

**`teacher_lesson_offerings`** -- Duration-based pricing. Teachers can offer 30, 45, or 60-minute lessons, each with independent single/5-pack/10-pack rates.

```sql
CREATE TABLE teacher_lesson_offerings (
    id uuid PRIMARY KEY,
    teacher_id uuid REFERENCES users(id),
    duration_minutes integer CHECK (duration_minutes IN (30, 45, 60)),
    single_rate numeric(10,2) NOT NULL,
    package_5_rate numeric(10,2),        -- NULL = not offered
    package_10_rate numeric(10,2),       -- NULL = not offered
    is_active boolean DEFAULT true,
    CONSTRAINT unique_teacher_duration UNIQUE (teacher_id, duration_minutes)
);
```

**`packages`** -- When a student purchases classes, a package record is created. `remaining_classes` is decremented on each booking and incremented on cancellation.

**`lessons`** -- Individual lesson bookings. The `status` field is the heart of the business logic (see [Section 6](#6-core-business-logic)).

**`transactions`** -- Audit trail for all money movement. The `metadata` JSONB column stores flexible context (lesson IDs, fee breakdowns, etc.).

**`monthly_earnings`** -- Aggregated teacher earnings by month. Updated automatically by a trigger on the `transactions` table.

**`webhook_events`** -- Records every Stripe webhook event processed. The `stripe_event_id` has a UNIQUE constraint, which is critical for idempotency (see [Section 7](#7-key-architectural-patterns--concepts)).

### 4.3 Row Level Security (RLS)

**What is RLS?** Row Level Security is PostgreSQL's way of restricting which rows a user can see or modify. It's like having an invisible `WHERE` clause automatically appended to every query.

**Why it matters:** Without RLS, any user with the anon key could read ALL data from ALL tables. With RLS, each user can only access their own data (unless a policy says otherwise).

**How it works:**
1. You enable RLS on a table: `ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;`
2. You create policies that define who can do what
3. Every query is filtered through these policies

**Real policies from this project:**

```sql
-- Students can only see their own lessons
CREATE POLICY "Students can view own lessons" ON lessons
  FOR SELECT
  USING (auth.uid() = student_id);

-- Teachers can see their own lessons
CREATE POLICY "Teachers can view their lessons" ON lessons
  FOR SELECT
  USING (auth.uid() = teacher_id);

-- Students can book lessons (insert where they are the student)
CREATE POLICY "Students can book lessons" ON lessons
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Anyone can view teacher profiles (public browsing)
CREATE POLICY "Public can view teacher profiles" ON teacher_profiles
  FOR SELECT
  USING (true);     -- "true" means no restriction

-- Teachers can only update their own profile
CREATE POLICY "Teachers can update own profile" ON teacher_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**How `auth.uid()` works:** When the frontend makes a request, it includes the user's JWT in the `Authorization` header. Supabase extracts the user's ID from this JWT and makes it available as `auth.uid()` in RLS policies. This is how the database "knows" who is making the request.

### 4.4 RPC Functions (Atomic Operations)

**What is an RPC function?** RPC stands for "Remote Procedure Call." In Supabase, it means a PostgreSQL function (`CREATE FUNCTION`) that the frontend can call directly via `supabase.rpc()`.

**Why use them instead of regular queries?** When you need **atomicity** -- multiple database operations that must all succeed or all fail together. If you did these as separate queries from the frontend, a network error between queries could leave your data in an inconsistent state.

#### Walkthrough: `book_lesson_atomic`

This function books a lesson. It must: (1) verify the package has classes left, (2) create the lesson, (3) deduct a class from the package, (4) update the teacher's pending balance -- all in one transaction.

```sql
-- supabase/migrations/20260127100000_add_lesson_durations.sql
CREATE OR REPLACE FUNCTION book_lesson_atomic(
    p_package_id uuid,
    p_teacher_id uuid,
    p_student_id uuid,
    p_scheduled_at timestamptz,
    p_meeting_link text,
    p_price_per_class numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER    -- Runs with elevated privileges (bypasses RLS)
AS $$
DECLARE
  v_lesson_id UUID;
  v_remaining_classes INTEGER;
  v_duration_minutes INTEGER;
BEGIN
  -- Step 1: Lock the package row (FOR UPDATE prevents concurrent bookings)
  SELECT remaining_classes, duration_minutes
  INTO v_remaining_classes, v_duration_minutes
  FROM packages WHERE id = p_package_id
  FOR UPDATE;            -- <-- This is crucial. See "Atomic Transactions" in Section 7.

  -- Step 2: Validate
  IF v_remaining_classes <= 0 THEN
    RAISE EXCEPTION 'No remaining classes in this package';
  END IF;

  -- Step 3: Create the lesson
  INSERT INTO lessons (package_id, teacher_id, student_id, scheduled_at,
                       meeting_link, duration_minutes, status)
  VALUES (p_package_id, p_teacher_id, p_student_id, p_scheduled_at,
          p_meeting_link, v_duration_minutes, 'scheduled')
  RETURNING id INTO v_lesson_id;

  -- Step 4: Deduct one class
  UPDATE packages
  SET remaining_classes = remaining_classes - 1, updated_at = NOW()
  WHERE id = p_package_id;

  -- Step 5: Add to teacher's pending balance
  UPDATE teacher_profiles
  SET pending_balance = COALESCE(pending_balance, 0) + p_price_per_class,
      updated_at = NOW()
  WHERE user_id = p_teacher_id;

  RETURN v_lesson_id;    -- Return the new lesson's ID
END;
$$;
```

**Key points:**
- `SECURITY DEFINER` means this function runs with the DB owner's privileges, bypassing RLS. This is necessary because the function needs to update multiple tables atomically.
- `FOR UPDATE` locks the row. If two students try to book the last class at the same time, one waits until the other finishes (see [Section 7](#7-key-architectural-patterns--concepts)).
- The entire function is a single transaction. If any step fails, all changes are rolled back.

#### Walkthrough: `admin_approve_lesson`

This function handles the financial side when an admin approves a lesson payout:

```sql
-- supabase/migrations/20260127000000_add_admin_approval.sql
CREATE OR REPLACE FUNCTION admin_approve_lesson(p_lesson_id uuid)
RETURNS TABLE(success boolean, teacher_id uuid, teacher_connect_id text,
              transfer_amount numeric, price_per_class numeric)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_price_per_class DECIMAL;
  v_teacher_amount DECIMAL;
  -- ... other variables
BEGIN
  -- Lock lesson row and validate status
  SELECT l.status, l.package_id, l.teacher_id, l.student_id
  INTO v_lesson_status, v_package_id, v_teacher_id, v_student_id
  FROM lessons l WHERE l.id = p_lesson_id FOR UPDATE;

  IF v_lesson_status != 'awaiting_admin_approval' THEN
    RAISE EXCEPTION 'Lesson is not awaiting admin approval';
  END IF;

  -- Calculate 90/10 split
  v_teacher_amount := v_price_per_class * 0.90;

  -- Move funds: pending -> available (teacher gets 90%)
  UPDATE teacher_profiles SET
    pending_balance = GREATEST(0, pending_balance - v_price_per_class),
    available_balance = available_balance + v_teacher_amount
  WHERE user_id = v_teacher_id;

  -- Update lesson status to confirmed
  UPDATE lessons SET status = 'confirmed' WHERE id = p_lesson_id;

  -- Create transaction records for both teacher and student
  INSERT INTO transactions (user_id, type, amount, status, metadata) VALUES
    (v_teacher_id, 'lesson_payment', v_teacher_amount, 'completed',
     jsonb_build_object('lesson_id', p_lesson_id, 'platform_fee_percent', 10));

  -- Return data needed for Stripe transfer
  RETURN QUERY SELECT TRUE, v_teacher_id, v_teacher_connect_id,
                      v_teacher_amount, v_price_per_class;
END;
$$;
```

This function returns the data the Edge Function needs to create the Stripe transfer. The database work (balance updates, status change, transaction records) is atomic, and the Stripe API call happens in the Edge Function afterward.

#### Other RPC Functions

| Function | Called by | Purpose |
|----------|----------|---------|
| `book_lesson_atomic` | Student (frontend) | Book a lesson, deduct package class |
| `cancel_lesson_atomic` | Student (frontend) | Cancel a scheduled lesson, refund class |
| `complete_lesson_atomic` | Teacher (frontend) | Mark lesson as done, set 3-day auto-release timer |
| `incomplete_lesson_atomic` | Teacher (frontend) | Mark lesson as no-show, refund class |
| `student_confirm_lesson` | Edge Function | Student confirms lesson, move to admin approval |
| `admin_approve_lesson` | Edge Function | Admin approves, move balances, return Stripe data |
| `revert_admin_approval` | Edge Function | Undo approval if Stripe transfer fails |
| `release_lesson_funds` | Legacy | Original funds release (pre-admin-approval) |
| `dispute_lesson` | Student (frontend) | Student disputes a lesson |

### 4.5 Edge Functions

**What are Edge Functions?** Serverless TypeScript functions that run on Deno (not Node.js). They're similar to AWS Lambda or Vercel Serverless Functions. They run on Supabase's infrastructure.

**Why use them instead of doing everything from the frontend?**
1. **Secrets:** They can access secret environment variables (Stripe secret key, webhook secrets) that must never be in frontend code
2. **Trust boundary:** The frontend can be tampered with. Edge Functions are trusted server-side code
3. **Complex operations:** Multi-step operations involving external APIs (Stripe) that need server-side orchestration

**How the frontend calls an Edge Function:**

```typescript
const { data, error } = await supabase.functions.invoke('purchase-package', {
  body: { teacherId, packageType, durationMinutes, idempotencyKey },
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
})
```

**Common pattern in all Edge Functions:**
1. Handle CORS preflight (`OPTIONS` request)
2. Extract and verify the JWT from the `Authorization` header
3. Parse the request body
4. Validate inputs
5. Perform the operation (database calls, Stripe API calls)
6. Return JSON response

See [Section 5](#5-payment-system-deep-dive) for detailed walkthroughs of each Edge Function.

### 4.6 Triggers

**What is a trigger?** A PostgreSQL function that runs automatically in response to a database event (INSERT, UPDATE, DELETE).

#### `handle_new_user` -- Auto-creates profile on signup

When someone signs up via Supabase Auth, a row is inserted into `auth.users`. This trigger fires and creates matching rows in `public.users` (and `teacher_profiles` if the role is "teacher"):

```sql
-- supabase/migrations/20260128000000_sync_timezone_in_handle_new_user.sql
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create public user record from auth metadata
  INSERT INTO public.users (id, email, role, display_name, timezone)
  VALUES (
    NEW.id,                                                    -- auth user ID
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),      -- default to student
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    timezone = EXCLUDED.timezone;

  -- If teacher, create empty teacher profile
  IF (NEW.raw_user_meta_data->>'role') = 'teacher' THEN
    INSERT INTO public.teacher_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;    -- Don't fail the signup even if this errors
END;
$$;

-- Trigger fires AFTER a new row is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Why `ON CONFLICT DO UPDATE`?** Idempotency. If the trigger fires twice (rare, but possible), it won't crash -- it'll just update the existing row.

#### `update_monthly_earnings` -- Aggregates teacher earnings

Fires after every transaction insert. If the transaction is a completed lesson payment for a teacher, it upserts the monthly earnings aggregate:

```sql
CREATE OR REPLACE FUNCTION update_monthly_earnings() RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'lesson_payment' AND NEW.status = 'completed' THEN
    -- Only for teachers (check if user has a teacher profile)
    IF EXISTS(SELECT 1 FROM teacher_profiles WHERE user_id = NEW.user_id) THEN
      INSERT INTO monthly_earnings (teacher_id, year, month, total_amount, lesson_count)
      VALUES (NEW.user_id, EXTRACT(YEAR FROM NEW.created_at),
              EXTRACT(MONTH FROM NEW.created_at), NEW.amount, 1)
      ON CONFLICT (teacher_id, year, month)
      DO UPDATE SET
        total_amount = monthly_earnings.total_amount + EXCLUDED.total_amount,
        lesson_count = monthly_earnings.lesson_count + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

### 4.7 Authentication Flow

The complete auth flow spans frontend and backend:

```
1. User fills login form
   |
2. Frontend calls supabase.auth.signInWithPassword(email, password)
   |
3. Supabase Auth validates credentials, generates JWT
   |
4. JWT returned to frontend, stored in browser (localStorage)
   |
5. Zustand store updates: set({ user: data.user })
   |
6. All subsequent API calls include JWT in Authorization header
   |
7. Supabase uses JWT to:
   - Identify the user (auth.uid() in RLS policies)
   - Apply RLS policies to database queries
   - Pass user info to Edge Functions
```

**The JWT contains:**
- User ID (`sub` claim)
- Email
- Role (from `user_metadata`)
- Expiration time
- Supabase-specific claims

**For Edge Functions**, the JWT is verified server-side:

```typescript
// In every Edge Function:
const token = authHeader.replace("Bearer ", "")
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
```

---

## 5. Payment System (Deep Dive)

### 5.1 Stripe Concepts Explained

If you've never worked with Stripe, here are the key concepts:

| Concept | What it is |
|---------|-----------|
| **PaymentIntent** | Represents a single payment attempt. You create one server-side, get a `client_secret`, and confirm it client-side with card details. |
| **Connect** | Stripe Connect lets your platform pay out to other people (teachers). Each teacher gets their own Stripe account linked to your platform. |
| **Transfer** | Moving money from your platform's Stripe balance to a connected account (teacher's Stripe account). |
| **Webhook** | Stripe sends HTTP POST requests to your server when events happen (payment succeeded, payment failed, etc.). This is how you get notified asynchronously. |
| **Idempotency Key** | A unique string you send with API requests. If the same key is sent twice, Stripe returns the same result instead of processing the request again. Prevents double charges. |

### 5.2 Package Purchase Flow (End-to-End)

Here's exactly what happens when a student buys a lesson package:

```
Student clicks "Purchase"
        |
        v
[1] PackagePurchase.tsx
    - Generates idempotency key (crypto.randomUUID())
    - Gets auth session token
    - Calls purchase-package Edge Function
        |
        v
[2] purchase-package Edge Function
    - Verifies JWT (who is this user?)
    - Looks up teacher's lesson offering for the duration
    - Calculates pricing (single, 5-pack, or 10-pack)
    - Creates Stripe PaymentIntent via Stripe API
      (with idempotency key to prevent double charges)
    - Creates "pending" transaction record in database
    - Returns clientSecret to frontend
        |
        v
[3] PackagePurchase.tsx (continued)
    - Receives clientSecret
    - Calls stripe.confirmCardPayment(clientSecret, { card element })
    - Stripe collects card details and processes payment
    - On success: creates package record in database
    - Invalidates React Query caches
        |
        v
[4] stripe-webhook Edge Function (asynchronous)
    - Stripe sends "payment_intent.succeeded" event
    - Webhook verifies signature (HMAC)
    - Checks for duplicate event (idempotency)
    - Updates transaction status to "completed"
    - Creates package record (backup, in case frontend already did)
```

**Real code from `PackagePurchase.tsx`:**

```tsx
// src/components/packages/PackagePurchase.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setProcessing(true)

  // Get fresh auth token
  const { data: { session } } = await supabase.auth.getSession()

  // Call Edge Function to create PaymentIntent
  const { data } = await supabase.functions.invoke('purchase-package', {
    body: { teacherId, packageType, durationMinutes, idempotencyKey },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  // Confirm payment with Stripe (this shows the card form)
  const { error: paymentError } = await stripe.confirmCardPayment(
    data.clientSecret,
    { payment_method: { card: elements.getElement(CardElement)! } }
  )

  // Create package record in database
  await supabase.from('packages').insert({
    student_id: user.id,
    teacher_id: teacherId,
    total_classes: classes,
    remaining_classes: classes,
    price_per_class: price / classes,
    total_amount: price,
    duration_minutes: durationMinutes,
    status: 'active',
    stripe_payment_intent_id: data.paymentIntentId,
  })

  // Refresh UI
  await queryClient.invalidateQueries({ queryKey: ['packages'] })
  onSuccess()
}
```

### 5.3 Stripe Connect Onboarding

Teachers must complete Stripe Connect onboarding before they can receive payouts.

```
Teacher clicks "Connect with Stripe"
        |
        v
[1] Frontend calls stripe-connect-onboard Edge Function
        |
        v
[2] Edge Function:
    - If teacher has no Stripe account: creates one via Stripe API
    - Stores stripe_connect_id in teacher_profiles
    - Creates Account Link (Stripe-hosted onboarding URL)
    - Returns URL to frontend
        |
        v
[3] Frontend redirects teacher to Stripe's onboarding page
        |
        v
[4] Teacher completes onboarding on Stripe's site
        |
        v
[5] Stripe redirects back to app (/dashboard?stripe_connect=success)
        |
        v
[6] Stripe sends "account.updated" webhook event
    - stripe-webhook Edge Function updates stripe_connect_status
    - Status: "active" when charges_enabled && payouts_enabled
```

### 5.4 Lesson Payment Flow (Teacher Gets Paid)

The full lifecycle from lesson completion to teacher receiving money:

```
[1] Teacher marks lesson "complete"
    - Frontend calls complete_lesson_atomic RPC
    - Status: scheduled -> pending_confirmation
    - Sets auto_release_at = NOW() + 3 days

[2] Student confirms lesson (or auto-confirms after 3 days)
    - Frontend calls confirm-lesson Edge Function
    - Edge Function calls student_confirm_lesson RPC
    - Status: pending_confirmation -> awaiting_admin_approval

[3] Admin approves lesson
    - Admin dashboard calls admin-approve-lesson Edge Function
    - Edge Function calls admin_approve_lesson RPC:
      * Calculates 90/10 split
      * Moves funds: pending_balance -> available_balance
      * Creates transaction records
      * Returns teacher's Stripe Connect ID + transfer amount
    - Edge Function creates Stripe Transfer:

        POST https://api.stripe.com/v1/transfers
        amount: transfer_amount_in_cents
        currency: eur
        destination: teacher_connect_id    // Teacher's Stripe account
        Idempotency-Key: admin-approve-{lesson_id}

    - Status: awaiting_admin_approval -> confirmed
```

### 5.5 The 90/10 Revenue Split

The platform takes a 10% fee on every confirmed lesson. This happens inside `admin_approve_lesson`:

```sql
-- Calculate teacher's amount (90% after 10% platform fee)
v_teacher_amount := v_price_per_class * 0.90;

-- Move funds from pending to available (teacher gets 90%)
UPDATE teacher_profiles SET
  pending_balance = GREATEST(0, pending_balance - v_price_per_class),
  available_balance = available_balance + v_teacher_amount
WHERE user_id = v_teacher_id;
```

So if a lesson costs EUR 20:
- Teacher receives: EUR 18 (90%)
- Platform keeps: EUR 2 (10%)

The Stripe Transfer sends EUR 18 to the teacher's connected account. The platform retains EUR 2 in its own Stripe balance.

### 5.6 Webhook Processing

Stripe sends events to the `stripe-webhook` Edge Function. This function is critical for reliability -- it handles payment confirmations, failures, refunds, and Connect account updates.

**Signature verification (preventing spoofed requests):**

```typescript
// supabase/functions/stripe-webhook/index.ts
async function verifyStripeSignature(
  payload: string, signature: string, webhookSecret: string
): Promise<boolean> {
  // Parse the Stripe-Signature header
  const timestamp = ...      // t=<timestamp>
  const receivedSignature = ...  // v1=<signature>

  // Reject old events (>5 minutes) to prevent replay attacks
  if (timestampAge > 300) return false

  // Compute expected signature using HMAC-SHA256
  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey("raw", webhookSecret, ...)
  const expectedSignature = await crypto.subtle.sign("HMAC", key, signedPayload)

  // Constant-time comparison (prevents timing attacks)
  return timingSafeEqual(expectedSignature, receivedSignature)
}
```

**Idempotency (preventing duplicate processing):**

```typescript
// Check if already processed
const { data: existingEvent } = await supabaseAdmin
  .from("webhook_events")
  .select("id")
  .eq("stripe_event_id", event.id)
  .maybeSingle()

if (existingEvent) {
  return Response.json({ received: true, message: "Already processed" })
}

// Record event BEFORE processing (optimistic locking)
const { error: insertError } = await supabaseAdmin
  .from("webhook_events")
  .insert({
    stripe_event_id: event.id,
    type: event.type,
    status: "processing",
  })

// If insert fails with unique constraint violation, another request is handling it
if (insertError?.code === "23505") {
  return Response.json({ received: true, message: "Already processing" })
}
```

**Events handled:**

| Event | What happens |
|-------|-------------|
| `payment_intent.succeeded` | Update transaction to "completed", create package record |
| `payment_intent.payment_failed` | Update transaction to "failed" |
| `charge.refunded` | Create refund transaction, mark package as "refunded" |
| `charge.dispute.created` | Flag transaction, mark pending lessons as "disputed" |
| `account.updated` | Update teacher's `stripe_connect_status` |
| `account.application.deauthorized` | Mark teacher's Connect as "inactive" |
| `transfer.created` | Audit log |
| `payout.paid` / `payout.failed` | Audit log |

### 5.7 Balance Tracking

Teachers have two balance fields in `teacher_profiles`:

| Field | Meaning |
|-------|---------|
| `pending_balance` | Money from booked but not yet confirmed lessons. Increases on booking, decreases on confirmation or cancellation. |
| `available_balance` | Money from confirmed lessons (after platform fee). This is what the teacher has "earned" and had transferred via Stripe. |

**Balance lifecycle for a single EUR 20 lesson:**

```
1. Student books lesson
   pending_balance += 20    (now: pending=20, available=0)

2. Lesson happens, teacher completes, student confirms, admin approves
   pending_balance -= 20
   available_balance += 18  (90% of 20)
   (now: pending=0, available=18)

   -- Meanwhile, EUR 18 Stripe Transfer sent to teacher's bank --

Alternative: Student cancels
   pending_balance -= 20    (now: pending=0, available=0)
   -- Package class is refunded --
```

---

## 6. Core Business Logic

### 6.1 Lesson Lifecycle State Machine

A lesson transitions through these statuses:

```
                         +------------+
    Student books     -->| scheduled  |
    (book_lesson_atomic) +-----+------+
                               |
              +----------------+----------------+
              |                                 |
     Teacher marks complete              Student cancels
    (complete_lesson_atomic)           (cancel_lesson_atomic)
              |                                 |
              v                                 v
    +-------------------+              +-----------+
    |pending_confirmation|              | cancelled |
    +--------+----------+              +-----------+
             |                              (refunds class)
    +--------+---------+
    |                  |
Student confirms    Student disputes       3-day timer expires
(confirm-lesson EF) (dispute_lesson)      (auto-release-lessons EF)
    |                  |                       |
    v                  v                       |
+------------------------+   +---------+       |
|awaiting_admin_approval |   |disputed |       |
+--------+---------------+   +---------+       |
         |                                     |
         +<------------------------------------+
         |
   Admin approves
   (admin-approve-lesson EF)
         |
         v
    +-----------+
    | confirmed |
    +-----------+
    (Stripe transfer to teacher)

    Teacher marks no-show
    (incomplete_lesson_atomic)
         |
         v
    +------------+
    | incomplete |
    +------------+
    (refunds class)
```

### 6.2 Booking Flow

When a student books a lesson from `BookingModal.tsx`:

1. Student selects date and time in **their timezone**
2. `fromZonedTime()` converts to UTC for storage
3. Both timezones are displayed for confirmation
4. On submit, `useBookLesson` mutation calls `book_lesson_atomic` RPC
5. RPC creates lesson, deducts package class, updates teacher balance -- atomically

```tsx
// src/components/lessons/BookingModal.tsx
const handleSubmit = async (e: React.FormEvent) => {
  // Convert student's local time to UTC
  const dateTimeString = `${selectedDate}T${selectedTime}:00`
  const scheduledAtUTC = fromZonedTime(dateTimeString, studentTimezone)

  // Validate future date
  if (isBefore(scheduledAtUTC, new Date())) {
    setError('Please select a future date and time')
    return
  }

  // Book via atomic RPC
  await bookLesson.mutateAsync({
    packageId: pkg.id,
    teacherId: pkg.teacher_id,
    scheduledAt: scheduledAtUTC,
  })
}
```

### 6.3 Completion Flow

After a lesson occurs:

1. **Teacher** clicks "Mark Complete" in the lessons UI
2. `useCompleteLesson` mutation calls `complete_lesson_atomic` RPC
3. RPC validates: teacher owns the lesson, status is "scheduled", lesson is in the past
4. Status changes to `pending_confirmation`
5. `auto_release_at` is set to NOW() + 3 days

### 6.4 Confirmation Flow

The student has 3 days to confirm or dispute:

1. **Student** clicks "Confirm" on a pending lesson
2. `useConfirmLesson` mutation calls `confirm-lesson` Edge Function
3. Edge Function verifies the student owns the lesson
4. Calls `student_confirm_lesson` RPC -- status changes to `awaiting_admin_approval`
5. **Admin** sees the lesson in their dashboard
6. Admin clicks "Approve" -- calls `admin-approve-lesson` Edge Function
7. Edge Function calls `admin_approve_lesson` RPC (balance updates, transaction records)
8. Edge Function creates Stripe Transfer to teacher's connected account
9. If Stripe transfer fails, Edge Function calls `revert_admin_approval` to undo database changes

### 6.5 Cancellation & Dispute Flows

**Cancellation** (only for "scheduled" lessons):
- `cancel_lesson_atomic` RPC: marks lesson cancelled, refunds class to package, reduces teacher pending balance

**Incomplete** (teacher marks student no-show):
- `incomplete_lesson_atomic` RPC: marks lesson incomplete, refunds class, reduces pending balance

**Dispute** (student disputes a completed lesson):
- `dispute_lesson` RPC: marks lesson disputed, clears auto-release timer, records reason in notes

### 6.6 Timezone Handling

All times are stored in UTC in the database. Display conversion happens on the frontend.

**Storage:** `scheduled_at` is `timestamp with time zone` (PostgreSQL stores in UTC)

**User timezone:** Stored in `users.timezone` (e.g., "Europe/Berlin", "America/New_York")

**Conversion pattern:**

```tsx
// Convert user's local time to UTC for storage
import { fromZonedTime } from 'date-fns-tz'
const utcDate = fromZonedTime('2026-01-15T14:00:00', 'Europe/Berlin')

// Convert UTC to user's local time for display
import { formatInTimezone } from '@/hooks/useTimezone'
const display = formatInTimezone(utcDate, 'Europe/Berlin', 'h:mm a')
```

The `BookingModal` shows dual timezone display: both the student's time and the teacher's time for the same lesson slot.

---

## 7. Key Architectural Patterns & Concepts

### 7.1 Idempotency

**What:** An operation is idempotent if running it multiple times produces the same result as running it once.

**Why it matters:** Network requests can fail or be retried. Without idempotency, you might charge a customer twice or create duplicate records.

**Where it's used in this project:**

| Location | Mechanism |
|----------|-----------|
| **Stripe PaymentIntents** | `Idempotency-Key` header -- Stripe returns the same result if the same key is sent twice |
| **Package creation** | `UNIQUE` constraint on `packages.stripe_payment_intent_id` -- prevents duplicate packages |
| **Webhook events** | `UNIQUE` constraint on `webhook_events.stripe_event_id` -- prevents processing the same event twice |
| **Admin approval** | Idempotency key `admin-approve-{lesson_id}` on Stripe transfer -- prevents double transfers |
| **User creation trigger** | `ON CONFLICT DO UPDATE` -- if triggered twice, updates instead of crashing |

**Real example from `PackagePurchase.tsx`:**

```tsx
// Generate once per component mount (not per click)
const idempotencyKey = useMemo(
  () => `purchase-${crypto.randomUUID()}`,
  []
)
```

This key is sent with the Edge Function call. Even if the network drops and the user retries, Stripe will recognize the same key and return the original result.

### 7.2 Atomic Transactions & Row Locking

**What:** Multiple database operations wrapped in a single transaction, with row-level locking to prevent concurrent conflicts.

**The problem:** Two students try to book the last class in a package at the same time.

```
Student A reads: remaining_classes = 1   (OK to book!)
Student B reads: remaining_classes = 1   (OK to book!)
Student A writes: remaining_classes = 0  (booked)
Student B writes: remaining_classes = -1 (OOPS -- oversold!)
```

**The solution: `SELECT ... FOR UPDATE`**

```sql
SELECT remaining_classes INTO v_remaining_classes
FROM packages WHERE id = p_package_id
FOR UPDATE;  -- Locks this row until the transaction ends
```

With `FOR UPDATE`:
```
Student A: SELECT ... FOR UPDATE  --> Gets lock, reads remaining_classes = 1
Student B: SELECT ... FOR UPDATE  --> WAITS (row is locked)
Student A: UPDATE remaining_classes = 0, COMMIT  --> Releases lock
Student B: SELECT returns remaining_classes = 0 --> "No remaining classes" exception
```

### 7.3 Optimistic Locking (Webhook Processing)

The webhook handler uses a different pattern: **insert before processing** (optimistic locking):

```typescript
// Record event BEFORE processing
const { error: insertError } = await supabaseAdmin
  .from("webhook_events")
  .insert({ stripe_event_id: event.id, type: event.type, status: "processing" })

// If unique constraint violation: another request is already handling this event
if (insertError?.code === "23505") {
  return Response.json({ received: true, message: "Already processing" })
}

// Only one request reaches here -- process the event
switch (event.type) { ... }
```

This is different from the RPC pattern because:
- RPC functions use `FOR UPDATE` locks (pessimistic -- lock first, then work)
- Webhook handlers use unique constraint checks (optimistic -- try to claim, fail gracefully if someone else claimed first)

### 7.4 Query Invalidation Pattern

After mutations, React Query caches must be refreshed. This project follows a consistent pattern:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["lessons"] })
  queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] })
  queryClient.invalidateQueries({ queryKey: ["packages"] })
}
```

**How it works:**
1. Mutation succeeds (e.g., lesson booked)
2. `onSuccess` fires, invalidating cache keys
3. Any component using `useQuery` with those keys marks data as stale
4. React Query automatically refetches in the background
5. Components re-render with fresh data

**Which caches to invalidate?** Think about what data changed:
- Booked a lesson? Invalidate `lessons`, `packages` (remaining_classes changed), `my-teacher-profile` (pending_balance changed)
- Confirmed a lesson? Also invalidate `transactions` (new transaction created)

### 7.5 Security Patterns

| Pattern | Where | What it prevents |
|---------|-------|-----------------|
| **Row Level Security (RLS)** | Database | Users accessing other users' data |
| **JWT verification** | Edge Functions | Unauthorized API calls |
| **HMAC webhook signatures** | Stripe webhook | Spoofed webhook events |
| **Timing-safe comparison** | Webhook signature check | Timing attacks on signature verification |
| **Replay attack prevention** | Webhook timestamp check | Replayed old webhook events |
| **Admin email check** | AdminRoute + Edge Function | Non-admins accessing admin functionality |
| **SECURITY DEFINER** | RPC functions | Controlled privilege escalation for atomic operations |

---

## 8. How Things Connect (End-to-End Traces)

### Trace 1: New Student Buys and Books

**Goal:** New user signs up, finds a teacher, buys a 5-lesson package, books a lesson.

```
1. SIGNUP
   User fills SignupForm (email, password, role="student", timezone)
                    |
   authStore.signup() --> supabase.auth.signUp()
                    |
   Supabase Auth creates auth.users row
                    |
   handle_new_user trigger fires:
     - Creates public.users row (role='student', timezone from metadata)
                    |
   JWT returned to frontend, stored in browser
   authStore updates: user = { id, email, user_metadata: { role: 'student' } }

2. BROWSE TEACHERS
   TeachersPage renders --> useTeachers() hook fires
                    |
   supabase.from('teacher_profiles').select('*, users(*)')
                    |
   RLS: "Public can view teacher profiles" allows SELECT
   Data returned: list of teachers with names, subjects, hourly rates

3. VIEW TEACHER DETAIL
   Student clicks teacher --> TeacherDetailPage renders
                    |
   useTeacher(teacherId) fetches single teacher profile
   useTeacherOfferings(teacherId) fetches lesson offerings (durations + prices)

4. BUY PACKAGE
   Student selects 5-class package for 45-minute lessons
   PackagePurchase component mounts
                    |
   idempotencyKey generated (once, via useMemo)
                    |
   User enters card --> clicks "Pay EUR XX"
                    |
   supabase.functions.invoke('purchase-package', { body: {...} })
                    |
   [Edge Function] purchase-package:
     - Verifies JWT
     - Looks up teacher offering for 45 minutes
     - Calculates: 5 classes * package_5_rate
     - Creates Stripe PaymentIntent (idempotency key included)
     - Creates pending transaction
     - Returns clientSecret
                    |
   stripe.confirmCardPayment(clientSecret, { card })
                    |
   Stripe processes payment
                    |
   Frontend creates package in database:
     { student_id, teacher_id, total_classes: 5, remaining_classes: 5,
       duration_minutes: 45, stripe_payment_intent_id: 'pi_xxx' }
                    |
   [Async] Webhook: payment_intent.succeeded
     - Updates transaction to 'completed'
     - Creates package (backup, idempotent via unique constraint)
                    |
   queryClient.invalidateQueries(['packages']) --> UI refreshes

5. BOOK LESSON
   Student opens BookingModal
   Selects date and time in their timezone
                    |
   fromZonedTime() converts to UTC
                    |
   bookLesson.mutateAsync() --> supabase.rpc('book_lesson_atomic', {...})
                    |
   [RPC] book_lesson_atomic:
     - Locks package row (FOR UPDATE)
     - Checks remaining_classes > 0
     - Creates lesson (status: 'scheduled', duration: 45 min)
     - Decrements remaining_classes (5 -> 4)
     - Adds to teacher's pending_balance
                    |
   Cache invalidation: lessons, packages, my-teacher-profile
   UI shows new lesson in upcoming lessons list
```

### Trace 2: Lesson Completion to Teacher Payout

**Goal:** Lesson happened, teacher marks complete, student confirms, admin approves, teacher gets paid.

```
1. TEACHER MARKS COMPLETE
   Teacher sees past lesson in LessonsPage
   Clicks "Mark as Completed"
                    |
   useCompleteLesson().mutateAsync(lessonId)
     --> supabase.rpc('complete_lesson_atomic', { p_lesson_id, p_teacher_id })
                    |
   [RPC] complete_lesson_atomic:
     - Locks lesson row
     - Validates: teacher owns it, status='scheduled', lesson in the past
     - Updates status: 'scheduled' -> 'pending_confirmation'
     - Sets auto_release_at = NOW() + 3 days
                    |
   Student sees lesson as "Pending Your Confirmation"

2. STUDENT CONFIRMS
   Student clicks "Confirm Lesson"
                    |
   useConfirmLesson().mutateAsync(lessonId)
     --> supabase.functions.invoke('confirm-lesson', { body: { lessonId } })
                    |
   [Edge Function] confirm-lesson:
     - Verifies JWT, confirms student owns the lesson
     - Validates status is 'pending_confirmation'
     - Calls student_confirm_lesson RPC
                    |
   [RPC] student_confirm_lesson:
     - Locks lesson row
     - Updates status: 'pending_confirmation' -> 'awaiting_admin_approval'
     - Clears auto_release_at
                    |
   Lesson now visible in Admin Dashboard

3. ADMIN APPROVES
   Admin opens /admin dashboard
   Sees lesson(s) awaiting approval
   Clicks "Approve"
                    |
   Calls admin-approve-lesson Edge Function
                    |
   [Edge Function] admin-approve-lesson:
     - Verifies JWT, confirms user is admin (email === ADMIN_EMAIL)
     - Validates lesson status is 'awaiting_admin_approval'
     - Calls admin_approve_lesson RPC
                    |
   [RPC] admin_approve_lesson:
     - Locks lesson row
     - Gets price_per_class from package (e.g., EUR 15)
     - Calculates teacher_amount = 15 * 0.90 = EUR 13.50
     - Updates teacher_profiles:
         pending_balance -= 15
         available_balance += 13.50
     - Updates lesson status: 'awaiting_admin_approval' -> 'confirmed'
     - Creates two transaction records (teacher + student)
     - Returns: { teacher_connect_id: 'acct_xxx', transfer_amount: 13.50 }
                    |
   [Edge Function continues]:
     - Creates Stripe Transfer:
         POST /v1/transfers
         amount: 1350 (cents)
         currency: eur
         destination: acct_xxx
         Idempotency-Key: admin-approve-{lesson_id}
                    |
     - If transfer fails: calls revert_admin_approval RPC
       (undoes balance changes, deletes transactions, reverts status)
     - If transfer succeeds: done! Teacher will see funds in their Stripe account
                    |
   Teacher's available_balance updated in UI
   Transaction appears in teacher's wallet history

4. (ALTERNATIVE) AUTO-RELEASE
   If student doesn't confirm within 3 days:
                    |
   auto-release-lessons Edge Function (called by cron/scheduler):
     - Finds lessons where status='pending_confirmation' AND auto_release_at <= NOW()
     - For each: calls student_confirm_lesson RPC
     - Status moves to 'awaiting_admin_approval'
     - Admin still needs to approve
```

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| **RLS (Row Level Security)** | PostgreSQL feature that restricts which rows a user can access based on policies. Acts as an automatic WHERE clause on every query. |
| **RPC (Remote Procedure Call)** | A PostgreSQL function called directly from the frontend via `supabase.rpc()`. Used for atomic operations that need multiple database writes. |
| **Edge Function** | A serverless function running on Deno (TypeScript) in Supabase's infrastructure. Used for operations requiring secrets (Stripe keys) or complex orchestration. |
| **JWT (JSON Web Token)** | A signed token issued by Supabase Auth after login. Contains user ID, email, and metadata. Sent with every request to authenticate the user. |
| **PaymentIntent** | Stripe's representation of a payment attempt. Created server-side, confirmed client-side with card details. |
| **Connect (Stripe Connect)** | Stripe's platform for paying out to third parties. Teachers each have a Connected Account that receives transfers. |
| **Transfer** | Moving money from the platform's Stripe balance to a teacher's Connected Account. |
| **Webhook** | An HTTP POST request sent by Stripe to our server when events occur (payment succeeded, refund, etc.). |
| **Idempotency** | The property that running an operation multiple times produces the same result. Critical for payment processing (prevents double charges). |
| **Idempotency Key** | A unique string sent with Stripe API requests. If the same key is reused, Stripe returns the cached result instead of processing again. |
| **FOR UPDATE** | SQL clause that locks selected rows until the current transaction ends. Prevents concurrent modifications (race conditions). |
| **SECURITY DEFINER** | PostgreSQL function attribute that runs the function with the privileges of the user who created it (usually postgres), bypassing RLS. |
| **Atomic Transaction** | A set of database operations that either all succeed or all fail together. No partial state. |
| **Optimistic Locking** | A concurrency strategy where you proceed with the operation and handle conflicts (duplicate key violations) gracefully instead of locking upfront. |
| **Query Invalidation** | Telling React Query that cached data is stale and should be refetched. Happens after mutations to keep the UI in sync. |
| **HMAC** | Hash-based Message Authentication Code. Used to verify Stripe webhook signatures -- proves the request genuinely came from Stripe. |
| **Zustand** | A lightweight state management library for React. Used here for global auth state. Simpler than Redux (no actions, reducers, or dispatchers). |
| **React Query (TanStack Query)** | A library for fetching, caching, and synchronizing server state. Handles loading states, errors, caching, background refetching, and cache invalidation. |
| **Zod** | A TypeScript-first schema validation library. Used to validate form inputs. Schemas double as TypeScript types. |
| **Deno** | A JavaScript/TypeScript runtime (alternative to Node.js) used by Supabase Edge Functions. Has built-in TypeScript support and Web APIs. |
| **staleTime** | React Query setting. How long cached data is considered "fresh." During this time, queries return cached data without refetching. Set to 5 minutes in this project. |
| **pending_balance** | Money attributed to a teacher from booked lessons that haven't been confirmed/approved yet. |
| **available_balance** | Money the teacher has earned from confirmed lessons (after the 10% platform fee). |
