-- ============================================================
-- Bulk Import: Auto-create missing entities
-- - bulk_import_tenants: auto-create property if address not found
-- - bulk_import_properties: auto-create tenants if name/phone present
-- ============================================================


-- ─── 1. Update bulk_import_tenants ────────────────────────
-- When property_address doesn't match, create the property instead of erroring.

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

    -- Match property by address (case-insensitive)
    v_property_id := NULL;
    IF v_property_address IS NOT NULL AND v_property_address <> '' THEN
      -- Try exact match
      SELECT id INTO v_property_id
      FROM c1_properties
      WHERE property_manager_id = p_pm_id
        AND lower(trim(address)) = lower(v_property_address)
      LIMIT 1;

      -- Try contains match
      IF v_property_id IS NULL THEN
        SELECT id INTO v_property_id
        FROM c1_properties
        WHERE property_manager_id = p_pm_id
          AND lower(address) LIKE '%' || lower(v_property_address) || '%'
        LIMIT 1;
      END IF;

      -- Auto-create property if not found
      IF v_property_id IS NULL THEN
        INSERT INTO c1_properties (
          property_manager_id, address,
          _import_batch_id, _imported_at
        ) VALUES (
          p_pm_id,
          v_property_address,
          v_batch_id,
          now()
        )
        RETURNING id INTO v_property_id;
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


-- ─── 2. Update bulk_import_properties ─────────────────────
-- If tenant fields (full_name, phone) are present, auto-create tenants.

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
  v_property_id uuid;
  v_tenant_name text;
  v_tenant_phone text;
  v_tenant_email text;
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
      v_property_id := v_existing_id;
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'skipped', 'error', 'Property already exists', 'id', v_existing_id
      );
    ELSE
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

      v_property_id := v_new_id;
      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_idx, 'status', 'created', 'id', v_new_id
      );
    END IF;

    -- Auto-create tenant if name or phone is present
    v_tenant_name := trim(v_row->>'full_name');
    v_tenant_phone := normalize_uk_phone(v_row->>'phone');
    v_tenant_email := nullif(lower(trim(v_row->>'email')), '');

    IF v_property_id IS NOT NULL AND
       ((v_tenant_name IS NOT NULL AND v_tenant_name <> '') OR
        (v_tenant_phone IS NOT NULL AND v_tenant_phone <> '')) THEN

      -- Check tenant doesn't already exist at this property
      DECLARE v_existing_tenant uuid;
      BEGIN
        IF v_tenant_name IS NOT NULL AND v_tenant_name <> '' THEN
          SELECT id INTO v_existing_tenant
          FROM c1_tenants
          WHERE property_manager_id = p_pm_id
            AND property_id = v_property_id
            AND lower(trim(full_name)) = lower(v_tenant_name)
          LIMIT 1;
        END IF;

        IF v_existing_tenant IS NULL THEN
          INSERT INTO c1_tenants (
            property_manager_id, property_id, full_name,
            phone, email,
            _import_batch_id, _imported_at
          ) VALUES (
            p_pm_id,
            v_property_id,
            nullif(v_tenant_name, ''),
            v_tenant_phone,
            v_tenant_email,
            v_batch_id,
            now()
          );
        END IF;
      END;
    END IF;
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
