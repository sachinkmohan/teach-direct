# Local Development with Docker

Run the full stack locally — completely isolated from production data and real Stripe charges.

## Quick Start

```bash
# Terminal 1: Start local Supabase (first run takes 5–10 min)
npm run local:supabase

# Terminal 2: Start Edge Functions (only needed for payment flows)
npm run local:functions

# Terminal 3: Start the app
npm run local:start
```

---

## Prerequisites

### Docker Desktop

Supabase runs entirely inside Docker locally.

```bash
# Check if already installed
docker --version

# Install via Homebrew if not
brew install --cask docker

# Start Docker Desktop
open -a Docker

# Confirm it's running (wait 30–60 seconds after opening)
docker info
```

**Recommended Docker Desktop settings** (Settings → Resources → Advanced):
- Memory: 6–8 GB
- CPUs: 4
- Disk: 60 GB minimum

### Supabase CLI

```bash
npx supabase --version  # Should show 1.x or higher
```

---

## One-Time Setup

### 1. Frontend environment file

Create `.env.local.dev` in the project root:

```bash
# .env.local.dev — LOCAL TESTING ONLY
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<get from 'npx supabase status' after first start>
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY_HERE
VITE_APP_URL=http://localhost:5174
```

After running `npx supabase start`, get the real anon key:

```bash
npx supabase status | grep "anon key"
```

Both `.env.local.dev` and `supabase/.env.local` are already covered by the repo's `.gitignore` (via `.env.local.*` and `*.local` patterns) — no manual changes needed.

### 2. Edge Functions environment file

Create `supabase/.env.local`:

```bash
# supabase/.env.local — Edge Functions local config
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_WEBHOOK_SECRET   # optional
APP_URL=http://localhost:5174
```

---

## Starting the Stack

Open 3 terminals:

**Terminal 1 — Supabase**
```bash
npm run local:supabase
# or: npx supabase start
```

Wait for:
```text
API URL: http://127.0.0.1:54321
Studio URL: http://127.0.0.1:54323
```

**Terminal 2 — Edge Functions** *(only needed for payment flows)*
```bash
npm run local:functions
# or: npx supabase functions serve --env-file supabase/.env.local
```

**Terminal 3 — Frontend**
```bash
npm run local:start
# or: cp .env.local.dev .env.local && npm run dev
```

---

## Local Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| App | http://localhost:5174 | Frontend |
| Supabase Studio | http://127.0.0.1:54323 | Database UI — view tables, run SQL |
| API | http://127.0.0.1:54321 | REST API (for debugging) |
| Mailpit | http://127.0.0.1:54324 | View emails sent by Supabase Auth |

---

## Creating Test Users

### Via Supabase Studio (easiest)

1. Open http://127.0.0.1:54323
2. Go to **Authentication → Users → Add User**
3. Create a teacher:
   - Email: `test-teacher@example.com`
   - Password: `password123`
   - Auto Confirm: checked
   - User Metadata: `{"role": "teacher", "display_name": "Test Teacher"}`
4. Repeat for a student:
   - Email: `test-student@example.com`
   - Password: `password123`
   - User Metadata: `{"role": "student", "display_name": "Test Student"}`

### Via SQL Editor

In Studio → SQL Editor, run:

```sql
-- Test teacher
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'test-teacher@example.com', crypt('password123', gen_salt('bf')), now(),
  '{"role": "teacher", "display_name": "Test Teacher"}'::jsonb,
  'authenticated', 'authenticated', now(), now()
);

-- Test student
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at
) VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'test-student@example.com', crypt('password123', gen_salt('bf')), now(),
  '{"role": "student", "display_name": "Test Student"}'::jsonb,
  'authenticated', 'authenticated', now(), now()
);
```

---

## Verifying Isolation from Production

Before starting, confirm you're not pointed at production:

```bash
# Should show 127.0.0.1:54321 — NOT https://xxx.supabase.co
cat .env.local | grep SUPABASE_URL

# Should show pk_test_ — NOT pk_live_
cat .env.local | grep STRIPE
```

---

## Switching Environments

### Use local (testing)
```bash
cp .env.local.dev .env.local
npm run dev
```

### Use production (careful)
```bash
cp .env.local.prod .env.local   # create this from .env.example with prod values
npm run dev
```

---

## Stopping

```bash
# Ctrl+C in terminals 2 and 3, then:
npm run local:stop
# or: npx supabase stop --no-backup
```

---

## Reclaiming Disk Space

```bash
# Quick cleanup (~2–5 GB recovered)
npx supabase stop --no-backup
rm -rf .supabase/

# Stop Supabase and remove this project's local data (~2–5 GB)
npm run local:cleanup
# or: npx supabase stop --no-backup && rm -rf .supabase/

# Check how much space Docker is using
docker system df
```

---

## Troubleshooting

### "Cannot connect to Docker daemon"
```bash
open -a Docker   # wait 60 seconds
docker info
```

### Docker Desktop stuck on "Starting..."
```bash
killall Docker
rm -rf ~/Library/Containers/com.docker.docker
rm -rf ~/.docker
open -a Docker
```

### "Port 54321 already in use"
```bash
npx supabase stop
npx supabase start
```

### Database tables missing
```bash
npx supabase db reset
```

### Can't log in with test users
Run this in Studio SQL Editor to confirm the user:
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'test-student@example.com';
```

### Supabase containers fail to start
```bash
npx supabase stop --no-backup
docker rm -f $(docker ps -aq --filter "name=supabase")
docker system prune -f
npx supabase start
```

### "No space left on device"
```bash
docker system prune -a --volumes
```

### Apple Silicon: Rosetta warning
```bash
softwareupdate --install-rosetta
```

### Debug mode (verbose logs)
```bash
npx supabase start --debug
```

---

## Migration Gotchas

Lessons learned from past issues — relevant if you're adding or fixing migrations:

- **Always use full timestamps**: `YYYYMMDDHHMMSS_name.sql` — not just date. Duplicate date prefixes cause unique constraint errors.
- **Order by dependency**: `packages` must exist before `lessons` (foreign key). Use timestamp offsets to control order.
- **Never create tables manually in production**: Always use migrations so local and prod stay in sync.
- **Complex PL/pgSQL functions**: The Supabase CLI has trouble parsing multi-statement functions in migration files. Put them in `supabase/seed.sql` instead, or apply them manually via Studio SQL Editor.

---

## npm Scripts Reference

| Script | What it does |
|--------|-------------|
| `npm run local:supabase` | Start local Supabase stack |
| `npm run local:functions` | Serve Edge Functions with local env |
| `npm run local:start` | Copy local env + start frontend |
| `npm run local:stop` | Stop Supabase (discard data) |
| `npm run local:cleanup` | Stop + remove all Docker data |
