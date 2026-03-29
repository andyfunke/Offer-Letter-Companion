-- Run once on the Replit Postgres DB to add per-user ownership to templates.
-- Safe to run multiple times (idempotent via IF NOT EXISTS).

ALTER TABLE template_profiles
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE CASCADE;
