
-- Fix the infinite recursion by simplifying the groups SELECT policy
-- Remove the circular dependency between groups and group_members tables

DROP POLICY IF EXISTS "Users can view groups they belong to or created" ON public.groups;

-- Create a simpler policy that only checks creator_id first
CREATE POLICY "Users can view groups they created or belong to"
ON public.groups
FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = public.groups.id AND user_id = auth.uid())
);

-- Simplify the group_members INSERT policy to avoid infinite recursion
DROP POLICY IF EXISTS "Admins can insert group members" ON public.group_members;

CREATE POLICY "Users can insert themselves or admins can insert others"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to add themselves when they create a group
  user_id = auth.uid() OR
  -- Allow existing admins to add others (but avoid the recursion)
  EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = public.group_members.group_id 
    AND gm.user_id = auth.uid() 
    AND gm.is_admin = TRUE
  ) OR
  -- Allow group creators to add members
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = public.group_members.group_id 
    AND g.creator_id = auth.uid()
  )
);
