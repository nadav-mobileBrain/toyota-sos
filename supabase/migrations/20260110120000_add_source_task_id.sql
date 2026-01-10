-- Add source_task_id column to tasks table to link return tasks to their pickup tasks
-- This allows tracking auto-created return tasks

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS source_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS tasks_source_task_id_idx ON public.tasks(source_task_id);
