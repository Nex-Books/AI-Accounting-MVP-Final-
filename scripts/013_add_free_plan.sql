-- Add 'free' as a valid plan tier
-- Run this in Supabase SQL Editor

-- Drop the existing check constraint on companies.plan
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_plan_check;

-- Add updated constraint including 'free'
ALTER TABLE companies
  ADD CONSTRAINT companies_plan_check
  CHECK (plan IN ('free', 'essentials', 'professional', 'enterprise'));

-- Set default plan to 'free' for new companies
ALTER TABLE companies ALTER COLUMN plan SET DEFAULT 'free';

-- Backfill any NULL plans to 'free'
UPDATE companies SET plan = 'free' WHERE plan IS NULL;
