
-- 1. Create transcription_sessions table to log real-time transcriptions.
CREATE TABLE public.transcription_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  mode TEXT NOT NULL, -- e.g. 'microphone', 'virtual'
  device_label TEXT,
  note_id BIGINT REFERENCES notes(id),
  transcript_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. RLS: Only session owner can access their sessions
ALTER TABLE public.transcription_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their transcription sessions"
  ON public.transcription_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their transcription sessions"
  ON public.transcription_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their transcription sessions"
  ON public.transcription_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Index for fast lookups
CREATE INDEX idx_transcription_sessions_user_id ON public.transcription_sessions(user_id);

