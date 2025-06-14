
import React, { useState, useEffect } from 'react';
import { MoreHorizontal, UserPlus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EditMemberDialog from '@/components/EditMemberDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: number;
  user_id: string;
  group_id: number;
  is_admin: boolean;
  joined_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
}

interface TeamMembersListProps {
  teamId: string;
  onAddMember: () => void;
}

const TeamMembersList: React.FC<TeamMembersListProps> = ({ teamId, onAddMember }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
  }, [teamId]);

  const fetchMembers = async () => {
    try {
      console.log('Fetching group members for group:', teamId);
      
      // Use the group_members_with_profiles view to get member data with profile info
      let query = supabase
        .from('group_members_with_profiles')
        .select('*')
        .order('joined_at', { ascending: false });

      // If we have a specific group ID, filter by it
      if (teamId && teamId !== '') {
        const groupId = parseInt(teamId);
        if (!isNaN(groupId)) {
          query = query.eq('group_id', groupId);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Fetched members:', data);
      setMembers(data || []);
    } catch (error: any) {
      console.error('Error fetching group members:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch team members.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setIsEditDialogOpen(true);
  };

  const handleSaveMember = async (updatedMember: TeamMember) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({
          is_admin: updatedMember.is_admin
        })
        .eq('id', updatedMember.id);

      if (error) throw error;

      setMembers(prev => 
        prev.map(member => 
          member.id === updatedMember.id ? { ...member, is_admin: updatedMember.is_admin } : member
        )
      );

      toast({
        title: "Member Updated",
        description: "Team member has been updated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update team member.",
        variant: "destructive"
      });
    } finally {
      setIsEditDialogOpen(false);
      setEditingMember(null);
    }
  };

  const handleDeleteMember = async (memberId: number) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.filter(member => member.id !== memberId));
      
      toast({
        title: "Member Removed",
        description: "Team member has been removed successfully."
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to remove team member.",
        variant: "destructive"
      });
    }
  };

  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getRoleColor = (isAdmin: boolean) => {
    return isAdmin ? 'bg-purple-600' : 'bg-green-600';
  };

  const getRoleText = (isAdmin: boolean) => {
    return isAdmin ? 'Admin' : 'Member';
  };

  const getMemberName = (member: TeamMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.email || 'Unknown User';
  };

  if (loading) {
    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-6">
          <div className="text-center text-white">Loading team members...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Team Members ({members.length})</CardTitle>
            <Button 
              size="sm" 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={onAddMember}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.length === 0 ? (
              <div className="text-center text-slate-300 py-8">
                No team members found.
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {getMemberName(member).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{getMemberName(member)}</h4>
                      <p className="text-slate-400 text-sm">{member.email || 'No email'}</p>
                      <p className="text-slate-500 text-xs">Joined {formatJoinDate(member.joined_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`${getRoleColor(member.is_admin)} text-white`}>
                      {getRoleText(member.is_admin)}
                    </Badge>
                    <Badge variant="default">
                      Active
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-slate-800 border-slate-700">
                        <DropdownMenuItem 
                          onClick={() => handleEditMember(member)}
                          className="text-white hover:bg-slate-700"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteMember(member.id)}
                          className="text-red-400 hover:bg-slate-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <EditMemberDialog
        member={editingMember}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
      />
    </>
  );
};

export default TeamMembersList;
