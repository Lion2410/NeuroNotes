
-- Create groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.group_members (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

-- Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invitations (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notes table if it doesn't exist (different from transcriptions)
CREATE TABLE IF NOT EXISTS public.notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id BIGINT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_groups(_user_id UUID)
RETURNS TABLE(group_id BIGINT)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT gm.group_id
  FROM public.group_members gm
  WHERE gm.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id UUID, _group_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = _user_id
      AND gm.group_id = _group_id
      AND gm.is_admin = TRUE
  ) OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = _group_id
      AND g.creator_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_member(_user_id UUID, _group_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = _user_id
      AND gm.group_id = _group_id
  );
$$;

-- RLS Policies for groups table
DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.groups;
CREATE POLICY "Users can view groups they belong to"
ON public.groups
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_groups(auth.uid())));

DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
CREATE POLICY "Users can create groups"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Group creators can update their groups" ON public.groups;
CREATE POLICY "Group creators can update their groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (creator_id = auth.uid());

-- RLS Policies for group_members table
DROP POLICY IF EXISTS "Users can view group memberships for their groups" ON public.group_members;
CREATE POLICY "Users can view group memberships for their groups"
ON public.group_members
FOR SELECT
TO authenticated
USING (group_id IN (SELECT public.get_user_groups(auth.uid())));

DROP POLICY IF EXISTS "Admins can insert group members" ON public.group_members;
CREATE POLICY "Admins can insert group members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_group_admin(auth.uid(), group_id));

DROP POLICY IF EXISTS "Admins can update group members" ON public.group_members;
CREATE POLICY "Admins can update group members"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_group_admin(auth.uid(), group_id));

DROP POLICY IF EXISTS "Admins can delete group members" ON public.group_members;
CREATE POLICY "Admins can delete group members"
ON public.group_members
FOR DELETE
TO authenticated
USING (public.is_group_admin(auth.uid(), group_id));

-- RLS Policies for invitations table
DROP POLICY IF EXISTS "Users can view invitations for their groups" ON public.invitations;
CREATE POLICY "Users can view invitations for their groups"
ON public.invitations
FOR SELECT
TO authenticated
USING (group_id IN (SELECT public.get_user_groups(auth.uid())));

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

-- RLS Policies for notes table
DROP POLICY IF EXISTS "Users can view shared notes in their groups or their own private notes" ON public.notes;
CREATE POLICY "Users can view shared notes in their groups or their own private notes"
ON public.notes
FOR SELECT
TO authenticated
USING (
  (public.is_group_member(auth.uid(), group_id) AND is_private = FALSE) OR
  (user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create notes in their groups" ON public.notes;
CREATE POLICY "Users can create notes in their groups"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (public.is_group_member(auth.uid(), group_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notes or admins can update any notes" ON public.notes;
CREATE POLICY "Users can update their own notes or admins can update any notes"
ON public.notes
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_group_admin(auth.uid(), group_id)
);

DROP POLICY IF EXISTS "Users can delete their own notes or admins can delete any notes" ON public.notes;
CREATE POLICY "Users can delete their own notes or admins can delete any notes"
ON public.notes
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_group_admin(auth.uid(), group_id)
);

-- Function to handle joining a group via invitation
CREATE OR REPLACE FUNCTION public.join_group_via_invitation(_invite_token TEXT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _invitation_record RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO _invitation_record
  FROM public.invitations
  WHERE invite_token = _invite_token
    AND status = 'pending';
    
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Add user to group
  INSERT INTO public.group_members (user_id, group_id, is_admin)
  VALUES (_user_id, _invitation_record.group_id, FALSE)
  ON CONFLICT (user_id, group_id) DO NOTHING;
  
  -- Mark invitation as used
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = _invitation_record.id;
  
  RETURN TRUE;
END;
$$;
