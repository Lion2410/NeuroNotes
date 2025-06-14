
-- Add a policy that allows users to see groups where they are members
-- This uses a direct EXISTS query without creating circular dependency
CREATE POLICY "Users can view groups where they are members"
ON public.groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = public.groups.id 
    AND gm.user_id = auth.uid()
  )
);

-- Also need to allow users to see group_members records for groups they belong to
-- so they can see who else is in their groups
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
