
-- Phase 1: Database Optimizations
-- Add indexes for better query performance

-- Index for group_members queries (user lookup and group lookup)
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_group ON public.group_members(user_id, group_id);

-- Index for notes queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_group_id ON public.notes(group_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_group ON public.notes(user_id, group_id);

-- Index for groups queries
CREATE INDEX IF NOT EXISTS idx_groups_creator_id ON public.groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON public.groups(created_at DESC);

-- Index for transcriptions queries
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON public.transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON public.transcriptions(created_at DESC);

-- Create optimized views for common queries
CREATE OR REPLACE VIEW public.user_groups_with_stats AS
SELECT 
  g.id,
  g.name,
  g.creator_id,
  g.created_at,
  COALESCE(member_counts.member_count, 0) + 1 as member_count, -- +1 for creator
  CASE WHEN g.creator_id = auth.uid() THEN true 
       ELSE COALESCE(gm.is_admin, false) END as is_admin
FROM public.groups g
LEFT JOIN public.group_members gm ON g.id = gm.group_id AND gm.user_id = auth.uid()
LEFT JOIN (
  SELECT group_id, COUNT(*) as member_count
  FROM public.group_members
  GROUP BY group_id
) member_counts ON g.id = member_counts.group_id
WHERE g.creator_id = auth.uid() 
   OR EXISTS (
     SELECT 1 FROM public.group_members gm2 
     WHERE gm2.group_id = g.id AND gm2.user_id = auth.uid()
   );

-- Create view for group members with profiles
CREATE OR REPLACE VIEW public.group_members_with_profiles AS
SELECT 
  gm.id,
  gm.user_id,
  gm.group_id,
  gm.is_admin,
  gm.joined_at,
  p.first_name,
  p.last_name,
  p.email,
  p.avatar_url
FROM public.group_members gm
LEFT JOIN public.profiles p ON gm.user_id = p.id;

-- Create view for notes with author profiles
CREATE OR REPLACE VIEW public.notes_with_profiles AS
SELECT 
  n.id,
  n.title,
  n.content,
  n.is_private,
  n.created_at,
  n.updated_at,
  n.user_id,
  n.group_id,
  p.first_name,
  p.last_name,
  p.email
FROM public.notes n
LEFT JOIN public.profiles p ON n.user_id = p.id;

-- Optimize the existing functions for better performance
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = _user_id
      AND gm.group_id = _group_id
  ) OR EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = _group_id
      AND g.creator_id = _user_id
  );
$function$;

-- Add function to get user's groups efficiently
CREATE OR REPLACE FUNCTION public.get_user_groups_optimized(_user_id uuid)
RETURNS TABLE(
  group_id bigint,
  group_name text,
  creator_id uuid,
  created_at timestamp with time zone,
  member_count bigint,
  is_admin boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT 
    g.id as group_id,
    g.name as group_name,
    g.creator_id,
    g.created_at,
    COALESCE(member_counts.member_count, 0) + 1 as member_count,
    CASE WHEN g.creator_id = _user_id THEN true 
         ELSE COALESCE(gm.is_admin, false) END as is_admin
  FROM public.groups g
  LEFT JOIN public.group_members gm ON g.id = gm.group_id AND gm.user_id = _user_id
  LEFT JOIN (
    SELECT group_id, COUNT(*) as member_count
    FROM public.group_members
    GROUP BY group_id
  ) member_counts ON g.id = member_counts.group_id
  WHERE g.creator_id = _user_id 
     OR EXISTS (
       SELECT 1 FROM public.group_members gm2 
       WHERE gm2.group_id = g.id AND gm2.user_id = _user_id
     )
  ORDER BY g.created_at DESC;
$function$;
