
-- First, create the group_notes junction table that references transcriptions
CREATE TABLE public.group_notes (
  id BIGINT NOT NULL GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  transcription_id UUID NOT NULL REFERENCES public.transcriptions(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, transcription_id)
);

-- Enable RLS on the new table
ALTER TABLE public.group_notes ENABLE ROW LEVEL SECURITY;

-- Create policy for group members to view group notes
CREATE POLICY "Group members can view group notes" 
  ON public.group_notes 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm 
      WHERE gm.group_id = group_notes.group_id 
      AND gm.user_id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_notes.group_id 
      AND g.creator_id = auth.uid()
    )
  );

-- Create policy for group members to add notes to groups
CREATE POLICY "Group members can add notes to groups" 
  ON public.group_notes 
  FOR INSERT 
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.group_members gm 
        WHERE gm.group_id = group_notes.group_id 
        AND gm.user_id = auth.uid()
      ) OR 
      EXISTS (
        SELECT 1 FROM public.groups g 
        WHERE g.id = group_notes.group_id 
        AND g.creator_id = auth.uid()
      )
    ) AND added_by = auth.uid()
  );

-- Create policy for note owner to remove their notes from groups
CREATE POLICY "Note owners can remove their notes from groups" 
  ON public.group_notes 
  FOR DELETE 
  USING (added_by = auth.uid());

-- Create an optimized view for group notes with transcription and profile data
CREATE OR REPLACE VIEW public.group_notes_with_details AS
SELECT 
  gn.id,
  gn.group_id,
  gn.transcription_id,
  gn.added_by,
  gn.added_at,
  t.title,
  t.content,
  t.source_type,
  t.duration,
  t.created_at as transcription_created_at,
  t.user_id as transcription_owner,
  p.first_name,
  p.last_name,
  p.email,
  owner_p.first_name as owner_first_name,
  owner_p.last_name as owner_last_name,
  owner_p.email as owner_email
FROM public.group_notes gn
JOIN public.transcriptions t ON gn.transcription_id = t.id
LEFT JOIN public.profiles p ON gn.added_by = p.id
LEFT JOIN public.profiles owner_p ON t.user_id = owner_p.id;

-- Create indexes for better performance
CREATE INDEX idx_group_notes_group_id ON public.group_notes(group_id);
CREATE INDEX idx_group_notes_transcription_id ON public.group_notes(transcription_id);
CREATE INDEX idx_group_notes_added_by ON public.group_notes(added_by);

-- Clean up existing duplicated data in the notes table
-- (We'll keep the notes table structure but it won't be used for group notes anymore)
DELETE FROM public.notes WHERE group_id IS NOT NULL;
