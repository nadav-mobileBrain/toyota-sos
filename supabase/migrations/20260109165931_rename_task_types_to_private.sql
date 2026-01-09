-- Migration to rename task types to include 'פרטי' (private) suffix:
-- 'איסוף רכב/שינוע' → 'איסוף רכב/שינוע פרטי'
-- 'החזרת רכב/שינוע' → 'החזרת רכב/שינוע פרטי'
--
-- DEPLOYMENT ORDER:
-- 1. Run this migration FIRST
-- 2. Deploy application code AFTER migration completes
--
-- ROLLBACK PROCEDURE:
-- PostgreSQL does not support removing enum values without recreating the type.
-- To rollback this change:
-- 1. Revert the application code to use old task type names
-- 2. Run manual data migration:
--    UPDATE public.tasks SET type = 'איסוף רכב/שינוע' WHERE type = 'איסוף רכב/שינוע פרטי';
--    UPDATE public.tasks SET type = 'החזרת רכב/שינוע' WHERE type = 'החזרת רכב/שינוע פרטי';
-- 3. Re-deploy the sync_vehicle_availability trigger with old task type names
-- Note: The new enum values will remain in the type but will be unused.

-- Step 1: Add the new enum values
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'איסוף רכב/שינוע פרטי';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'החזרת רכב/שינוע פרטי';

-- Step 2: Migrate existing tasks to use the new values
UPDATE public.tasks
SET type = 'איסוף רכב/שינוע פרטי'
WHERE type = 'איסוף רכב/שינוע';

UPDATE public.tasks
SET type = 'החזרת רכב/שינוע פרטי'
WHERE type = 'החזרת רכב/שינוע';

-- Note: Old enum values cannot be removed from PostgreSQL enums without recreating the type,
-- but they will no longer be used in the application code.

-- Step 3: Update the sync_vehicle_availability trigger function to use new task type names
CREATE OR REPLACE FUNCTION public.sync_vehicle_availability()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- 1. Handle NEW task assignment (Insert or Update)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- If it's a Pickup task and has a vehicle, mark vehicle as unavailable
        IF (NEW.type = 'איסוף רכב/שינוע פרטי' AND NEW.vehicle_id IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.status != 'הושלמה') THEN
            UPDATE public.vehicles
            SET is_available = false,
                unavailability_reason = 'אצל לקוח',
                updated_at = now()
            WHERE id = NEW.vehicle_id;
        END IF;

        -- If it's a Return task and it's COMPLETED, mark vehicle as available
        IF (NEW.type = 'החזרת רכב/שינוע פרטי' AND NEW.vehicle_id IS NOT NULL AND NEW.status = 'הושלמה' AND NEW.deleted_at IS NULL) THEN
            UPDATE public.vehicles
            SET is_available = true,
                unavailability_reason = NULL,
                updated_at = now()
            WHERE id = NEW.vehicle_id;
        END IF;
    END IF;

    -- 2. Handle status changes or deletions that might release a vehicle
    IF (TG_OP = 'UPDATE') THEN
        -- If a task was 'איסוף רכב/שינוע פרטי' but is now deleted or type changed or cancelled
        IF (OLD.type = 'איסוף רכב/שינוע פרטי' AND OLD.vehicle_id IS NOT NULL AND 
            (NEW.deleted_at IS NOT NULL OR NEW.type != 'איסוף רכב/שינוע פרטי' OR NEW.status = 'הושלמה')) THEN
            
            -- Only release if no other active 'איסוף רכב/שינוע פרטי' tasks exist for this vehicle
            IF NOT EXISTS (
                SELECT 1 FROM public.tasks 
                WHERE vehicle_id = OLD.vehicle_id 
                AND type = 'איסוף רכב/שינוע פרטי' 
                AND status != 'הושלמה' 
                AND deleted_at IS NULL 
                AND id != NEW.id
            ) THEN
                UPDATE public.vehicles
                SET is_available = true,
                    unavailability_reason = NULL,
                    updated_at = now()
                WHERE id = OLD.vehicle_id
                AND unavailability_reason = 'אצל לקוח'; -- Only if we were the ones who set it
            END IF;
        END IF;
        
        -- Handle vehicle reassignment
        IF (OLD.vehicle_id IS NOT NULL AND OLD.vehicle_id != COALESCE(NEW.vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid) AND OLD.type = 'איסוף רכב/שינוע פרטי') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.tasks 
                WHERE vehicle_id = OLD.vehicle_id 
                AND type = 'איסוף רכב/שינוע פרטי' 
                AND status != 'הושלמה' 
                AND deleted_at IS NULL 
                AND id != NEW.id
            ) THEN
                UPDATE public.vehicles
                SET is_available = true,
                    unavailability_reason = NULL,
                    updated_at = now()
                WHERE id = OLD.vehicle_id
                AND unavailability_reason = 'אצל לקוח';
            END IF;
        END IF;
    END IF;

    -- 3. Handle Deletions (if hard delete was used, though app uses soft delete)
    IF (TG_OP = 'DELETE') THEN
        IF (OLD.type = 'איסוף רכב/שינוע פרטי' AND OLD.vehicle_id IS NOT NULL) THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.tasks 
                WHERE vehicle_id = OLD.vehicle_id 
                AND type = 'איסוף רכב/שינוע פרטי' 
                AND status != 'הושלמה' 
                AND deleted_at IS NULL
            ) THEN
                UPDATE public.vehicles
                SET is_available = true,
                    unavailability_reason = NULL,
                    updated_at = now()
                WHERE id = OLD.vehicle_id
                AND unavailability_reason = 'אצל לקוח';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
