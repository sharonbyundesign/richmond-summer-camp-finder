-- Migration to create the email_signups table (January 2027 full-launch waitlist).
-- Run this in your Supabase SQL Editor.

-- Create email_signups table
CREATE TABLE IF NOT EXISTS public.email_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Case-insensitive uniqueness: one row per address regardless of casing.
-- The API normalizes to lower(trim(email)) before insert, so this index also
-- backs the duplicate check that the route treats as success.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_signups_email_lower
  ON public.email_signups (lower(email));

-- Enable Row Level Security with NO policies. Emails are private: every read and
-- write goes through the server with the service role key (which bypasses RLS).
-- The anon key, used by the browser, can neither read nor insert here.
ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;
