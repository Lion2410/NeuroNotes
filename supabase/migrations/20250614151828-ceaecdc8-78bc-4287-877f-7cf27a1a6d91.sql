
-- Update RLS policies to allow group members to view shared notes in their groups
DROP POLICY IF EXISTS "Users can view shared notes in their groups or their own private notes" ON public.notes;
CREATE POLICY "Users can view shared notes in their groups or their own private notes"
ON public.notes
FOR SELECT
TO authenticated
USING (
  -- Users can see their own notes regardless of privacy setting
  (user_id = auth.uid()) OR
  -- Users can see non-private notes in groups they belong to
  (is_private = FALSE AND public.is_group_member(auth.uid(), group_id))
);

-- Allow admins to delete notes in their groups
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes"
ON public.notes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can delete notes in their groups"
ON public.notes
FOR DELETE
TO authenticated
USING (
  public.is_group_admin(auth.uid(), group_id)
);

-- Allow admins to delete group members (but not themselves)
DROP POLICY IF EXISTS "Users can delete their own memberships" ON public.group_members;
CREATE POLICY "Users can delete their own memberships"
ON public.group_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can delete group memberships"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  public.is_group_admin(auth.uid(), group_id) AND user_id != auth.uid()
);

-- Allow group members to view other members in the same group
DROP POLICY IF EXISTS "Users can view members of groups they belong to" ON public.group_members;
CREATE POLICY "Users can view members of groups they belong to"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  group_id IN (
    SELECT gm.group_id 
    FROM public.group_members gm 
    WHERE gm.user_id = auth.uid()
  )
);
