-- ============================================================
-- End Tenancy Support
-- Adds tenancy lifecycle (active/inactive) to rooms,
-- cancelled status to rent ledger, and room_end_tenancy RPC.
-- ============================================================

-- A. Add tenancy_status to c1_rooms
ALTER TABLE public.c1_rooms
  ADD COLUMN tenancy_status text DEFAULT 'active'
  CHECK (tenancy_status IN ('active', 'inactive'));

-- Data fix: existing vacant rooms should be inactive
UPDATE c1_rooms SET tenancy_status = 'inactive' WHERE current_tenant_id IS NULL;

-- B. Expand c1_rent_ledger status CHECK to include 'cancelled'
ALTER TABLE public.c1_rent_ledger DROP CONSTRAINT c1_rent_ledger_status_check;
ALTER TABLE public.c1_rent_ledger ADD CONSTRAINT c1_rent_ledger_status_check
  CHECK (status IN ('pending', 'paid', 'overdue', 'partial', 'cancelled'));

-- C. New RPC: room_end_tenancy
-- Ends the tenancy lifecycle: sets end date, marks inactive,
-- cancels future rent reminders, logs audit event.
CREATE OR REPLACE FUNCTION public.room_end_tenancy(
  p_room_id uuid,
  p_pm_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_tenant_name text;
  v_room_number text;
  v_property_address text;
  v_tenancy_start date;
BEGIN
  -- Get current tenant with ownership check
  SELECT r.current_tenant_id, r.room_number, r.tenancy_start_date,
         t.full_name, p.address
  INTO v_tenant_id, v_room_number, v_tenancy_start,
       v_tenant_name, v_property_address
  FROM c1_rooms r
  LEFT JOIN c1_tenants t ON t.id = r.current_tenant_id
  LEFT JOIN c1_properties p ON p.id = r.property_id
  WHERE r.id = p_room_id AND r.property_manager_id = p_pm_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found or access denied';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Room is already vacant';
  END IF;

  -- 1. End tenancy on room: clear tenant, set end date, mark inactive
  --    Preserve tenancy_start_date for audit trail
  UPDATE c1_rooms
  SET current_tenant_id = NULL,
      tenancy_end_date = CURRENT_DATE,
      tenancy_status = 'inactive'
  WHERE id = p_room_id;

  -- 2. Clear tenant's room assignment
  UPDATE c1_tenants
  SET room_id = NULL
  WHERE id = v_tenant_id;

  -- 3. Cancel future pending rent ledger entries for this room+tenant
  UPDATE c1_rent_ledger
  SET status = 'cancelled'
  WHERE room_id = p_room_id
    AND tenant_id = v_tenant_id
    AND due_date > CURRENT_DATE
    AND status = 'pending';

  -- 4. Log audit event
  PERFORM c1_log_system_event(
    p_pm_id,
    'TENANCY_ENDED',
    v_property_address,
    jsonb_build_object(
      'room_id', p_room_id,
      'room_number', v_room_number,
      'tenant_id', v_tenant_id,
      'tenant_name', v_tenant_name,
      'tenancy_start', v_tenancy_start,
      'tenancy_end', CURRENT_DATE
    )
  );
END;
$$;

-- D. Update get_rent_reminders_due to exclude cancelled entries
CREATE OR REPLACE FUNCTION public.get_rent_reminders_due()
RETURNS TABLE (
  ledger_id uuid,
  room_id uuid,
  tenant_id uuid,
  property_manager_id uuid,
  due_date date,
  amount_due numeric,
  amount_paid numeric,
  status text,
  reminder_level integer,
  tenant_name text,
  tenant_phone text,
  property_address text,
  room_number text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Reminder 1: 3 days before due date
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    1 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date = CURRENT_DATE + 3
    AND rl.reminder_1_sent_at IS NULL
    AND rl.status NOT IN ('paid', 'cancelled')

  UNION ALL

  -- Reminder 2: on due date (unpaid)
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    2 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date = CURRENT_DATE
    AND rl.reminder_2_sent_at IS NULL
    AND rl.status NOT IN ('paid', 'cancelled')

  UNION ALL

  -- Reminder 3: 3 days overdue (unpaid)
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    3 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date = CURRENT_DATE - 3
    AND rl.reminder_3_sent_at IS NULL
    AND rl.status NOT IN ('paid', 'cancelled')

  ORDER BY due_date ASC, reminder_level ASC;
$$;

-- E. Update room_assign_tenant to reset tenancy_status on new assignment
--    and mark old room as inactive when transferring
CREATE OR REPLACE FUNCTION public.room_assign_tenant(
  p_room_id uuid,
  p_tenant_id uuid,
  p_pm_id uuid,
  p_tenancy_start date,
  p_tenancy_end date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_room record;
  v_tenant record;
BEGIN
  -- Lock the room row to prevent concurrent assignment
  SELECT id, property_id, current_tenant_id, property_manager_id
  INTO v_room
  FROM c1_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.property_manager_id != p_pm_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_room.current_tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'Room already occupied';
  END IF;

  -- Validate tenant
  SELECT id, property_id, room_id
  INTO v_tenant
  FROM c1_tenants
  WHERE id = p_tenant_id AND property_manager_id = p_pm_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found or access denied';
  END IF;

  IF v_tenant.property_id != v_room.property_id THEN
    RAISE EXCEPTION 'Tenant must belong to the same property as the room';
  END IF;

  -- If tenant is already in another room, clear the old assignment
  IF v_tenant.room_id IS NOT NULL THEN
    UPDATE c1_rooms
    SET current_tenant_id = NULL,
        tenancy_start_date = NULL,
        tenancy_end_date = NULL,
        tenancy_status = 'inactive'
    WHERE id = v_tenant.room_id;
  END IF;

  -- Assign: update both sides
  UPDATE c1_rooms
  SET current_tenant_id = p_tenant_id,
      tenancy_start_date = p_tenancy_start,
      tenancy_end_date = p_tenancy_end,
      tenancy_status = 'active'
  WHERE id = p_room_id;

  UPDATE c1_tenants
  SET room_id = p_room_id
  WHERE id = p_tenant_id;
END;
$$;
