
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, FileText, UserPlus, Settings, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AddNotesToGroupDialog from './AddNotesToGroupDialog';

interface GroupMember {
  id: number;
  user_id: string;
  group_id: number;
  is_admin: boolean;
  joined_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface GroupNote {
  id: number;
  title: string;
  content: string | null;
  is_private: boolean;
  created_at: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface OptimizedGroupDetailsDialogProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
}

const OptimizedGroupDetailsDialog: React.FC<OptimizedGroupDetailsDialogProps> = ({
  group,
  isOpen,
  onClose
}) => {
  const [showAddNotesDialog, setShowAddNotesDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch group members using optimized view
  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ['group-members', group?.id],
    queryFn: async (): Promise<GroupMember[]> => {
      if (!group) return [];

      console.log('Fetching group members using optimized view...');
      
      const { data, error } = await supabase
        .from('group_members_with_profiles')
        .select('*')
        .eq('group_id', group.id)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error fetching group members:', error);
        throw error;
      }

      // Also include the creator if they're not in the members list
      const creatorIsMember = data?.some(member => member.user_id === group.creator_id);
      
      if (!creatorIsMember) {
        // Fetch creator profile
        const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, avatar_url')
          .eq('id', group.creator_id)
          .maybeSingle();

        const creatorMember: GroupMember = {
          id: 0, // Special ID for creator
          user_id: group.creator_id,
          group_id: group.id,
          is_admin: true,
          joined_at: group.created_at,
          first_name: creatorProfile?.first_name || null,
          last_name: creatorProfile?.last_name || null,
          email: creatorProfile?.email || null,
          avatar_url: creatorProfile?.avatar_url || null
        };

        return [creatorMember, ...(data || [])];
      }

      return data || [];
    },
    enabled: !!group && isOpen,
    staleTime: 30000
  });

  // Fetch group notes using optimized view
  const { data: notes = [], isLoading: loadingNotes, refetch: refetchNotes } = useQuery({
    queryKey: ['group-notes', group?.id],
    queryFn: async (): Promise<GroupNote[]> => {
      if (!group) return [];

      console.log('Fetching group notes using optimized view...');
      
      const { data, error } = await supabase
        .from('notes_with_profiles')
        .select('*')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching group notes:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!group && isOpen,
    staleTime: 30000
  });

  const getDisplayName = (member: GroupMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    if (member.email) {
      return member.email;
    }
    return `User ${member.user_id.slice(0, 8)}...`;
  };

  const getAvatarFallback = (member: GroupMember) => {
    if (member.first_name || member.last_name) {
      const firstName = member.first_name || '';
      const lastName = member.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (member.email) {
      return member.email.charAt(0).toUpperCase();
    }
    return member.user_id.charAt(0).toUpperCase();
  };

  const handleAddNotes = () => {
    setShowAddNotesDialog(true);
  };

  const handleNotesAdded = () => {
    refetchNotes();
  };

  if (!group) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {group.name}
              {group.is_admin && (
                <Badge variant="secondary" className="ml-2">
                  Admin
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Members ({members.length})
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="h-4 w-4 mr-2" />
                Notes ({notes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Group Members</h3>
                {group.is_admin && (
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Members
                  </Button>
                )}
              </div>

              {loadingMembers ? (
                <div className="text-center py-8">Loading members...</div>
              ) : (
                <div className="grid gap-3">
                  {members.map((member) => (
                    <Card key={`${member.user_id}-${member.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback>
                                {getAvatarFallback(member)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{getDisplayName(member)}</p>
                              {member.email && (
                                <p className="text-sm text-muted-foreground">
                                  {member.email}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Joined {new Date(member.joined_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.is_admin && (
                              <Badge variant="outline">Admin</Badge>
                            )}
                            {member.user_id === group.creator_id && (
                              <Badge>Creator</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Group Notes</h3>
                <Button size="sm" onClick={handleAddNotes}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Notes
                </Button>
              </div>

              {loadingNotes ? (
                <div className="text-center py-8">Loading notes...</div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No notes yet. Add notes from your collection to share with the group!
                </div>
              ) : (
                <div className="grid gap-3">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{note.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              By {note.first_name || note.last_name
                                ? `${note.first_name || ''} ${note.last_name || ''}`.trim()
                                : note.email || 'Unknown User'} • {new Date(note.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {note.is_private && (
                              <Badge variant="outline" className="text-xs">
                                Private
                              </Badge>
                            )}
                            {note.user_id === user?.id && (
                              <Badge variant="secondary" className="text-xs">
                                Your Note
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {note.content && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {note.content}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Notes Dialog */}
      {group && (
        <AddNotesToGroupDialog
          isOpen={showAddNotesDialog}
          onClose={() => setShowAddNotesDialog(false)}
          groupId={group.id}
          groupName={group.name}
          onNotesAdded={handleNotesAdded}
        />
      )}
    </>
  );
};

export default OptimizedGroupDetailsDialog;
