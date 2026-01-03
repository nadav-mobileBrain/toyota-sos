-- Migration: Migrate existing tasks from English types to Hebrew labels
-- This ensures consistency across the database and application code.

UPDATE public.tasks
SET type = 'הסעת לקוח הביתה'
WHERE type::text = 'drive_client_home';

UPDATE public.tasks
SET type = 'הסעת לקוח למוסך'
WHERE type::text = 'drive_client_to_dealership';

UPDATE public.tasks
SET type = 'ביצוע טסט'
WHERE type::text = 'licence_test';

UPDATE public.tasks
SET type = 'חילוץ רכב תקוע'
WHERE type::text = 'rescue_stuck_car';

UPDATE public.tasks
SET type = 'אחר'
WHERE type::text = 'other';

UPDATE public.tasks
SET type = 'מסירת רכב חלופי'
WHERE type::text = 'replacement_car_delivery';

-- Also migrate the original English label for pickup/dropoff
UPDATE public.tasks
SET type = 'איסוף רכב/שינוע'
WHERE type::text = 'pickup_or_dropoff_car';
