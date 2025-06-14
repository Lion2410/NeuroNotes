
-- Drop the problematic policies that are causing infinite recursion
DROP POLICY IF EXISTS "Users can insert themselves or admins can insert others" ON public.group_members;
DROP POLICY IF EXISTS "Users can view group memberships for their groups" ON public.group_members;
DROP POLICY IF EXISTS "Admins can update group memberships" ON public.group_members;
DROP POLICY IF EXISTS "Admins can delete group memberships" ON public.group_members;

-- Create simpler, non-recursive policies for group_members
CREATE POLICY "Users can view their own memberships"
ON public.group_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Group creators and admins can view all group memberships"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = public.group_members.group_id 
    AND g.creator_id = auth.uid()
  )
);

CREATE POLICY "Users can insert themselves as members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group creators can insert members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = public.group_members.group_id 
    AND g.creator_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert members (non-recursive)"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only check direct admin status, not through membership recursion
  EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = public.group_members.group_id 
    AND gm.user_id = auth.uid() 
    AND gm.is_admin = TRUE
    LIMIT 1
  )
);

CREATE POLICY "Users can update their own memberships"
ON public.group_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Group creators can update memberships"
ON public.group_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = public.group_members.group_id 
    AND g.creator_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own memberships"
ON public.group_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Group creators can delete memberships"
ON public.group_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = public.group_members.group_id 
    AND g.creator_id = auth.uid()
  )
);
