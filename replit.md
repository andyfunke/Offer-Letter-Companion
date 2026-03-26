# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the Kinross Offer Letter Companion app — an internal HR tool for assembling Kinross offer letters from approved clause templates.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Radix UI

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (templates + offers CRUD)
│   └── offer-letter/       # React + Vite frontend (the main app)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── templates.ts   # template_profiles table
│           ├── offers.ts      # offer_drafts table
│           └── auth.ts        # users, sessions, telemetry_issues, issue_snapshots, admin_notes
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Kinross Offer Letter Companion — Feature Summary

### Resume Upload Gate
- Required before form begins
- Parses candidate name, email, location
- Triggers relocation/immigration banners based on detected location (WA / non-local US / Canada)
- Does NOT auto-activate modules — user must confirm

### Three-column Layout
- **Left rail**: Scenario selector + saved template profile list
- **Center**: Multi-section accordion form (8 sections)
- **Right rail**: Live letter preview (letterhead + clause assembly)

### 8 Supported Scenarios
- new_hire_hourly, new_hire_salaried, salaried_fixed_term_external, internship
- promotion_hourly_role_change, promotion_hourly_to_salary
- site_to_site_transfer_salary, relocation_repayment_agreement

### Field Applicability Engine
- Three states per field: active / removed / inherited
- "Remove from consideration" X button on optional fields
- Cascading removal (e.g., removing relocation_applicable cascades to repayment agreement, policy attachment)
- Inherited fields shown in muted blue badge

### Compensation Normalization (salaried)
- rawSalary → ÷2080 → Math.ceil(×100)/100 → ×2080 → ÷26
- Shows normalization preview box, user must confirm before generation

### PTO Logic
- Defaults shown from template profile
- Tenure exception toggle
- User must explicitly confirm PTO value before export is enabled

### Template Profile System
- Save current form state as named profile
- Load profiles from left rail (fills active/removed fields + scenario)
- Inherited state tracked for loaded fields

### Validation Gate
- Unresolved decisions counter in header
- Export blocked until: resume uploaded, name/email set, PTO confirmed, governing_state set, compensation resolved, relocation/immigration details complete

### Claude Execution Payload
- "Copy Claude Payload" button generates structured JSON with scenario, candidate, resolvedFields, removedFields, clauses, attachments, letterhead, exportNotes

## Auth System

- **Session auth**: httpOnly cookie `kol_session` — 8h TTL, SHA-256 token hash stored in DB
- **Password hashing**: bcryptjs, cost factor 12
- **Bootstrap admin**: Set `BOOTSTRAP_ADMIN_USERNAME` + `BOOTSTRAP_ADMIN_PASSWORD` (dev: `admin` / `wemineforgold!23`)
- **RBAC roles**: `recruiter` → `hr_admin` → `system_admin` (hierarchical)
- **Rate limiting on login**: 5 attempts / 15 min per IP
- **Audit trail**: LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, USER_CREATED, USER_DEACTIVATED, PASSWORD_RESET, ISSUE_REPORTED, etc.

## Frontend Routes

- `/login` — login page (unauthenticated)
- `/` — offer editor (requires recruiter+)
- `/admin` — admin dashboard (requires hr_admin+)
- `/admin/users` — user management (requires system_admin)
- `/admin/issues` — issue list (requires hr_admin+)
- `/admin/issues/:id` — issue detail (requires hr_admin+)
- `/admin/issues/:id/preview` — read-only structural preview (requires hr_admin+)
- `/security` — security policy (public)

## API Endpoints

- `GET/POST /api/templates` — template profiles CRUD
- `GET/PUT/DELETE /api/templates/:id`
- `GET/POST /api/offers` — offer draft CRUD
- `GET/PUT/DELETE /api/offers/:id`
- `POST /api/auth/login` — login (rate limited)
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — current user
- `GET/POST /api/admin/users` — user management (system_admin)
- `PUT /api/admin/users/:id` — update user
- `POST /api/admin/users/:id/reset-password` — reset password
- `DELETE /api/admin/users/:id` — deactivate user
- `GET /api/admin/issues` — list issues (hr_admin+)
- `GET /api/admin/issues/:id` — issue detail + notes + snapshot
- `GET /api/admin/issues/:id/preview` — structural snapshot
- `PUT /api/admin/issues/:id/status` — update status
- `POST /api/admin/issues/:id/notes` — append note
- `POST /api/telemetry/issues` — report issue (recruiter+)
- `GET /api/telemetry/issues` — own issues (recruiter+)

## Database Tables

- `template_profiles` — saved template configurations
- `offer_drafts` — saved form state / drafts
- `users` — user accounts (bcrypt password hash, role, active status)
- `sessions` — server-side sessions (token hash, expiry, user agent)
- `telemetry_issues` — user-reported issues with structural metadata
- `issue_snapshots` — sanitized structural page snapshots (no candidate data)
- `admin_notes` — append-only admin notes on issues

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod schemas

## Dev Notes

- After OpenAPI spec changes, run codegen and restart workflows
- DB schema changes: edit `lib/db/src/schema/`, run `pnpm --filter @workspace/db run push`
- Port: offer-letter frontend on 23238, api-server on 8080
