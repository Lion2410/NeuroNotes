import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, FileText, UserPlus, Settings, Copy, Check, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AddNotesToGroupDialog from './AddNotesToGroupDialog';

interface GroupMember {
  id: number;
  user_id: string;
  is_admin: boolean;
  joined_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
}

interface GroupNote {
  id: number;
  title: string;
  content: string | null;
  is_private: boolean;
  created_at: string;
  user_id: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface GroupDetailsDialogProps {
  group: Group | null;
  isOpen: boolean;
  onClose: () => void;
}

const GroupDetailsDialog: React.FC<GroupDetailsDialogProps> = ({
  group,
  isOpen,
  onClose
}) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showAddNotesDialog, setShowAddNotesDialog] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (group && isOpen) {
      fetchMembers();
      fetchNotes();
    }
  }, [group, isOpen]);

  const getDisplayName = (profile: GroupMember['profile']) => {
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return profile?.email || 'Unknown User';
  };

  const getAvatarFallback = (profile: GroupMember['profile']) => {
    if (profile?.first_name || profile?.last_name) {
      const firstName = profile.first_name || '';
      const lastName = profile.last_name || '';
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return 'U';
  };

  const fetchMembers = async () => {
    if (!group) return;
    
    setLoadingMembers(true);
    try {
      // Get the group members from group_members table
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('id, user_id, is_admin, joined_at')
        .eq('group_id', group.id)
        .order('joined_at', { ascending: true });

      if (memberError) throw memberError;

      const membersWithProfiles: GroupMember[] = [];
      
      // First, add the creator (they're always a member even if not in group_members table)
      try {
        const { data: creatorProfile, error: creatorError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, avatar_url')
          .eq('id', group.creator_id)
          .single();

        if (creatorError) {
          console.log('Creator profile not found, using fallback');
        }

        membersWithProfiles.push({
          id: 0, // Use 0 as a special ID for creator
          user_id: group.creator_id,
          is_admin: true,
          joined_at: group.created_at,
          profile: creatorProfile || null
        });
      } catch (error) {
        console.error('Error fetching creator profile:', error);
        // Still add creator even without profile data
        membersWithProfiles.push({
          id: 0,
          user_id: group.creator_id,
          is_admin: true,
          joined_at: group.created_at,
          profile: null
        });
      }

      // Then add other members if they exist
      if (memberData && memberData.length > 0) {
        for (const member of memberData) {
          // Skip if this is the creator (already added)
          if (member.user_id === group.creator_id) continue;

          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('first_name, last_name, email, avatar_url')
              .eq('id', member.user_id)
              .single();

            if (profileError) {
              console.log(`Profile not found for user ${member.user_id}, using fallback`);
            }

            membersWithProfiles.push({
              ...member,
              profile: profileData || null
            });
          } catch (error) {
            console.error(`Error fetching profile for user ${member.user_id}:`, error);
            // Still add member even without profile data
            membersWithProfiles.push({
              ...member,
              profile: null
            });
          }
        }
      }

      console.log('Fetched members with profiles:', membersWithProfiles);
      setMembers(membersWithProfiles);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      toast({
        title: "Error",
        description: "Failed to load group members.",
        variant: "destructive"
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchNotes = async () => {
    if (!group) return;
    
    setLoadingNotes(true);
    try {
      // First get the notes
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('id, title, content, is_private, created_at, user_id')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false });

      if (noteError) throw noteError;

      // Then get profiles for each note author
      const notesWithProfiles: GroupNote[] = [];
      
      if (noteData) {
        for (const note of noteData) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', note.user_id)
            .single();

          notesWithProfiles.push({
            ...note,
            profile: profileData
          });
        }
      }

      setNotes(notesWithProfiles);
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load group notes.",
        variant: "destructive"
      });
    } finally {
      setLoadingNotes(false);
    }
  };

  const generateInviteLink = async () => {
    if (!group || !user) return;

    setGeneratingInvite(true);
    try {
      // Generate a unique invite token
      const inviteToken = `${group.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store the invitation in the database
      const { error } = await supabase
        .from('invitations')
        .insert({
          group_id: group.id,
          invite_token: inviteToken,
          invited_by: user.id
        });

      if (error) throw error;

      // Create the invite link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/join-group?invite=${inviteToken}`;
      setInviteLink(link);
      setShowInviteDialog(true);
    } catch (error: any) {
      console.error('Error generating invite link:', error);
      toast({
        title: "Error",
        description: "Failed to generate invite link.",
        variant: "destructive"
      });
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard."
      });
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy invite link.",
        variant: "destructive"
      });
    }
  };

  const handleInviteMembers = () => {
    if (!inviteLink) {
      generateInviteLink();
    } else {
      setShowInviteDialog(true);
    }
  };

  const handleAddNotes = () => {
    setShowAddNotesDialog(true);
  };

  const handleNotesAdded = () => {
    fetchNotes(); // Refresh the notes list
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Members ({members.length})
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="h-4 w-4 mr-2" />
                Notes ({notes.length})
              </TabsTrigger>
              {group.is_admin && (
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Group Members</h3>
                {group.is_admin && (
                  <Button 
                    size="sm" 
                    onClick={handleInviteMembers}
                    disabled={generatingInvite}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {generatingInvite ? 'Generating...' : 'Invite Members'}
                  </Button>
                )}
              </div>

              {loadingMembers ? (
                <div className="text-center py-8">Loading members...</div>
              ) : (
                <div className="grid gap-3">
                  {members.map((member) => {
                    const displayName = getDisplayName(member.profile);
                    
                    return (
                      <Card key={`${member.user_id}-${member.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.profile?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {getAvatarFallback(member.profile)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{displayName}</p>
                                {member.profile?.email && (
                                  <p className="text-sm text-muted-foreground">
                                    {member.profile.email}
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
                    );
                  })}
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
                            <CardDescription>
                              By {note.profile?.first_name || note.profile?.last_name
                                ? `${note.profile.first_name || ''} ${note.profile.last_name || ''}`.trim()
                                : 'Unknown User'} • {new Date(note.created_at).toLocaleDateString()}
                            </CardDescription>
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

            {group.is_admin && (
              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-3">Invite Link</h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex gap-2">
                          <div className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                            {inviteLink || 'Generating invite link...'}
                          </div>
                          <Button 
                            size="sm" 
                            onClick={copyInviteLink}
                            disabled={!inviteLink}
                          >
                            {copiedInvite ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Share this link to invite new members to your group.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-3">Group Settings</h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Group Name</label>
                            <p className="text-sm text-muted-foreground">{group.name}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Created</label>
                            <p className="text-sm text-muted-foreground">
                              {new Date(group.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Total Members</label>
                            <p className="text-sm text-muted-foreground">{members.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Invite Link Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Members to {group?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="invite-link">Shareable Invite Link</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="invite-link"
                  value={inviteLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button 
                  size="sm"
                  onClick={copyInviteLink}
                  disabled={!inviteLink}
                >
                  {copiedInvite ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Share this link with anyone you want to invite to your group. They can paste it in the "Join Group" tab.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowInviteDialog(false)}>
                Done
              </Button>
            </div>
          </div>
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

export default GroupDetailsDialog;
