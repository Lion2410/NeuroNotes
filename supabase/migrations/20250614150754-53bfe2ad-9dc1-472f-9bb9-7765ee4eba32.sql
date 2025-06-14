
-- First, let's check and fix the RLS policies for the notes table
-- The issue is likely that we need to ensure users are properly added as group members
-- when they create or join groups

-- Make sure group creators are automatically added as group members
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add the group creator as an admin member
  INSERT INTO public.group_members (user_id, group_id, is_admin)
  VALUES (NEW.creator_id, NEW.id, TRUE)
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically add creator as member when group is created
DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_member();

-- Update the notes RLS policy to be more explicit about the membership check
DROP POLICY IF EXISTS "Users can create notes in their groups" ON public.notes;
CREATE POLICY "Users can create notes in their groups"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  (
    public.is_group_member(auth.uid(), group_id) OR 
    EXISTS (
      SELECT 1 FROM public.groups g 
      WHERE g.id = group_id AND g.creator_id = auth.uid()
    )
  )
);
