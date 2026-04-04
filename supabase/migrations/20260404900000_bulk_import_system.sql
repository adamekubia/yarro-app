-- ============================================================
-- Bulk Import System
-- 1. Fix contractor unique indexes (scope to PM)
-- 2. Add normalize_uk_phone() function
-- 3. Update bulk_import_properties + bulk_import_tenants
-- 4. Create bulk_import_contractors
-- ============================================================


-- ─── 1. Fix contractor unique indexes ─────────────────────
-- These were globally scoped — two PMs couldn't independently
-- add a contractor with the same name/category or email.
-- Now scoped to property_manager_id (correct for multi-tenancy).

DROP INDEX IF EXISTS contractors_name_cat_unique;
DROP INDEX IF EXISTS contractors_email_unique;

CREATE UNIQUE INDEX contractors_name_cat_pm_unique
  ON c1_contractors (property_manager_id, category, lower(contractor_name));

CREATE UNIQUE INDEX contractors_email_pm_unique
  ON c1_contractors (property_manager_id, lower(contractor_email))
  WHERE contractor_email IS NOT NULL;


-- ─── 2. normalize_uk_phone() ──────────────────────────────
-- Reusable phone normalization: any UK format → 447XXXXXXXXX
-- Matches the frontend normalizePhone() in src/lib/normalize.ts

CREATE OR REPLACE FUNCTION normalize_uk_phone(raw text)
RETURNS text AS $$
DECLARE
  cleaned text;
  digits text;
BEGIN
  IF raw IS NULL OR trim(raw) = '' THEN
    RETURN NULL;
  END IF;

  -- Strip (0) pattern (e.g., +44 (0)7xxx)
  cleaned := regexp_replace(raw, '\(0\)', '', 'g');
  -- Extract digits only
  digits := regexp_replace(cleaned, '\D', '', 'g');

  IF digits = '' THEN
    RETURN NULL;
  END IF;

  -- Handle various UK formats
  IF digits LIKE '0044%' THEN
    RETURN '44' || substring(digits FROM 5);
  END IF;
  IF digits LIKE '44%' THEN
    RETURN digits;
  END IF;
  IF digits LIKE '0%' THEN
    RETURN '44' || substring(digits FROM 2);
  END IF;
  IF length(digits) = 10 AND digits LIKE '7%' THEN
    RETURN '44' || digits;
  END IF;

  -- Already in correct format or international
  RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ─── 3. Update bulk_import_properties ─────────────────────
-- Add normalize_uk_phone() to landlord_phone

