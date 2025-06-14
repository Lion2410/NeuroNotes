
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators can update their groups" ON public.groups;

-- Create proper RLS policies for the groups table
CREATE POLICY "Users can view groups they belong to"
ON public.groups
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_groups(auth.uid())));

CREATE POLICY "Users can create groups"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Group creators can update their groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (creator_id = auth.uid());

-- Also ensure the group_members policies allow the creator to add themselves
DROP POLICY IF EXISTS "Admins can insert group members" ON public.group_members;
CREATE POLICY "Admins can insert group members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_group_admin(auth.uid(), group_id) OR 
  (user_id = auth.uid())
);
