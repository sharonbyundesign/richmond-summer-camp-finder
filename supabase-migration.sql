-- Migration to create the camps, camp_sessions, and camp_interests tables
-- Run this in your Supabase SQL Editor

-- Create camps table
CREATE TABLE IF NOT EXISTS public.camps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  min_age INTEGER,
  max_age INTEGER,
  website_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create camp_sessions table
CREATE TABLE IF NOT EXISTS public.camp_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  name TEXT,
  label TEXT,
  start_date DATE,
  end_date DATE,
  price NUMERIC(10, 2),
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create camp_interests table
CREATE TABLE IF NOT EXISTS public.camp_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  tag TEXT,
  interest_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_interests ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access to camps" ON public.camps
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to camp_sessions" ON public.camp_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to camp_interests" ON public.camp_interests
  FOR SELECT USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_camp_sessions_camp_id ON public.camp_sessions(camp_id);
CREATE INDEX IF NOT EXISTS idx_camp_interests_camp_id ON public.camp_interests(camp_id);
CREATE INDEX IF NOT EXISTS idx_camps_name ON public.camps(name);

