
-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.groups;

-- Create better RLS policies for groups table
CREATE POLICY "Users can view groups they belong to or created"
ON public.groups
FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid() OR 
  id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated users can create groups"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Group creators can update their groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (creator_id = auth.uid());

-- Also fix the group_members policy to allow creators to add themselves
DROP POLICY IF EXISTS "Admins can insert group members" ON public.group_members;
CREATE POLICY "Admins can insert group members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_group_admin(auth.uid(), group_id) OR 
  (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND creator_id = auth.uid()))
);
