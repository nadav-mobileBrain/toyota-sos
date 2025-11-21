-- Migration: Make tasks.title nullable
alter table public.tasks alter column title drop not null;

