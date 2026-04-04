-- =============================================================
-- Drop dormant compliance auto-generation functions (YAR-86 + YAR-150 + YAR-148)
--
-- These functions used to auto-insert compliance requirements when
-- a property was created. The trigger was dropped in 20260402100000
-- and onboarding_create_property was updated in 20260404100000,
-- but the functions themselves were left dormant. Drop them now
-- so they can't be called accidentally, and clean up orphan rows.
--
-- Table c1_compliance_requirements is kept for rollback safety.
-- =============================================================

-- 1. Drop dormant functions
DROP FUNCTION IF EXISTS public.compliance_set_property_type(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.compliance_auto_populate_requirements();
DROP FUNCTION IF EXISTS public.compliance_upsert_requirements(uuid, uuid, jsonb);

-- 2. Clean up orphan requirement rows (no longer queried by any RPC)
DELETE FROM c1_compliance_requirements;
