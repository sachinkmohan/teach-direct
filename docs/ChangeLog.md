# Changelog

All notable changes to the **Learn From A Tutor** project are documented in this file.

## [2026-01-28]

### Features

- `19ee372` feat: add password visibility toggle to login form
- `9755789` feat: add future date validation and success message for teacher profile updates
- `e5cbf43` feat: add 'incomplete' status for lessons and implement functionality to mark lessons as incomplete

### Bug Fixes

- `89b6883` bugfix: update teacher profile upsert logic to exclude stripe_connect_status and balances
- `f0c57fd` fix: memory leak on navigating away
- `188f01b` fix: validate package price and make seeds idempotent

### Refactoring

- `033eb5d` refactor: update project name to "Learn From A Tutor" across the application
- `80483f5` refactor: simplify timezone conversion logic in BookingModal

### Pull Requests Merged

- `#17` LF-21 — Teacher profile upsert bugfix
- `#16` LFT-13 — Future date validation, memory leak fix
- `#15` LFT-12 — Incomplete lesson status, seed validation
- `#14` LFT-11 — Timezone support in booking modal, project rename

## [2026-01-27 – 2026-01-28]

### Features

- `6d11501` feat: enhance booking modal with timezone support and dual time display
- `d00a056` feat: add lesson duration display to package details in DashboardPage
- `f62b962` feat: add DurationSelector component for lesson duration selection
- `861d53c` feat: add user timezone support in LessonCard and LessonsPage components
- `a6a9e20` feat: add admin approval process for lesson payouts

### Bug Fixes

- `4fc9365` fix: address CodeRabbit review — timezone bugs, security, and code quality
- `0c0e390` fix: address CodeRabbit review issues — security, validation, and type safety
- `2db31c7` fix: refactor DurationOfferingCard to improve save and cancel handling
- `a768336` fix: update validation schema for offering prices and adjust related form handling
- `ee4848f` fix: correct package_10_rate in seed.sql for accurate pricing
- `af80ee7` fix: update permissions for complete_lesson_atomic function
- `d59d9eb` fix: address PR review comments
- `333bdec` fix: ensure ADMIN_EMAIL environment variable is configured and improve code formatting
- `04aa832` fix: update auto-release period for lessons to 3 days and adjust minimum rate validations for teacher onboarding
- `f2647df` fix: enhance lesson cancellation logic to restrict cancellations to scheduled lessons and ensure earnings are recorded only for teachers

### Pull Requests Merged

- `#13` Package duration display for students
- `#11` LFT-9 — Duration-based lesson offerings
- `#10` LFT-10 — Admin approval for payouts, timezone support
- `#9` Supabase local setup (part 2) — Auto-release period, rate validations
- `#8` Supabase local setup — Lesson cancellation logic

## [2026-01-26]

### Features

- `9674449` feat: implement email confirmation handling in AppRoutes and enhance LoginForm with success messages
- `8ba4fdc` feat: add seed data for local development including test users and profiles + final schema

### Bug Fixes

- `06743bb` fix: remove unused state and improve email confirmation handling in LoginForm
- `4244f8b` fix: enhance email confirmation handling and improve navigation in AppRoutes; update SignupForm link styling
- `753f5ef` fix: add .branches to .gitignore and ensure proper newline formatting
- `5d510ab` fix: clean up .gitignore by removing SQL-related entries and consolidating backup file patterns
- `c5d1775` fix: add Netlify SPA redirects for client-side routing

### Pull Requests Merged

- `#7` Go-live fixes — Email confirmation, seed data, Netlify redirects

## [2026-01-25]

### Features

- `96e643a` feat: add CLAUDE.md for project guidance and architecture overview
- `4c39ae1` feat: implement idempotency key for package purchases and auto-release lessons
- `9e3103e` feat: implement Stripe webhook for payment processing and package creation
- `9b72f67` feat: add stripe-webhook function configuration without JWT verification
- `2ac03a9` feat: enhance Stripe webhook handling with improved signature verification and metadata validation
- `b770978` feat: implement optimistic locking for Stripe webhook event processing

### Bug Fixes

- `339f100` fix: update date handling to use UTC in monthly earnings calculation and improve transaction amount display
- `c58bde7` fix: streamline error responses and enforce idempotency key requirement in payment processing
- `9e366d0` fix: update .gitignore to include .env.local.* and *.sql.bak
- `dbb7d60` fix: correct formatting and add status field in Stripe webhook processing

### Refactoring

- `64c12de` refactor: remove WithdrawModal component and related withdrawal functionality

### Pull Requests Merged

- `#6` CP-web-hooks — Stripe webhook implementation
- `#5` Local Supabase test — Gitignore updates
- `#4` CP-8-1 — Idempotency key, auto-release lessons

## [2026-01-23 – 2026-01-24]

### Features

- `888d481` feat: implement Stripe Connect onboarding functionality and update DashboardPage
- `de5a081` feat: integrate Stripe payment processing for package purchases and add related components
- `9cfc651` feat: add lessons management feature with booking and lesson cards
- `e2b315b` feat: add transaction history and withdrawal functionality

### Bug Fixes

- `df2b19d` fix: improve error handling in purchase package function
- `df9be68` fix: improve validation and error handling in signup and teacher onboarding forms; enhance lesson status handling and booking logic; add active package filtering
- `3ddd8db` fix: lower minimum withdrawal amount to 1 and update related validations

### Chores

- `dba376d` chore: remove outdated setup and testing documentation for Stripe and Supabase

### Refactoring

- `2f18d0e` refactor: improve code formatting and consistency in Stripe Connect onboarding function
- `8d342c1` refactor: standardize formatting and improve readability in lesson and timezone hooks

### Pull Requests Merged

- `#3` CP-8 — Transaction history and withdrawal functionality
- `#2` CP-6 — Lessons management feature
- `#1` CP-5 — Stripe payment processing integration

## [2026-01-22]

### Features

- `6f3837c` feat: initialize project with React, Tailwind CSS, and Supabase integration

---

*This changelog was generated from the git commit history of the project.*
