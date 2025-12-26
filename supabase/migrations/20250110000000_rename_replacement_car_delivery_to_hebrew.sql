-- Migration to rename 'הסעת רכב חלופי' to 'מסירת רכב חלופי' in task_type enum
-- Part 1: Add new value to enum (Hebrew)
-- Note: This must be committed before it can be used in an UPDATE statement in a subsequent migration.

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'מסירת רכב חלופי';

