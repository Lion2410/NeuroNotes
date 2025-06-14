
-- Remove all problematic policies and create completely non-recursive ones
DROP POLICY IF EXISTS "Users can view groups they created" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups they are members of" ON public.groups;

-- Simple policy: users can only see groups they created directly
CREATE POLICY "Users can view groups they created"
ON public.groups
FOR SELECT
TO authenticated
USING (creator_id = auth.uid());

-- For the group_members table, also remove any policies that could cause recursion
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.group_members;
DROP POLICY IF EXISTS "Group creators and admins can view all group memberships" ON public.group_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can insert members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can insert members (non-recursive)" ON public.group_members;
DROP POLICY IF EXISTS "Users can update their own memberships" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can update memberships" ON public.group_members;
DROP POLICY IF EXISTS "Users can delete their own memberships" ON public.group_members;
DROP POLICY IF EXISTS "Group creators can delete memberships" ON public.group_members;

-- Create simple, non-recursive policies for group_members
CREATE POLICY "Users can view their own memberships"
ON public.group_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert themselves as members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own memberships"
ON public.group_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own memberships"
ON public.group_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
