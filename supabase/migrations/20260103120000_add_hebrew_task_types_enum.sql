-- Migration: Add missing Hebrew task types to the enum
-- These values correspond to the TaskType definition in types/task.ts
-- and are used by the frontend and API.

ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'הסעת לקוח הביתה';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'הסעת לקוח למוסך';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'ביצוע טסט';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'חילוץ רכב תקוע';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'אחר';
