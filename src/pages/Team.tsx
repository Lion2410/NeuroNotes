
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EditMemberDialog from '@/components/EditMemberDialog';
import TeamStats from '@/components/team/TeamStats';
import TeamMembersList from '@/components/team/TeamMembersList';
import InviteDialog from '@/components/team/InviteDialog';
import JoinTeamTab from '@/components/team/JoinTeamTab';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  user_id: string;
  team_id: string;
}

const Team = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [joinTeamUrl, setJoinTeamUrl] = useState('');
  const [currentTeamId, setCurrentTeamId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('members');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Generate shareable invite link
  const inviteLink = `${window.location.origin}/join-team?invite=abc123def456`;

  useEffect(() => {
    if (user) {
      fetchTeamMembers();
    }
  }, [user]);

  const fetchTeamMembers = async () => {
    try {
      console.log('Fetching team members for user:', user?.id);
      
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Fetched team members:', data);
      
      if (data && data.length > 0) {
        setTeamMembers(data);
        setCurrentTeamId(data[0].team_id);
      } else {
        // Create initial team member entry for the current user
        await createInitialTeamMember();
      }
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load team members.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createInitialTeamMember = async () => {
    if (!user) return;
    
    try {
      console.log('Creating initial team member for user:', user.id);
      
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          user_id: user.id,
          name: `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim() || 'Anonymous',
          email: user.email || '',
          role: 'Owner',
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating initial team member:', error);
        throw error;
      }
      
      console.log('Created initial team member:', data);
      
      if (data) {
        setTeamMembers([data]);
        setCurrentTeamId(data.team_id);
      }
    } catch (error: any) {
      console.error('Error creating initial team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create team member.",
        variant: "destructive"
      });
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: "Link Copied",
      description: "Invite link has been copied to clipboard."
    });
  };

  const editMember = (member: TeamMember) => {
    setEditingMember(member);
    setEditDialogOpen(true);
  };

  const handleSaveMember = async (updatedMember: TeamMember) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          name: updatedMember.name,
          email: updatedMember.email,
          role: updatedMember.role,
          status: updatedMember.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedMember.id);

      if (error) throw error;

      // Update local state
      setTeamMembers(prev => 
        prev.map(member => 
          member.id === updatedMember.id ? { ...member, ...updatedMember } : member
        )
      );

      toast({
        title: "Success",
        description: "Team member updated successfully."
      });
    } catch (error: any) {
      console.error('Error updating team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update team member.",
        variant: "destructive"
      });
    }
    
    setEditDialogOpen(false);
    setEditingMember(null);
  };

  const deleteMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(member => member.id !== memberId));
      
      toast({
        title: "Member Removed",
        description: "Team member has been removed successfully."
      });
    } catch (error: any) {
      console.error('Error deleting team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member.",
        variant: "destructive"
      });
    }
  };

  const handleJoinTeam = async () => {
    if (!joinTeamUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid team invite URL.",
        variant: "destructive"
      });
      return;
    }

    try {
      const url = new URL(joinTeamUrl);
      const inviteCode = url.searchParams.get('invite');
      
      if (!inviteCode) {
        throw new Error('Invalid invite link');
      }

      toast({
        title: "Joining Team...",
        description: "Processing your request to join the team."
      });

      navigate(`/join-team?invite=${inviteCode}`);
    } catch (error) {
      toast({
        title: "Invalid Link",
        description: "The provided invite link is not valid.",
        variant: "destructive"
      });
    }
  };

  const handleAddMember = () => {
    setInviteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-white">Loading team data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black">
      {/* Header */}
      <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center space-x-2">
              <img src="/lovable-uploads/2d11ec38-9fc4-4af5-9224-4b5b20a91803.png" alt="NeuroNotes" className="h-12 w-auto" />
              <span className="text-2xl font-bold text-white">NeuroNotes</span>
            </div>
            <span className="text-slate-400">/</span>
            <span className="text-white font-medium">Team Management</span>
          </div>
          <Button 
            onClick={() => setInviteDialogOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Team Management</h1>
          <p className="text-xl text-slate-300">Manage your team and collaborators</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border-white/20 mb-8">
            <TabsTrigger value="members" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Team Members
            </TabsTrigger>
            <TabsTrigger value="join" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              Join Team
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-8">
            <TeamStats teamMembers={teamMembers} />
            <TeamMembersList teamId={currentTeamId} onAddMember={handleAddMember} />
          </TabsContent>

          <TabsContent value="join" className="space-y-8">
            <JoinTeamTab
              joinTeamUrl={joinTeamUrl}
              onJoinTeamUrlChange={setJoinTeamUrl}
              onJoinTeam={handleJoinTeam}
            />
          </TabsContent>
        </Tabs>
      </div>

      <InviteDialog
        isOpen={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        inviteLink={inviteLink}
        onCopyLink={copyInviteLink}
      />

      <EditMemberDialog
        member={editingMember}
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
      />
    </div>
  );
};

export default Team;
