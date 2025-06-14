
-- Update RLS policy for transcriptions to allow group members to view shared transcriptions
DROP POLICY IF EXISTS "Users can view their own transcriptions" ON public.transcriptions;

-- Create new policy that allows users to view transcriptions they own OR that have been shared with groups they belong to
CREATE POLICY "Users can view their own transcriptions or group shared transcriptions"
ON public.transcriptions
FOR SELECT
TO authenticated
USING (
  -- Users can see their own transcriptions
  user_id = auth.uid() OR
  -- Users can see transcriptions that have been added to groups they're members of
  EXISTS (
    SELECT 1 
    FROM public.group_notes gn
    JOIN public.group_members gm ON gn.group_id = gm.group_id
    WHERE gn.transcription_id = public.transcriptions.id 
    AND gm.user_id = auth.uid()
  )
);
