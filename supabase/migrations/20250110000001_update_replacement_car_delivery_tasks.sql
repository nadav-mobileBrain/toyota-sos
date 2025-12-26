-- Migration to rename 'הסעת רכב חלופי' to 'מסירת רכב חלופי' in task_type enum
-- Part 2: Update existing tasks from old name to new name
-- This runs in a separate migration to ensure the new enum value is committed and available.

UPDATE public.tasks
SET type = 'מסירת רכב חלופי'
WHERE type::text = 'הסעת רכב חלופי';

