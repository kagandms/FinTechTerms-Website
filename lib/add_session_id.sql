-- Add session_id to quiz_attempts to link with study_sessions
-- This enables "Fatigue Analysis" (ordering by time within session)
-- and "Class Distribution" (grouping by user via session)

ALTER TABLE public.quiz_attempts 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_id ON public.quiz_attempts(session_id);
