-- ============================================================
-- Onboarding Checklist RPC — returns setup progress for new PMs
-- ============================================================

CREATE OR REPLACE FUNCTION public.c1_get_onboarding_checklist(p_pm_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_first_property_id uuid;
  v_tenant_count int;
  v_contractor_count int;
  v_cert_count int;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM c1_property_managers WHERE id = p_pm_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- First property for linking
  SELECT id INTO v_first_property_id
  FROM c1_properties
  WHERE property_manager_id = p_pm_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Counts
  SELECT count(*) INTO v_tenant_count
  FROM c1_tenants WHERE property_manager_id = p_pm_id;

  SELECT count(*) INTO v_contractor_count
  FROM c1_contractors WHERE property_manager_id = p_pm_id;

  SELECT count(*) INTO v_cert_count
  FROM c1_compliance_certificates WHERE property_manager_id = p_pm_id;

  RETURN json_build_array(
    json_build_object(
      'key', 'add_tenants',
      'label', 'Add your tenants',
      'description', 'Assign tenants to rooms',
      'complete', v_tenant_count > 0,
      'count', v_tenant_count,
      'link_href', CASE
        WHEN v_first_property_id IS NOT NULL
        THEN '/properties/' || v_first_property_id || '?tab=people'
        ELSE '/tenants'
      END
    ),
    json_build_object(
      'key', 'add_contractors',
      'label', 'Add a contractor',
      'description', 'So Yarro can dispatch repairs',
      'complete', v_contractor_count > 0,
      'count', v_contractor_count,
      'link_href', '/contractors'
    ),
    json_build_object(
      'key', 'setup_compliance',
      'label', 'Set up compliance',
      'description', 'Upload certificates and set expiry dates',
      'complete', v_cert_count > 0,
      'count', v_cert_count,
      'link_href', CASE
        WHEN v_first_property_id IS NOT NULL
        THEN '/properties/' || v_first_property_id || '?tab=compliance'
        ELSE '/compliance'
      END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.c1_get_onboarding_checklist TO authenticated;
