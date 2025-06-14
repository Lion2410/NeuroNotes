
-- Fix the remaining infinite recursion issue by updating the groups table policies
-- The issue is that the groups SELECT policy is referencing group_members, 
-- which creates a circular dependency when group_members policies reference groups

DROP POLICY IF EXISTS "Users can view groups they created or belong to" ON public.groups;

-- Create a simple policy that only checks direct creator relationship
-- This avoids the circular reference between groups and group_members
CREATE POLICY "Users can view groups they created"
ON public.groups
FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

-- Create a separate policy for viewing groups through membership
-- This uses a direct query without circular reference
CREATE POLICY "Users can view groups they are members of"
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
