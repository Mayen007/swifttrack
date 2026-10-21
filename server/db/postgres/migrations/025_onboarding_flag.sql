-- Migration 025: Add onboarding_completed flag to company_settings
-- Tracks whether the super-admin has completed the initial organization setup wizard.
-- Stored server-side so it survives browser clears and works across devices.

ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
