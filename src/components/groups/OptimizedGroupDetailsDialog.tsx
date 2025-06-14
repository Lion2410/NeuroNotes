import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, FileText, UserPlus, Plus, ExternalLink, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
  group_id: number;
  transcription_id: string;
  added_by: string;
  added_at: string;
  title: string;
  content: string | null;
  source_type: string;
  duration: number | null;
  transcription_created_at: string;
  transcription_owner: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_email: string | null;
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
  const navigate = useNavigate();

  // Fetch group members using optimized view
  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ['group-members', group?.id],
    queryFn: async (): Promise<GroupMember[]> => {
      if (!group) return [];

      console.log('Fetching group members using optimized view for group:', group.id);
      
      const { data, error } = await supabase
        .from('group_members_with_profiles')
        .select('*')
        .eq('group_id', group.id)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error fetching group members:', error);
        throw error;
      }

      console.log('Group members fetched:', data?.length || 0);

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

  // Fetch group notes using the new optimized view with transcription details
  const { data: notes = [], isLoading: loadingNotes, refetch: refetchNotes } = useQuery({
    queryKey: ['group-notes', group?.id],
    queryFn: async (): Promise<GroupNote[]> => {
      if (!group) return [];

      console.log('Fetching group notes for group:', group.id);
      
      const { data, error } = await supabase
        .from('group_notes_with_details')
        .select('*')
        .eq('group_id', group.id)
        .order('added_at', { ascending: false });

      if (error) {
        console.error('Error fetching group notes:', error);
        throw error;
      }

      console.log('Group notes fetched:', data?.length || 0);
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

  const getAuthorName = (note: GroupNote) => {
    if (note.first_name || note.last_name) {
      return `${note.first_name || ''} ${note.last_name || ''}`.trim();
    }
    if (note.email) {
      return note.email;
    }
    return `User ${note.added_by.slice(0, 8)}...`;
  };

  const getOwnerName = (note: GroupNote) => {
    if (note.owner_first_name || note.owner_last_name) {
      return `${note.owner_first_name || ''} ${note.owner_last_name || ''}`.trim();
    }
    if (note.owner_email) {
      return note.owner_email;
    }
    return `User ${note.transcription_owner.slice(0, 8)}...`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const handleAddNotes = () => {
    setShowAddNotesDialog(true);
  };

  const handleNotesAdded = () => {
    refetchNotes();
  };

  const handleNoteClick = (transcriptionId: string) => {
    // Close the dialog first
    onClose();
    // Navigate to the transcript editor for the original transcription
    navigate(`/transcript/${transcriptionId}`);
  };

  if (!group) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-800">
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
                    <Card 
                      key={note.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleNoteClick(note.transcription_id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-base">{note.title}</CardTitle>
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                Original by {getOwnerName(note)} • {new Date(note.transcription_created_at).toLocaleDateString()}
                              </p>
                              <p>
                                Added by {getAuthorName(note)} • {new Date(note.added_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <div className="flex gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {note.source_type}
                              </Badge>
                              {note.added_by === user?.id && (
                                <Badge variant="outline" className="text-xs">
                                  Added by you
                                </Badge>
                              )}
                              {note.transcription_owner === user?.id && (
                                <Badge variant="default" className="text-xs">
                                  Your Note
                                </Badge>
                              )}
                            </div>
                            {note.duration && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDuration(note.duration)}
                              </div>
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
