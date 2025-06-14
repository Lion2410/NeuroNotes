
import React, { useState } from 'react';
import { Users, Settings, Share, Trash2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import GroupInviteDialog from './GroupInviteDialog';
import GroupSettingsDialog from './GroupSettingsDialog';

interface Group {
  id: number;
  name: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
}

interface GroupsListProps {
  groups: Group[];
  onRefresh: () => void;
}

const GroupsList: React.FC<GroupsListProps> = ({ groups, onRefresh }) => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleInviteMembers = (group: Group) => {
    setSelectedGroup(group);
    setInviteDialogOpen(true);
  };

  const handleGroupSettings = (group: Group) => {
    setSelectedGroup(group);
    setSettingsDialogOpen(true);
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast({
        title: "Group Deleted",
        description: "The group has been deleted successfully."
      });

      onRefresh();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete group.",
        variant: "destructive"
      });
    }
  };

  const handleViewGroup = (groupId: number) => {
    navigate(`/group/${groupId}`);
  };

  if (groups.length === 0) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-12 text-center">
          <Users className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Groups Yet</h3>
          <p className="text-slate-300 mb-6">
            Create your first group to start collaborating with others.
          </p>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            Create Group
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Card 
            key={group.id} 
            className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 cursor-pointer"
            onClick={() => handleViewGroup(group.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-white text-lg line-clamp-2 flex items-center gap-2">
                    {group.name}
                    {group.is_admin && (
                      <Crown className="h-4 w-4 text-yellow-400" />
                    )}
                  </CardTitle>
                  <p className="text-slate-300 text-sm mt-2">
                    Created {formatDate(group.created_at)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewGroup(group.id);
                      }}
                      className="text-white hover:bg-slate-700"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View Group
                    </DropdownMenuItem>
                    {group.is_admin && (
                      <>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInviteMembers(group);
                          }}
                          className="text-white hover:bg-slate-700"
                        >
                          <Share className="h-4 w-4 mr-2" />
                          Invite Members
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGroupSettings(group);
                          }}
                          className="text-white hover:bg-slate-700"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Group Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                          className="text-red-400 hover:bg-slate-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Group
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-purple-600 text-white">
                  {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                </Badge>
                {group.is_admin && (
                  <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                    Admin
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <GroupInviteDialog
        group={selectedGroup}
        isOpen={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
      />

      <GroupSettingsDialog
        group={selectedGroup}
        isOpen={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        onGroupUpdated={onRefresh}
      />
    </>
  );
};

export default GroupsList;
