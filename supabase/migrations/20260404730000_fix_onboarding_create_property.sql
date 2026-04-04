-- ============================================================
-- Fix: onboarding_create_property (postcode overload) still calls
-- the dropped compliance_set_property_type function.
--
-- The migration 20260404100000 only updated the non-postcode
-- overload. This fixes the postcode version (which the frontend
-- actually calls) and drops the stale non-postcode overload.
-- ============================================================

-- 1. Fix the postcode version — remove compliance_set_property_type call
CREATE OR REPLACE FUNCTION public.onboarding_create_property(
  p_pm_id uuid,
  p_address text,
  p_city text,
  p_postcode text,
  p_room_count int DEFAULT 1,
  p_property_type text DEFAULT 'hmo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property record;
  v_i int;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM c1_property_managers WHERE id = p_pm_id
  ) THEN
    RAISE EXCEPTION 'PM not found';
  END IF;

  -- Insert property
  INSERT INTO c1_properties (
    address, city, property_manager_id, property_type
  ) VALUES (
    p_address, p_city, p_pm_id, p_property_type
  )
  RETURNING * INTO v_property;

  -- Create rooms (Room 1, Room 2, etc.)
  FOR v_i IN 1..GREATEST(p_room_count, 0) LOOP
    INSERT INTO c1_rooms (
      property_id, property_manager_id, room_number, room_name
    ) VALUES (
      v_property.id, p_pm_id, v_i, 'Room ' || v_i
    );
  END LOOP;

  -- compliance_set_property_type call REMOVED — certs are added directly via onboarding

  RETURN row_to_json(v_property);
END;
$$;

-- 2. Drop the stale non-postcode overload (frontend always passes p_postcode)
DROP FUNCTION IF EXISTS public.onboarding_create_property(uuid, text, text, integer, text);
