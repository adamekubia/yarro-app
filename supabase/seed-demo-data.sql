-- =============================================================
-- Yarro PM — Demo Seed Data
-- Run this in the Supabase SQL Editor (one-shot, idempotent-ish)
-- =============================================================
-- Creates: 1 property, 5 rooms, 4 tenants, compliance certs + requirements
-- Assumes: You have at least one row in c1_property_managers
-- =============================================================

DO $$
DECLARE
  v_pm_id       uuid;
  v_property_id uuid;
  v_room1_id    uuid := gen_random_uuid();
  v_room2_id    uuid := gen_random_uuid();
  v_room3_id    uuid := gen_random_uuid();
  v_room4_id    uuid := gen_random_uuid();
  v_room5_id    uuid := gen_random_uuid();
  v_tenant1_id  uuid := gen_random_uuid();
  v_tenant2_id  uuid := gen_random_uuid();
  v_tenant3_id  uuid := gen_random_uuid();
  v_tenant4_id  uuid := gen_random_uuid();
BEGIN
  -- -------------------------------------------------------
  -- 1. Get your property manager ID (first PM found)
  -- -------------------------------------------------------
  SELECT id INTO v_pm_id
  FROM public.c1_property_managers
  WHERE id = '2a4bf89e-e368-4af9-a5f0-86cf16c267c3';

  IF v_pm_id IS NULL THEN
    RAISE EXCEPTION 'No property manager found. Sign in to the dashboard first.';
  END IF;

  RAISE NOTICE 'Using property manager: %', v_pm_id;

  -- -------------------------------------------------------
  -- 2. Create property — a 5-bed HMO in South London
  -- -------------------------------------------------------
  INSERT INTO public.c1_properties (
    id, address, city, landlord_name, landlord_email, landlord_phone,
    property_manager_id, require_landlord_approval, auto_approve_limit,
    property_type
  ) VALUES (
    gen_random_uuid(),
    '14 Brixton Hill, London SW2 1QA',
    'London',
    'James Okafor',
    'james.okafor@example.com',
    '+447700100001',
    v_pm_id,
    true,
    150,
    'hmo'
  )
  RETURNING id INTO v_property_id;

  RAISE NOTICE 'Created property: %', v_property_id;

  -- -------------------------------------------------------
  -- 3. Create 4 tenants (without room_id — set after rooms exist)
  -- -------------------------------------------------------
  INSERT INTO public.c1_tenants (id, full_name, email, phone, property_id, property_manager_id)
  VALUES
    (v_tenant1_id, 'Amara Diallo',   'amara.diallo@example.com',   '+447700200001', v_property_id, v_pm_id),
    (v_tenant2_id, 'Ben Carter',     'ben.carter@example.com',     '+447700200002', v_property_id, v_pm_id),
    (v_tenant3_id, 'Chloe Nguyen',   'chloe.nguyen@example.com',   '+447700200003', v_property_id, v_pm_id),
    (v_tenant4_id, 'Daniel Mensah',  'daniel.mensah@example.com',  '+447700200004', v_property_id, v_pm_id);

  -- -------------------------------------------------------
  -- 4. Create 5 rooms — 4 occupied, 1 vacant
  -- -------------------------------------------------------
  INSERT INTO public.c1_rooms (
    id, property_manager_id, property_id, room_number, room_name, floor,
    current_tenant_id, tenancy_start_date, tenancy_end_date,
    monthly_rent, rent_due_day, rent_frequency
  ) VALUES
    (v_room1_id, v_pm_id, v_property_id, '1', 'Front Single',    'Ground', v_tenant1_id, '2025-09-01', '2026-08-31', 750.00,  1, 'monthly'),
    (v_room2_id, v_pm_id, v_property_id, '2', 'Rear Double',     'Ground', v_tenant2_id, '2025-11-15', '2026-11-14', 950.00,  1, 'monthly'),
    (v_room3_id, v_pm_id, v_property_id, '3', 'Front Double',    'First',  v_tenant3_id, '2026-01-01', '2026-12-31', 900.00,  1, 'monthly'),
    (v_room4_id, v_pm_id, v_property_id, '4', 'Rear Single',     'First',  v_tenant4_id, '2026-02-01', '2027-01-31', 700.00,  1, 'monthly'),
    (v_room5_id, v_pm_id, v_property_id, '5', 'Loft Conversion', 'Second', NULL,         NULL,         NULL,         850.00, 1, 'monthly');

  -- -------------------------------------------------------
  -- 4b. Back-fill room_id on tenants (dual-sync)
  -- -------------------------------------------------------
  UPDATE public.c1_tenants SET room_id = v_room1_id WHERE id = v_tenant1_id;
  UPDATE public.c1_tenants SET room_id = v_room2_id WHERE id = v_tenant2_id;
  UPDATE public.c1_tenants SET room_id = v_room3_id WHERE id = v_tenant3_id;
  UPDATE public.c1_tenants SET room_id = v_room4_id WHERE id = v_tenant4_id;

  RAISE NOTICE 'Created 5 rooms (4 occupied, 1 vacant) with dual-sync';

  -- -------------------------------------------------------
  -- 5. Compliance requirements — explicitly set which certs
  --    this HMO property needs (trigger removed, opt-in now)
  -- -------------------------------------------------------
  INSERT INTO public.c1_compliance_requirements (
    property_id, property_manager_id, certificate_type, is_required
  ) VALUES
    (v_property_id, v_pm_id, 'hmo_license',   true),
    (v_property_id, v_pm_id, 'gas_safety',    true),
    (v_property_id, v_pm_id, 'eicr',          true),
    (v_property_id, v_pm_id, 'epc',           true),
    (v_property_id, v_pm_id, 'fire_risk',     true),
    (v_property_id, v_pm_id, 'smoke_alarms',  true),
    (v_property_id, v_pm_id, 'co_alarms',     true);

  RAISE NOTICE 'Created 7 compliance requirements (HMO core — no PAT/legionella)';

  -- -------------------------------------------------------
  -- 6. Compliance certificates — mixed statuses for demo
  --    New model: document_url + expiry_date = valid. No review step.
  --    document_url uses placeholder paths (not real files).
  -- -------------------------------------------------------
  INSERT INTO public.c1_compliance_certificates (
    property_id, property_manager_id, certificate_type,
    issued_date, expiry_date, certificate_number, issued_by,
    status, reminder_days_before, document_url
  ) VALUES
    -- Gas Safety: VALID — has doc + expiry > 30 days
    (v_property_id, v_pm_id, 'gas_safety',
     '2025-12-15', '2026-12-15', 'GS-2025-4821', 'British Gas',
     'valid', 60, 'https://placeholder.example/gas-safety.pdf'),

    -- EICR: VALID — has doc + expiry > 30 days
    (v_property_id, v_pm_id, 'eicr',
     '2021-10-20', '2026-10-20', 'EICR-2021-7734', 'Spark Electrical Ltd',
     'valid', 90, 'https://placeholder.example/eicr.pdf'),

    -- HMO License: EXPIRING — has doc + expiry < 30 days (~40 days, borderline)
    (v_property_id, v_pm_id, 'hmo_license',
     '2021-05-12', '2026-05-12', 'HMO/LB/2021/0394', 'Lambeth Council',
     'valid', 60, 'https://placeholder.example/hmo-license.pdf'),

    -- EPC: EXPIRED — has doc + expiry in the past
    (v_property_id, v_pm_id, 'epc',
     '2016-02-28', '2026-02-28', 'EPC-8823-2244-0100', 'EPC Direct',
     'valid', 60, 'https://placeholder.example/epc.pdf'),

    -- Fire Risk: MISSING — has data but no document uploaded
    (v_property_id, v_pm_id, 'fire_risk',
     '2025-06-01', '2026-06-01', 'FRA-2025-1100', 'SafeGuard Assessments',
     'valid', 60, NULL);

  -- smoke_alarms and co_alarms have no cert record → display as 'missing'

  RAISE NOTICE 'Created 5 compliance certificates';
  RAISE NOTICE '  → gas_safety: valid, eicr: valid, hmo_license: valid (40d)';
  RAISE NOTICE '  → epc: expired, fire_risk: missing (no doc)';
  RAISE NOTICE '  → smoke_alarms: missing, co_alarms: missing';
  RAISE NOTICE '✓ Demo seed complete for property: 14 Brixton Hill';
END $$;
