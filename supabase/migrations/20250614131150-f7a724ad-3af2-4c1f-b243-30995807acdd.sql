
-- Update RLS policies for notes table to allow viewing shared notes or user's private notes in groups they belong to
DROP POLICY IF EXISTS "Users can view shared notes in their groups or their own private notes" ON public.notes;
CREATE POLICY "Users can view shared notes in their groups or their own private notes"
ON public.notes
FOR SELECT
TO authenticated
USING (
  (public.is_group_member(auth.uid(), group_id) AND is_private = FALSE) OR
  (user_id = auth.uid())
);

-- Add missing RLS policies for invitations table
DROP POLICY IF EXISTS "Users can view invitations for their groups" ON public.invitations;
CREATE POLICY "Users can view invitations for their groups"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  group_id IN (
    SELECT g.id FROM public.groups g 
    WHERE g.creator_id = auth.uid() OR public.is_group_member(auth.uid(), g.id)
  )
);

DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
CREATE POLICY "Admins can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (public.is_group_admin(auth.uid(), group_id));

DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
CREATE POLICY "Admins can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (public.is_group_admin(auth.uid(), group_id));

-- Add missing RLS policies for notes table
DROP POLICY IF EXISTS "Users can create notes in their groups" ON public.notes;
CREATE POLICY "Users can create notes in their groups"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (public.is_group_member(auth.uid(), group_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes"
ON public.notes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes"
ON public.notes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