CREATE OR REPLACE FUNCTION bulk_import_properties(
  p_pm_id uuid,
  p_data jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_results jsonb := '[]'::jsonb;
  v_row jsonb;
  v_idx int := 0;
  v_address text;
  v_existing_id uuid;
  v_new_id uuid;
  v_created int := 0;
  v_skipped int := 0;
  v_errored int := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    v_idx := v_idx + 1;
    v_address := trim(v_row->>'address');

    -- Validate required fields
    IF v_address IS NULL OR v_address = '' THEN
      v_errored := v_errored + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'error', 'error', 'Address is required'
      );
      CONTINUE;
    END IF;

    -- Check for duplicate (case-insensitive)
    SELECT id INTO v_existing_id
    FROM c1_properties
    WHERE property_manager_id = p_pm_id
      AND lower(trim(address)) = lower(v_address)
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'skipped', 'error', 'Property already exists', 'id', v_existing_id
      );
      CONTINUE;
    END IF;

    -- Insert new property
    INSERT INTO c1_properties (
      property_manager_id, address, property_type, city,
      landlord_name, landlord_phone, landlord_email,
      _import_batch_id, _imported_at
    ) VALUES (
      p_pm_id,
      v_address,
      nullif(trim(v_row->>'property_type'), ''),
      nullif(trim(v_row->>'city'), ''),
      nullif(trim(v_row->>'landlord_name'), ''),
      normalize_uk_phone(v_row->>'landlord_phone'),
      nullif(trim(v_row->>'landlord_email'), ''),
      v_batch_id,
      now()
    )
    RETURNING id INTO v_new_id;

    v_created := v_created + 1;
    v_results := v_results || jsonb_build_object(
      'row', v_idx, 'status', 'created', 'id', v_new_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'results', v_results,
    'total', v_idx,
    'created', v_created,
    'skipped', v_skipped,
    'errors', v_errored
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. Update bulk_import_tenants ────────────────────────
-- Add normalize_uk_phone() to phone

CREATE OR REPLACE FUNCTION bulk_import_tenants(
  p_pm_id uuid,
  p_data jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_results jsonb := '[]'::jsonb;
  v_row jsonb;
  v_idx int := 0;
  v_full_name text;
  v_phone text;
  v_property_address text;
  v_property_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
  v_created int := 0;
  v_skipped int := 0;
  v_errored int := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    v_idx := v_idx + 1;
    v_full_name := trim(v_row->>'full_name');
    v_phone := normalize_uk_phone(v_row->>'phone');
    v_property_address := trim(v_row->>'property_address');

    -- Validate: need at least a name or phone
    IF (v_full_name IS NULL OR v_full_name = '') AND (v_phone IS NULL OR v_phone = '') THEN
      v_errored := v_errored + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'error', 'error', 'Name or phone is required'
      );
      CONTINUE;
    END IF;

    -- Match property by address (case-insensitive, partial match)
    v_property_id := NULL;
    IF v_property_address IS NOT NULL AND v_property_address <> '' THEN
      SELECT id INTO v_property_id
      FROM c1_properties
      WHERE property_manager_id = p_pm_id
        AND lower(trim(address)) = lower(v_property_address)
      LIMIT 1;

      -- If exact match fails, try contains match
      IF v_property_id IS NULL THEN
        SELECT id INTO v_property_id
        FROM c1_properties
        WHERE property_manager_id = p_pm_id
          AND lower(address) LIKE '%' || lower(v_property_address) || '%'
        LIMIT 1;
      END IF;

      IF v_property_id IS NULL THEN
        v_errored := v_errored + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_idx, 'status', 'error',
          'error', 'No matching property found for: ' || v_property_address
        );
        CONTINUE;
      END IF;
    END IF;

    -- Check for duplicate (same name + same property)
    IF v_full_name IS NOT NULL AND v_full_name <> '' AND v_property_id IS NOT NULL THEN
      SELECT id INTO v_existing_id
      FROM c1_tenants
      WHERE property_manager_id = p_pm_id
        AND property_id = v_property_id
        AND lower(trim(full_name)) = lower(v_full_name)
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_idx, 'status', 'skipped',
          'error', 'Tenant already exists at this property', 'id', v_existing_id
        );
        CONTINUE;
      END IF;
    END IF;

    -- Insert new tenant
    INSERT INTO c1_tenants (
      property_manager_id, property_id, full_name,
      phone, email, role_tag,
      _import_batch_id, _imported_at
    ) VALUES (
      p_pm_id,
      v_property_id,
      nullif(v_full_name, ''),
      v_phone,
      nullif(trim(v_row->>'email'), ''),
      nullif(trim(v_row->>'role_tag'), ''),
      v_batch_id,
      now()
    )
    RETURNING id INTO v_new_id;

    v_created := v_created + 1;
    v_results := v_results || jsonb_build_object(
      'row', v_idx, 'status', 'created', 'id', v_new_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'results', v_results,
    'total', v_idx,
    'created', v_created,
    'skipped', v_skipped,
    'errors', v_errored
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 5. bulk_import_contractors ───────────────────────────
-- New RPC for contractor bulk import.
-- Dedup: (property_manager_id, category, lower(contractor_name))
-- matches the new scoped unique index.

CREATE OR REPLACE FUNCTION bulk_import_contractors(
  p_pm_id uuid,
  p_data jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_results jsonb := '[]'::jsonb;
  v_row jsonb;
  v_idx int := 0;
  v_name text;
  v_phone text;
  v_email text;
  v_categories text[];
  v_category text;
  v_service_areas text[];
  v_existing_id uuid;
  v_new_id uuid;
  v_created int := 0;
  v_skipped int := 0;
  v_errored int := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_data)
  LOOP
    v_idx := v_idx + 1;
    v_name := trim(v_row->>'contractor_name');
    v_phone := normalize_uk_phone(v_row->>'contractor_phone');
    v_email := nullif(lower(trim(v_row->>'contractor_email')), '');

    -- Parse categories (comma-separated string → array)
    v_categories := ARRAY[]::text[];
    IF v_row->>'categories' IS NOT NULL AND trim(v_row->>'categories') <> '' THEN
      SELECT array_agg(trim(cat))
      INTO v_categories
      FROM unnest(string_to_array(v_row->>'categories', ',')) AS cat
      WHERE trim(cat) <> '';
    END IF;
    v_category := COALESCE(v_categories[1], 'Other');

    -- Parse service_areas (comma-separated string → array)
    v_service_areas := ARRAY[]::text[];
    IF v_row->>'service_areas' IS NOT NULL AND trim(v_row->>'service_areas') <> '' THEN
      SELECT array_agg(trim(area))
      INTO v_service_areas
      FROM unnest(string_to_array(v_row->>'service_areas', ',')) AS area
      WHERE trim(area) <> '';
    END IF;

    -- Validate required fields
    IF v_name IS NULL OR v_name = '' THEN
      v_errored := v_errored + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'error', 'error', 'Contractor name is required'
      );
      CONTINUE;
    END IF;

    IF v_phone IS NULL OR v_phone = '' THEN
      v_errored := v_errored + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'error', 'error', 'Contractor phone is required'
      );
      CONTINUE;
    END IF;

    -- Check for duplicate (PM-scoped: category + name)
    SELECT id INTO v_existing_id
    FROM c1_contractors
    WHERE property_manager_id = p_pm_id
      AND category = v_category
      AND lower(trim(contractor_name)) = lower(v_name)
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'skipped',
        'error', 'Contractor already exists in category ' || v_category, 'id', v_existing_id
      );
      CONTINUE;
    END IF;

    -- Insert new contractor
    INSERT INTO c1_contractors (
      property_manager_id, contractor_name, contractor_phone,
      contractor_email, category, categories, service_areas,
      active, _import_batch_id, _imported_at
    ) VALUES (
      p_pm_id,
      v_name,
      v_phone,
      v_email,
      v_category,
      CASE WHEN array_length(v_categories, 1) > 0 THEN v_categories ELSE ARRAY[v_category] END,
      CASE WHEN array_length(v_service_areas, 1) > 0 THEN v_service_areas ELSE ARRAY[]::text[] END,
      true,
      v_batch_id,
      now()
    )
    RETURNING id INTO v_new_id;

    v_created := v_created + 1;
    v_results := v_results || jsonb_build_object(
      'row', v_idx, 'status', 'created', 'id', v_new_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'results', v_results,
    'total', v_idx,
    'created', v_created,
    'skipped', v_skipped,
    'errors', v_errored
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
